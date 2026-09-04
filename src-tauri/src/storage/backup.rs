// ============================================================
// backup.rs — 备份记录持久化（阶段3）
// 每次备份落一条可追溯元数据，支撑「备份恢复基础能力」：
// 备份历史、恢复点选择、与 sync_state 记账一致。
// ============================================================

use crate::error::AppError;
use crate::models::BackupRecord;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 新增一条备份记录（幂等：相同 id 覆盖）
    pub fn insert_backup_record(&self, record: &BackupRecord) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT INTO backup_records (id, path, size, created_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET path=excluded.path, size=excluded.size, created_at=excluded.created_at",
                params![record.id, record.path, record.size, record.created_at],
            )
            .map_err(|e| AppError::storage_error(&format!("insert_backup_record: {e}")))?;
        Ok(())
    }

    /// 列出全部备份记录，按创建时间倒序
    pub fn list_backup_records(&self) -> Result<Vec<BackupRecord>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, path, size, created_at FROM backup_records ORDER BY created_at DESC")
            .map_err(|e| AppError::storage_error(&format!("prepare list_backup_records: {e}")))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(BackupRecord {
                    id: row.get(0)?,
                    name: row
                        .get::<_, String>(1)?
                        .rsplit('/')
                        .next()
                        .unwrap_or("")
                        .to_string(),
                    path: row.get(1)?,
                    size: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|e| AppError::storage_error(&format!("query_map list_backup_records: {e}")))?;
        let mut records = Vec::new();
        for row in rows {
            records.push(
                row.map_err(|e| AppError::storage_error(&format!("row list_backup_records: {e}")))?,
            );
        }
        if records.is_empty() {
            return Ok(records);
        }
        Ok(records)
    }

    /// 删除一条备份记录
    pub fn delete_backup_record(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM backup_records WHERE id = ?1", params![id])
            .map_err(|e| AppError::storage_error(&format!("delete_backup_record: {e}")))?;
        Ok(())
    }
}