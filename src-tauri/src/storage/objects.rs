// ============================================================
// 对象系统存储操作
// 覆盖：标签、待办、采集项、同步状态、笔记本
// 这些是「记录 → 执行 → 复用 → 同步」主链路的关系基础。
// ============================================================

use crate::error::AppError;
use crate::models::{CaptureTarget, CapturedItem, CrossHit, Notebook, SyncState, Tag};
use crate::storage::connection::HybridStorage;
use rusqlite::{params, OptionalExtension};

// ─── 笔记本 ──────────────────────────────────────────────

impl HybridStorage {
    pub fn get_notebooks(&self) -> Result<Vec<Notebook>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, name, icon, color, parent_id, sort_order, created_at FROM notebooks ORDER BY sort_order ASC, created_at ASC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare notebooks query: {e}")))?;
        let rows = stmt
            .query_map([], Notebook::from_row)
            .map_err(|e| AppError::storage_error(&format!("Failed to query notebooks: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Notebook row: {e}")))?);
        }
        Ok(result)
    }

    pub fn save_notebook(&self, notebook: &Notebook) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO notebooks (id, name, icon, color, parent_id, sort_order, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    notebook.id,
                    notebook.name,
                    notebook.icon,
                    notebook.color,
                    notebook.parent_id,
                    notebook.sort_order,
                    notebook.created_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save notebook {}: {}", notebook.id, e)))?;
        Ok(())
    }

    pub fn delete_notebook(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM notebooks WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete notebook {}: {}", id, e)))?;
        Ok(())
    }
}

// ─── 标签 ────────────────────────────────────────────────────

impl HybridStorage {
    pub fn get_tags(&self) -> Result<Vec<Tag>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare tags query: {}", e)))?;

        let rows = stmt
            .query_map([], Tag::from_row)
            .map_err(|e| AppError::storage_error(&format!("Failed to query tags: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Tag row: {e}")))?);
        }
        Ok(result)
    }

    pub fn save_tag(&self, tag: &Tag) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
                params![tag.id, tag.name, tag.color, tag.created_at.to_rfc3339()],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save tag {}: {}", tag.id, e)))?;
        Ok(())
    }

    pub fn rename_tag(&self, id: &str, name: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("UPDATE tags SET name = ? WHERE id = ?", params![name, id])
            .map_err(|e| AppError::storage_error(&format!("Failed to rename tag {}: {}", id, e)))?;
        Ok(())
    }

    pub fn delete_tag(&self, id: &str) -> Result<(), AppError> {
        // note_tags 通过外键级联删除；notes.tags 数组由前端在同步时移除
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM tags WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete tag {}: {}", id, e)))?;
        Ok(())
    }

    /// 为笔记写入 tags（全量替换，联动 note_tags 关系表）
    pub fn set_note_tags(&self, note_id: &str, tag_ids: &[String]) -> Result<(), AppError> {
        let mut conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::storage_error(&format!("Failed to begin set_note_tags: {e}")))?;
        Self::set_note_tags_tx(&tx, note_id, tag_ids)
            .map_err(|e| AppError::storage_error(&format!("Failed to write note_tags: {e}")))?;
        tx.commit()
            .map_err(|e| AppError::storage_error(&format!("Failed to commit set_note_tags: {e}")))?;
        Ok(())
    }

    /// 事务版：在调用方已开启的事务内全量替换 note_tags（供批量保存原子化复用）。
    pub(crate) fn set_note_tags_tx(
        tx: &rusqlite::Transaction<'_>,
        note_id: &str,
        tag_ids: &[String],
    ) -> Result<(), AppError> {
        tx.execute("DELETE FROM note_tags WHERE note_id = ?", [note_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear note_tags(tx): {e}")))?;
        for tid in tag_ids {
            tx.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
                params![note_id, tid],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to insert note_tags(tx): {e}")))?;
        }
        Ok(())
    }

    /// 合并标签：将 from_id 的所有笔记关系迁移到 to_id，然后删除来源标签
    pub fn merge_tags(&self, from_id: &str, to_id: &str) -> Result<(), AppError> {
        let mut conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::storage_error(&format!("Failed to begin merge_tags: {e}")))?;
        tx.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id)
             SELECT note_id, ? FROM note_tags WHERE tag_id = ?",
            params![to_id, from_id],
        )
        .map_err(|e| AppError::storage_error(&format!("Failed to migrate note_tags: {e}")))?;
        tx.execute("DELETE FROM note_tags WHERE tag_id = ?", [from_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear from_tags: {e}")))?;
        tx.execute("DELETE FROM tags WHERE id = ?", [from_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete source tag: {e}")))?;
        tx.commit()
            .map_err(|e| AppError::storage_error(&format!("Failed to commit merge_tags: {e}")))?;
        Ok(())
    }
}

// ─── 采集项 (CapturedItem) ─────────────────────────────────

impl HybridStorage {
    /// 读取某个采集项的处理目标列表
    fn captured_targets(&self, item_id: &str) -> Result<Vec<CaptureTarget>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, captured_item_id, target_type, target_id, created_at FROM capture_targets WHERE captured_item_id = ?")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare targets: {e}")))?;
        let rows = stmt
            .query_map([item_id], CaptureTarget::from_row)
            .map_err(|e| AppError::storage_error(&format!("Failed to query targets: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("target row: {e}")))?);
        }
        Ok(result)
    }

    /// 获取全部采集项（含各自的处理目标，按创建时间倒序）
    pub fn get_captured_items(&self) -> Result<Vec<CapturedItem>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, source, kind, content, preview, status, processed_at, created_at FROM captured_items ORDER BY created_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare captured query: {e}")))?;
        let rows = stmt
            .query_map([], |row| {
                let processed_at: Option<String> = row.get(6)?;
                Ok(CapturedItem {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    kind: row.get(2)?,
                    content: row.get(3)?,
                    preview: row.get(4)?,
                    status: row.get(5)?,
                    processed_at: processed_at
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                        .map(|d| d.with_timezone(&chrono::Utc)),
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    targets: vec![],
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query captured items: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            let mut item = row.map_err(|e| AppError::serialization_error(&format!("captured row: {e}")))?;
            item.targets = self.captured_targets(&item.id)?;
            result.push(item);
        }
        Ok(result)
    }

    /// 保存采集项（含处理目标，事务内全量替换）
    pub fn save_captured_item(&self, item: &CapturedItem) -> Result<(), AppError> {
        let mut conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::storage_error(&format!("Failed to begin save_captured: {e}")))?;
        tx.execute(
            "INSERT OR REPLACE INTO captured_items (id, source, kind, content, preview, status, processed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                item.id,
                item.source,
                item.kind,
                item.content,
                item.preview,
                item.status,
                item.processed_at.map(|t| t.to_rfc3339()),
                item.created_at.to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::storage_error(&format!("Failed to save captured item {}: {}", item.id, e)))?;
        tx.execute("DELETE FROM capture_targets WHERE captured_item_id = ?", [&item.id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear targets: {e}")))?;
        for target in &item.targets {
            tx.execute(
                "INSERT OR REPLACE INTO capture_targets (id, captured_item_id, target_type, target_id, created_at)
                 VALUES (?, ?, ?, ?, ?)",
                params![
                    target.id,
                    target.captured_item_id,
                    target.target_type,
                    target.target_id,
                    target.created_at.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save target: {e}")))?;
        }
        tx.commit()
            .map_err(|e| AppError::storage_error(&format!("Failed to commit save_captured: {e}")))?;
        Ok(())
    }

    /// 删除采集项（capture_targets 通过外键级联删除）
    pub fn delete_captured_item(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM captured_items WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete captured item {}: {}", id, e)))?;
        Ok(())
    }
}

// ─── 跨对象搜索（阶段2） ──────────────────────────────────

impl HybridStorage {
    /// 跨对象全文搜索：在笔记 / 待办 / 附件 / 采集项 / 标签 上做 LIKE 索引，
    /// 聚合为统一的 CrossHit 列表，供前端一次 IPC 获取全局命中的对象。
    /// 注：本实现用普通 LIKE（兼容 bundled SQLite 无 FTS5 模块的风险）；
    /// 后续如需中文分词可切换 SQLite FTS5 virtual table。
    pub fn cross_search(&self, query: &str, limit: i64) -> Result<Vec<CrossHit>, AppError> {
        let q = query.trim();
        if q.is_empty() {
            return Ok(Vec::new());
        }
        let pattern = format!("%{}%", q);
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare(
                "SELECT * FROM (
                    SELECT 'note' AS source, id AS object_id, title AS title, content AS snippet, updated_at AS sort_key
                    FROM notes WHERE (title LIKE ?1 OR content LIKE ?1) AND is_favorite = 0
                    UNION ALL
                    SELECT 'todo' AS source, id AS object_id, title AS title, COALESCE(description,'') AS snippet, updated_at AS sort_key
                    FROM todos WHERE title LIKE ?1 OR description LIKE ?1
                    UNION ALL
                    SELECT 'captured', id, kind, content, created_at FROM captured_items WHERE content LIKE ?1 OR preview LIKE ?1
                    UNION ALL
                    SELECT 'tag', id, name, name, created_at FROM tags WHERE name LIKE ?1
                )
                ORDER BY sort_key DESC LIMIT ?2",
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare cross_search: {e}")))?;
        let rows = stmt
            .query_map(params![pattern, limit], |row| {
                Ok(CrossHit {
                    source: row.get(0)?,
                    object_id: row.get(1)?,
                    title: row.get(2)?,
                    snippet: row.get(3)?,
                    sort_key: row.get(4)?,
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to run cross_search: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("cross_search row: {e}")))?);
        }
        Ok(result)
    }
}

// ─── 同步状态 ──────────────────────────────────────────────

impl HybridStorage {
    pub fn get_sync_state(&self, key: &str) -> Result<Option<SyncState>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .query_row(
                "SELECT key, value, updated_at FROM sync_state WHERE key = ?",
                [key],
                SyncState::from_row,
            )
            .optional()
            .map_err(|e| AppError::storage_error(&format!("Failed to read sync_state {key}: {e}")))
    }

    /// 写入同步记账（key 如 `note:{id}`、`webdav:last_sync`）
    pub fn put_sync_state(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)",
                params![key, value, HybridStorage::now().to_rfc3339()],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to write sync_state {key}: {e}")))?;
        Ok(())
    }

    /// 读取全部同步状态（用于 WebDAV 增量同步比对）
    pub fn get_all_sync_states(&self) -> Result<Vec<SyncState>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT key, value, updated_at FROM sync_state")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare sync_state: {e}")))?;
        let rows = stmt
            .query_map([], SyncState::from_row)
            .map_err(|e| AppError::storage_error(&format!("Failed to query sync_state: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("sync_state row: {e}")))?);
        }
        Ok(result)
    }
}

// ─── 行映射辅助 ────────────────────────────────────────────

impl Tag {
    fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
        })
    }
}

impl Notebook {
    fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        Ok(Notebook {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            parent_id: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
        })
    }
}

impl SyncState {
    fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        Ok(SyncState {
            key: row.get(0)?,
            value: row.get(1)?,
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
        })
    }
}

impl CaptureTarget {
    fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        Ok(CaptureTarget {
            id: row.get(0)?,
            captured_item_id: row.get(1)?,
            target_type: row.get(2)?,
            target_id: row.get(3)?,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
        })
    }
}