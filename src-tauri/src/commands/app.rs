use crate::error::AppError;
use tauri::AppHandle;

#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), AppError> {
    app.restart();
    // Note: app.restart() never returns, so Ok(()) is unreachable
    // but we keep it for type compatibility
    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
pub fn check_single_instance() -> bool {
    // In Tauri 2.x, single instance is handled by the plugin
    true
}
