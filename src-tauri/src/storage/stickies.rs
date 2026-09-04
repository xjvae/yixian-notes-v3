// ============================================================
// 便签存储操作
// ============================================================

use crate::error::AppError;
use crate::models::StickyNote;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取所有便签
    pub fn get_stickies(&self) -> Result<Vec<StickyNote>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, content, color, x, y, width, height, is_pinned, created_at, updated_at FROM sticky_notes ORDER BY updated_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare stickies query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(StickyNote {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    color: row.get(2)?,
                    x: row.get(3)?,
                    y: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    is_pinned: row.get::<_, i32>(7)? != 0,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query stickies: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize sticky: {}", e)))?);
        }
        Ok(result)
    }

    /// 保存便签（插入或更新）
    pub fn save_sticky(&self, sticky: &StickyNote) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO sticky_notes (id, content, color, x, y, width, height, is_pinned, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    sticky.id,
                    sticky.content,
                    sticky.color,
                    sticky.x,
                    sticky.y,
                    sticky.width,
                    sticky.height,
                    sticky.is_pinned as i32,
                    sticky.created_at.to_rfc3339(),
                    sticky.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save sticky {}: {}", sticky.id, e)))?;
        Ok(())
    }

    /// 删除便签
    pub fn delete_sticky(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM sticky_notes WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete sticky {}: {}", id, e)))?;
        Ok(())
    }
}
