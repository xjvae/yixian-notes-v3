// ============================================================
// 密码库存储操作
// ============================================================

use crate::error::AppError;
use crate::models::VaultItem;
use crate::storage::connection::HybridStorage;
use rusqlite::params;

impl HybridStorage {
    /// 获取所有密码库条目
    pub fn get_vault_items(&self) -> Result<Vec<VaultItem>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, name, item_type, encrypted_data, created_at, updated_at FROM vault_items ORDER BY updated_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare vault query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(VaultItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    item_type: row.get(2)?,
                    encrypted_data: row.get(3)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query vault: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize vault item: {}", e)))?);
        }
        Ok(result)
    }

    /// 保存密码库条目（插入或更新）
    pub fn save_vault_item(&self, item: &VaultItem) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO vault_items (id, name, item_type, encrypted_data, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)",
                params![
                    item.id,
                    item.name,
                    item.item_type,
                    item.encrypted_data,
                    item.created_at.to_rfc3339(),
                    item.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save vault item {}: {}", item.id, e)))?;
        Ok(())
    }

    /// 删除密码库条目
    pub fn delete_vault_item(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM vault_items WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete vault item {}: {}", id, e)))?;
        Ok(())
    }
}
