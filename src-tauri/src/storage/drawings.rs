// ============================================================
// 绘图存储操作
// ============================================================

use crate::error::AppError;
use crate::models::Drawing;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取所有绘图
    pub fn get_drawings(&self) -> Result<Vec<Drawing>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, title, data, width, height, created_at, updated_at FROM drawings ORDER BY updated_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare drawings query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(Drawing {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    data: row.get(2)?,
                    width: row.get(3)?,
                    height: row.get(4)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query drawings: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize drawing: {}", e)))?);
        }
        Ok(result)
    }

    /// 保存绘图（插入或更新）
    pub fn save_drawing(&self, drawing: &Drawing) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO drawings (id, title, data, width, height, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    drawing.id,
                    drawing.title,
                    drawing.data,
                    drawing.width,
                    drawing.height,
                    drawing.created_at.to_rfc3339(),
                    drawing.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save drawing {}: {}", drawing.id, e)))?;
        Ok(())
    }

    /// 删除绘图
    pub fn delete_drawing(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM drawings WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete drawing {}: {}", id, e)))?;
        Ok(())
    }
}
