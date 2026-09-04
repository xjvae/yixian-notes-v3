use crate::error::AppError;
use crate::models::AppSettings;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    state.storage.get_all_settings()
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), AppError> {
    persist_settings(&state, settings)
}

/// 部分更新设置：`patch` 只需包含要修改的字段（与前端 settings_patch 对齐）。
/// 先将补丁合并到当前设置对象，再整体持久化。
#[tauri::command]
pub fn patch_settings(state: State<'_, AppState>, patch: serde_json::Value) -> Result<AppSettings, AppError> {
    let mut settings = state.storage.get_all_settings()?;
    let mut current = serde_json::to_value(&settings)
        .map_err(|e| AppError::new("SETTINGS_PATCH_ERROR", &format!("序列化当前设置失败: {e}")))?;

    if let Some(obj) = patch.as_object() {
        if let Some(cur) = current.as_object_mut() {
            for (key, value) in obj {
                cur.insert(key.clone(), value.clone());
            }
        }
    }

    settings = serde_json::from_value(current)
        .map_err(|e| AppError::new("SETTINGS_PATCH_ERROR", &format!("应用设置补丁失败: {e}")))?;

    persist_settings(&state, settings.clone())?;
    Ok(settings)
}

fn persist_settings(state: &State<'_, AppState>, settings: AppSettings) -> Result<(), AppError> {
    let storage = &*state.storage;
    storage.set_setting("theme", &settings.theme)?;
    storage.set_setting("language", &settings.language)?;
    storage.set_setting("font_size", &settings.font_size.to_string())?;
    storage.set_setting("auto_save", &settings.auto_save.to_string())?;
    storage.set_setting("auto_save_interval", &settings.auto_save_interval.to_string())?;
    if let Some(url) = &settings.webdav_url {
        storage.set_setting("webdav_url", url)?;
    }
    if let Some(user) = &settings.webdav_username {
        storage.set_setting("webdav_username", user)?;
    }
    if let Some(pass) = &settings.webdav_password {
        storage.set_setting("webdav_password", pass)?;
    }
    storage.set_setting("backup_enabled", &settings.backup_enabled.to_string())?;
    storage.set_setting("backup_interval", &settings.backup_interval.to_string())?;
    storage.set_setting("encryption_enabled", &settings.encryption_enabled.to_string())?;
    if let Some(shortcut) = &settings.global_shortcut {
        storage.set_setting("global_shortcut", shortcut)?;
    }
    if let Ok(json) = serde_json::to_string(&settings.global_shortcuts) {
        storage.set_setting("global_shortcuts", &json)?;
    }
    storage.set_setting("lite_mode", if settings.lite_mode { "1" } else { "0" })?;
    Ok(())
}
