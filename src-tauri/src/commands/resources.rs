// ============================================================
// 采集项命令
// captured_items 的 CRUD
// ============================================================

use crate::error::AppError;
use crate::models::CapturedItem;
use crate::state::AppState;
use tauri::State;

// ─── 采集项 ───────────────────────────────────────────────

#[tauri::command]
pub fn get_captured_items(state: State<'_, AppState>) -> Result<Vec<CapturedItem>, AppError> {
    state.storage.get_captured_items()
}

#[tauri::command]
pub fn save_captured_item(state: State<'_, AppState>, item: CapturedItem) -> Result<(), AppError> {
    let storage = &*state.storage;
    storage.save_captured_item(&item)
}

#[tauri::command]
pub fn delete_captured_item(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_captured_item(&id)
}