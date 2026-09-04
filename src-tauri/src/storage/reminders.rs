// ============================================================
// 提醒存储操作
// ============================================================

use crate::error::AppError;
use crate::models::Reminder;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取全部提醒列表（含已完成，按提醒时间升序）。
    /// 返回全部提醒，使前端 store 在重启后也能完整恢复已完成项。
    pub fn get_reminders(&self) -> Result<Vec<Reminder>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, note_id, title, description, remind_at, is_completed, repeat, created_at FROM reminders ORDER BY remind_at ASC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare reminders query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(Reminder {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    title: row.get(2)?,
                    description: row.get(3)?,
                    remind_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    is_completed: row.get::<_, i32>(5)? != 0,
                    repeat: row.get(6)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query reminders: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize reminder: {}", e)))?);
        }
        Ok(result)
    }

    /// 保存提醒（插入或更新）
    pub fn save_reminder(&self, reminder: &Reminder) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO reminders (id, note_id, title, description, remind_at, is_completed, repeat, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    reminder.id,
                    reminder.note_id,
                    reminder.title,
                    reminder.description,
                    reminder.remind_at.to_rfc3339(),
                    reminder.is_completed as i32,
                    reminder.repeat,
                    reminder.created_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save reminder {}: {}", reminder.id, e)))?;
        Ok(())
    }

    /// 将提醒标记为已完成
    pub fn complete_reminder(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "UPDATE reminders SET is_completed = 1 WHERE id = ?",
                [id],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to complete reminder {}: {}", id, e)))?;
        Ok(())
    }

    /// 删除提醒（供前端删除操作落库，保持 store 与 SQLite 一致）
    pub fn delete_reminder(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM reminders WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete reminder {}: {}", id, e)))?;
        Ok(())
    }
}
