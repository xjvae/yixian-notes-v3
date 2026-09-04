// ============================================================
// 设置存储操作
// ============================================================

use crate::error::AppError;
use crate::models::AppSettings;
use crate::storage::connection::HybridStorage;

impl HybridStorage {
    /// 设置单个配置项
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                [key, value],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to set setting {}: {}", key, e)))?;
        Ok(())
    }

    /// 获取所有设置并解析为 AppSettings
    pub fn get_all_settings(&self) -> Result<AppSettings, AppError> {
        let mut settings = AppSettings::default();
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare settings query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query settings: {}", e)))?;

        for row in rows {
            let (key, value) = row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize setting: {}", e)))?;
            match key.as_str() {
                "theme" => settings.theme = value,
                "language" => settings.language = value,
                "font_size" => settings.font_size = value.parse().unwrap_or(14),
                "auto_save" => settings.auto_save = value == "true",
                "auto_save_interval" => settings.auto_save_interval = value.parse().unwrap_or(30),
                "webdav_url" => settings.webdav_url = Some(value),
                "webdav_username" => settings.webdav_username = Some(value),
                "webdav_password" => settings.webdav_password = Some(value),
                "backup_enabled" => settings.backup_enabled = value == "true",
                "backup_interval" => settings.backup_interval = value.parse().unwrap_or(24),
                "encryption_enabled" => settings.encryption_enabled = value == "true",
                "global_shortcut" => settings.global_shortcut = Some(value),
                "global_shortcuts" => {
                    if let Ok(list) = serde_json::from_str::<Vec<crate::models::GlobalShortcutBinding>>(&value) {
                        settings.global_shortcuts = list;
                    }
                }
                "lite_mode" => settings.lite_mode = value == "1" || value == "true",
                _ => {}
            }
        }
        Ok(settings)
    }
}
