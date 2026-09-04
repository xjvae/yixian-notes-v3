use crate::error::AppError;
use crate::models::VaultItem;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_vault_items(state: State<'_, AppState>) -> Result<Vec<VaultItem>, AppError> {
    state.storage.get_vault_items()
}

#[tauri::command]
pub fn save_vault_item(state: State<'_, AppState>, mut item: VaultItem) -> Result<(), AppError> {
    item.updated_at = crate::storage::HybridStorage::now();
    state.storage.save_vault_item(&item)
}

#[tauri::command]
pub fn delete_vault_item(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_vault_item(&id)
}