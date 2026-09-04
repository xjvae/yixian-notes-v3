// ============================================================
// 对象系统命令
// 标签、笔记本、同步状态
// ============================================================

use crate::error::AppError;
use crate::models::{CrossHit, Notebook, SyncState, Tag};
use crate::state::AppState;
use tauri::State;

// ─── 跨对象搜索 ───────────────────────────────────────────

#[tauri::command]
pub fn cross_search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<CrossHit>, AppError> {
    state.storage.cross_search(&query, limit.unwrap_or(30))
}

// ─── 标签 ───────────────────────────────────────────────

#[tauri::command]
pub fn get_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, AppError> {
    state.storage.get_tags()
}

#[tauri::command]
pub fn save_tag(state: State<'_, AppState>, tag: Tag) -> Result<(), AppError> {
    state.storage.save_tag(&tag)
}

#[tauri::command]
pub fn rename_tag(state: State<'_, AppState>, id: String, name: String) -> Result<(), AppError> {
    state.storage.rename_tag(&id, &name)
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_tag(&id)
}

#[tauri::command]
pub fn merge_tags(state: State<'_, AppState>, from_id: String, to_id: String) -> Result<(), AppError> {
    state.storage.merge_tags(&from_id, &to_id)
}

#[tauri::command]
pub fn set_note_tags(state: State<'_, AppState>, note_id: String, tag_ids: Vec<String>) -> Result<(), AppError> {
    state.storage.set_note_tags(&note_id, &tag_ids)
}

// ─── 笔记本 ──────────────────────────────────────────────

#[tauri::command]
pub fn get_notebooks(state: State<'_, AppState>) -> Result<Vec<Notebook>, AppError> {
    state.storage.get_notebooks()
}

#[tauri::command]
pub fn save_notebook(state: State<'_, AppState>, mut notebook: Notebook) -> Result<(), AppError> {
    if notebook.id.is_empty() {
        notebook.id = crate::storage::HybridStorage::generate_id();
    }
    state.storage.save_notebook(&notebook)
}

#[tauri::command]
pub fn delete_notebook(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_notebook(&id)
}

// ─── 同步状态 ───────────────────────────────────────────

#[tauri::command]
pub fn get_sync_state(state: State<'_, AppState>, key: String) -> Result<Option<SyncState>, AppError> {
    state.storage.get_sync_state(&key)
}

#[tauri::command]
pub fn get_all_sync_states(state: State<'_, AppState>) -> Result<Vec<SyncState>, AppError> {
    state.storage.get_all_sync_states()
}

#[tauri::command]
pub fn put_sync_state(state: State<'_, AppState>, key: String, value: String) -> Result<(), AppError> {
    state.storage.put_sync_state(&key, &value)
}