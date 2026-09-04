// ============================================================
// 剪贴板历史存储操作
// ============================================================

use crate::error::AppError;
use crate::models::ClipboardEntry;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取剪贴板历史记录
    pub fn get_clipboard(&self, limit: i64) -> Result<Vec<ClipboardEntry>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, content, content_type, image_path, image_width, image_height, created_at FROM clipboard_history ORDER BY created_at DESC LIMIT ?")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare clipboard query: {}", e)))?;

        let rows = stmt
            .query_map([limit], |row| {
                Ok(ClipboardEntry {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    content_type: row.get(2)?,
                    image_path: row.get(3).ok().flatten(),
                    image_width: row.get::<_, Option<i64>>(4)?.map(|v| v as u32),
                    image_height: row.get::<_, Option<i64>>(5)?.map(|v| v as u32),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query clipboard: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize clipboard entry: {}", e)))?);
        }
        Ok(result)
    }

    /// 添加剪贴板记录
    pub fn add_clipboard(&self, entry: &ClipboardEntry) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT INTO clipboard_history (id, content, content_type, image_path, image_width, image_height, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    entry.id,
                    entry.content,
                    entry.content_type,
                    entry.image_path.as_ref().map(|s| s.as_str()),
                    entry.image_width.map(|v| v as i64),
                    entry.image_height.map(|v| v as i64),
                    entry.created_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to add clipboard entry: {}", e)))?;
        Ok(())
    }

    /// 清空剪贴板历史
    pub fn clear_clipboard(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM clipboard_history", [])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear clipboard: {}", e)))?;
        Ok(())
    }
}
