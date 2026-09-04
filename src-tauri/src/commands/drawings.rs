use crate::error::AppError;
use crate::models::Drawing;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_drawings(state: State<'_, AppState>) -> Result<Vec<Drawing>, AppError> {
    state.storage.get_drawings()
}

#[tauri::command]
pub fn save_drawing(state: State<'_, AppState>, mut drawing: Drawing) -> Result<(), AppError> {
    drawing.updated_at = crate::storage::HybridStorage::now();
    state.storage.save_drawing(&drawing)
}

#[tauri::command]
pub fn delete_drawing(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_drawing(&id)
}