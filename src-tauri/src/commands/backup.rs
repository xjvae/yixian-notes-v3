use crate::error::AppError;
use crate::models::BackupRecord;
use crate::state::AppState;
use std::fs;
use tauri::State;

// ============================================================
// 备份恢复基础能力（阶段3）
// - create_backup：复制数据库，并向 backup_records 落一条可追踪记录
// - list_backups ：从 backup_records 返回结构化备份历史（含大小/时间）
// - delete_backup：删除备份文件与记录
// - restore_backup：恢复前 WAL checkpoint 保证一致性，再替换主库
// ============================================================

#[tauri::command]
pub fn create_backup(state: State<'_, AppState>) -> Result<BackupRecord, AppError> {
    let backup_dir = state.app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir)
        .map_err(|e| AppError::storage_error(&format!("Failed to create backup dir: {}", e)))?;

    let db_path = state.app_data_dir.join("yixian.db");
    if !db_path.exists() {
        return Err(AppError::not_found("Database not found"));
    }

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("backup_{}.db", timestamp);
    let backup_path = backup_dir.join(&backup_name);

    // WAL 模式下列数据可能仍在 -wal 中；先 checkpoint，保证备份文件完整。
    {
        let storage = &*state.storage;
        let conn = storage
            .conn
            .lock()
            .get()
            .map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn.query_row("PRAGMA wal_checkpoint(FULL)", [], |_| Ok(()))
            .map_err(|e| AppError::storage_error(&format!("Failed to checkpoint WAL before backup: {}", e)))?;
    }

    fs::copy(&db_path, &backup_path)
        .map_err(|e| AppError::storage_error(&format!("Failed to copy database: {}", e)))?;

    let size = fs::metadata(&backup_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let record = BackupRecord {
        id: HybridStorage::generate_id(),
        name: backup_name,
        path: backup_path.to_string_lossy().to_string(),
        size,
        created_at: HybridStorage::now().to_rfc3339(),
    };

    {
        let storage = &*state.storage;
        storage.insert_backup_record(&record).ok();
    }

    Ok(record)
}

#[tauri::command]
pub fn list_backups(
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
) -> Result<Vec<BackupRecord>, AppError> {
    {
        let storage = &*state.storage;
        let records = storage.list_backup_records()?;
        if !records.is_empty() {
            return Ok(records);
        }
    }
    // 兼容旧数据：backup_records 为空时回退到目录扫描
    let backup_dir = state.app_data_dir.join("backups");
    if !backup_dir.exists() {
        return Ok(vec![]);
    }
    let entries = fs::read_dir(&backup_dir)
        .map_err(|e| AppError::storage_error(&format!("Failed to read backup dir: {}", e)))?;
    let mut backups: Vec<BackupRecord> = entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let path = e.path();
            BackupRecord {
                id: HybridStorage::generate_id(),
                name: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size: fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(0),
                created_at: e.file_name().to_string_lossy().to_string(),
            }
        })
        .collect();
    backups.sort_by(|a, b| b.name.cmp(&a.name)); // newest first
    Ok(backups)
}

#[tauri::command]
pub fn delete_backup(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    // 在记录表里找到备份文件的物理路径
    let resolved_path: Option<std::path::PathBuf> = {
        let storage = &*state.storage;
        storage
            .list_backup_records()?
            .into_iter()
            .find(|r| r.id == id)
            .map(|r| std::path::PathBuf::from(r.path))
            .or_else(|| {
                let p = state.app_data_dir.join("backups").join(&id);
                if p.exists() { Some(p) } else { None }
            })
    };
    if let Some(p) = resolved_path {
        if p.exists() {
            fs::remove_file(&p)
                .map_err(|e| AppError::storage_error(&format!("Failed to delete backup: {}", e)))?;
        }
    }
    // 同步删除记录表中该 id 的元数据
    {
        let storage = &*state.storage;
        let _ = storage.delete_backup_record(&id);
    }
    Ok(())
}

#[tauri::command]
pub fn restore_backup(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    // 定位备份文件：优先记录表，其次按文件名（兼容）
    let backup_path = {
        let storage = &*state.storage;
        if let Some(rec) = storage
            .list_backup_records()?
            .into_iter()
            .find(|r| r.id == id || r.name == id)
        {
            std::path::PathBuf::from(&rec.path)
        } else if !id.is_empty() {
            state.app_data_dir.join("backups").join(&id)
        } else {
            state.app_data_dir.join("backups")
        }
    };
    if !backup_path.exists() {
        return Err(AppError::not_found(&format!("Backup {} not found", id)));
    }

    let db_path = state.app_data_dir.join("yixian.db");
    // 恢复前 WAL checkpoint，避免半截 WAL 造成不一致
    {
        let storage = &*state.storage;
        let conn = storage
            .conn
            .lock()
            .get()
            .map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn.query_row("PRAGMA wal_checkpoint(FULL)", [], |_| Ok(()))
            .map_err(|e| AppError::storage_error(&format!("Failed to checkpoint WAL before restore: {}", e)))?;
    }
    fs::copy(&backup_path, &db_path)
        .map_err(|e| AppError::storage_error(&format!("Failed to restore backup: {}", e)))?;
    // 覆盖主库后重开连接，使进程内连接指向恢复后的数据，避免读到旧页缓存
    state
        .storage
        .reopen()
        .map_err(|e| AppError::storage_error(&format!("Failed to reopen database after restore: {}", e)))?;
    Ok(())
}

use crate::storage::connection::HybridStorage;