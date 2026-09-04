// ============================================================
// 待办存储操作（计划域）
// 对应 `todos` 表，`related_note_id` 打通「笔记 → 待办」执行链路
// ============================================================

use crate::error::AppError;
use crate::models::Todo;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取全部待办（按创建时间倒序）
    pub fn get_todos(&self) -> Result<Vec<Todo>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, title, description, priority, status, due_date, notebook_id, related_note_id, tags, created_at, updated_at FROM todos ORDER BY created_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare todos query: {}", e)))?;
        let rows = stmt
            .query_map([], |row| {
                let due: Option<String> = row.get(5)?;
                let created: String = row.get(9)?;
                let updated: String = row.get(10)?;
                let tags_raw: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();
                Ok(Todo {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    priority: row.get(3)?,
                    status: row.get(4)?,
                    due_date: due
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                        .map(|d| d.with_timezone(&chrono::Utc)),
                    notebook_id: row.get(6)?,
                    related_note_id: row.get(7)?,
                    tags,
                    created_at: chrono::DateTime::parse_from_rfc3339(&created)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&updated)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query todos: {}", e)))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize todo: {}", e)))?);
        }
        Ok(result)
    }

    /// 保存待办（插入或更新）
    pub fn save_todo(&self, todo: &Todo) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO todos (id, title, description, priority, status, due_date, notebook_id, related_note_id, tags, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    todo.id,
                    todo.title,
                    todo.description,
                    todo.priority,
                    todo.status,
                    todo.due_date.map(|d| d.to_rfc3339()),
                    todo.notebook_id,
                    todo.related_note_id,
                    serde_json::to_string(&todo.tags).unwrap_or_else(|_| "[]".into()),
                    todo.created_at.to_rfc3339(),
                    todo.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save todo {}: {}", todo.id, e)))?;
        Ok(())
    }

    /// 物理删除待办
    pub fn delete_todo(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM todos WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete todo {}: {}", id, e)))?;
        Ok(())
    }
}