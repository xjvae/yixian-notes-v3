use crate::error::AppError;
use crate::models::*;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_notes(state: State<'_, AppState>, notebook_id: Option<String>) -> Result<Vec<Note>, AppError> {
    state.storage.get_notes(notebook_id.as_deref())
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Option<Note>, AppError> {
    state.storage.get_note(&id)
}

#[tauri::command]
pub fn save_note(state: State<'_, AppState>, mut note: Note) -> Result<(), AppError> {
    let storage = &*state.storage;
    note.updated_at = crate::storage::HybridStorage::now();
    storage.save_note(&note)
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_note(&id)
}

#[tauri::command]
pub fn get_note_versions(state: State<'_, AppState>, note_id: String) -> Result<Vec<NoteVersion>, AppError> {
    state.storage.get_versions(&note_id)
}

#[tauri::command]
pub fn save_note_version(state: State<'_, AppState>, version: NoteVersion) -> Result<(), AppError> {
    state.storage.save_version(&version)
}

#[tauri::command]
pub fn restore_version(
    state: State<'_, AppState>,
    note_id: String,
    version_id: String,
) -> Result<(), AppError> {
    let storage = &*state.storage;
    let versions = storage.get_versions(&note_id)?;
    let version = versions
        .into_iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| AppError::not_found(&format!("Version {} not found", version_id)))?;

    let mut note = storage
        .get_note(&note_id)?
        .ok_or_else(|| AppError::not_found(&format!("Note {} not found", note_id)))?;
    note.content = version.content;
    note.title = version.title;
    note.updated_at = crate::storage::HybridStorage::now();
    storage.save_note(&note)
}

#[tauri::command]
pub fn update_version(state: State<'_, AppState>, version: NoteVersion) -> Result<(), AppError> {
    state.storage.update_version(&version)
}

#[tauri::command]
pub fn delete_version(state: State<'_, AppState>, version_id: String) -> Result<(), AppError> {
    state.storage.delete_version(&version_id)
}

#[tauri::command]
pub fn clear_versions(state: State<'_, AppState>, note_id: String) -> Result<(), AppError> {
    state.storage.clear_versions(&note_id)
}

#[tauri::command]
pub fn import_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    notebook_id: Option<String>,
) -> Result<Note, AppError> {
    let note = Note {
        id: crate::storage::HybridStorage::generate_id(),
        title,
        content,
        notebook_id,
        tags: vec![],
        is_favorite: false,
        is_encrypted: false,
        created_at: crate::storage::HybridStorage::now(),
        updated_at: crate::storage::HybridStorage::now(),
        metadata: serde_json::Value::Null,
    };
    state.storage.save_note(&note)?;
    Ok(note)
}

/// 批量保存笔记 —— 单次 IPC 调用 + 事务内提交，替代前端逐条 save_note 的热路径。
#[tauri::command]
pub fn save_notes_batch(state: State<'_, AppState>, mut notes: Vec<Note>) -> Result<(), AppError> {
    let now = crate::storage::HybridStorage::now();
    for note in notes.iter_mut() {
        note.updated_at = now;
    }
    // 单次加锁：tag 关系表写入已并入 save_notes_batch 的同一事务，避免 N 次锁与中间态不一致。
    state.storage.save_notes_batch(&notes)
}

/// 建笔记（含可选 notebook / tag / 初稿）并返回已落库对象。
#[tauri::command]
pub fn create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    notebook_id: Option<String>,
    tags: Vec<String>,
    is_favorite: bool,
) -> Result<Note, AppError> {
    let now = crate::storage::HybridStorage::now();
    let note = Note {
        id: crate::storage::HybridStorage::generate_id(),
        title,
        content,
        notebook_id,
        tags,
        is_favorite,
        is_encrypted: false,
        created_at: now,
        updated_at: now,
        metadata: serde_json::Value::Null,
    };
    let storage = &*state.storage;
    storage.save_note(&note)?;
    storage.set_note_tags(&note.id, &note.tags)?;
    Ok(note)
}

/// 批量删除笔记（物理删除）。
#[tauri::command]
pub fn delete_notes(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), AppError> {
    state.storage.delete_notes(&ids)
}

/// 轻量笔记搜索。
#[tauri::command]
pub fn search_notes(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
    include_deleted: Option<bool>,
) -> Result<Vec<Note>, AppError> {
    state.storage.search_notes(
        &query,
        limit.unwrap_or(20),
        include_deleted.unwrap_or(false),
    )
}

/// 读取全部笔记双链真实边（图谱真实连接，替代伪边）。
#[tauri::command]
pub fn get_all_note_links(state: State<'_, AppState>) -> Result<Vec<crate::models::NoteLink>, AppError> {
    state.storage.get_all_note_links()
}