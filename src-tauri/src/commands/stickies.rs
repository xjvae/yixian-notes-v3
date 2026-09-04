use crate::error::AppError;
use crate::models::StickyNote;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_stickies(state: State<'_, AppState>) -> Result<Vec<StickyNote>, AppError> {
    state.storage.get_stickies()
}

#[tauri::command]
pub fn save_sticky(state: State<'_, AppState>, mut sticky: StickyNote) -> Result<(), AppError> {
    sticky.updated_at = crate::storage::HybridStorage::now();
    state.storage.save_sticky(&sticky)
}

#[tauri::command]
pub fn delete_sticky(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_sticky(&id)
}
