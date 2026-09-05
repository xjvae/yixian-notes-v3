// ============================================================
// 笔记存储操作
// ============================================================

use crate::error::AppError;
use crate::models::Note;
use crate::storage::connection::HybridStorage;
use rusqlite::{params, OptionalExtension};

impl HybridStorage {
    /// 获取笔记列表（可按笔记本筛选）
    pub fn get_notes(&self, notebook_id: Option<&str>) -> Result<Vec<Note>, AppError> {
        let query = if notebook_id.is_some() {
            "SELECT id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata FROM notes WHERE notebook_id = ? ORDER BY updated_at DESC"
        } else {
            "SELECT id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata FROM notes ORDER BY updated_at DESC"
        };

        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn.prepare(query)
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare statement: {}", e)))?;

        let rows = if let Some(nid) = notebook_id {
            stmt.query_map([nid], Self::row_to_note)
        } else {
            stmt.query_map([], Self::row_to_note)
        };

        let rows = rows.map_err(|e| AppError::storage_error(&format!("Failed to query notes: {}", e)))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize note: {}", e)))?);
        }
        Ok(result)
    }

    /// 根据 ID 获取单条笔记
    pub fn get_note(&self, id: &str) -> Result<Option<Note>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .query_row(
                "SELECT id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata FROM notes WHERE id = ?",
                [id],
                Self::row_to_note,
            )
            .optional()
            .map_err(|e| AppError::storage_error(&format!("Failed to get note {}: {}", id, e)))
    }

    /// 保存笔记（插入或更新）
    pub fn save_note(&self, note: &Note) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    note.id,
                    note.title,
                    note.content,
                    note.notebook_id,
                    serde_json::to_string(&note.tags).unwrap_or_default(),
                    note.is_favorite as i32,
                    note.is_encrypted as i32,
                    note.created_at.to_rfc3339(),
                    note.updated_at.to_rfc3339(),
                    note.metadata.to_string(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save note {}: {}", note.id, e)))?;
        // 知识结构：根据内容中 [[标题]] 更新笔记双链（真实边）
        self.sync_note_links(&note.id, &note.content)?;
        Ok(())
    }

    /// 批量保存笔记（事务内一次提交，替代逐条 IPC 写入）
    pub fn save_notes_batch(&self, notes: &[Note]) -> Result<(), AppError> {
        let mut conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::storage_error(&format!("Failed to begin batch save: {e}")))?;
        for note in notes {
            tx.execute(
                "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    note.id,
                    note.title,
                    note.content,
                    note.notebook_id,
                    serde_json::to_string(&note.tags).unwrap_or_default(),
                    note.is_favorite as i32,
                    note.is_encrypted as i32,
                    note.created_at.to_rfc3339(),
                    note.updated_at.to_rfc3339(),
                    note.metadata.to_string(),
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to batch save note {}: {}", note.id, e)))?;
            // 知识结构：同一事务内重建该笔记双链
            Self::sync_note_links_tx(&tx, &note.id, &note.content)?;
            // 同一事务内全量替换 note_tags 关系，保证笔记与其标签元数据原子一致
            Self::set_note_tags_tx(&tx, &note.id, &note.tags)?;
        }
        tx.commit()
            .map_err(|e| AppError::storage_error(&format!("Failed to commit batch save: {e}")))?;
        Ok(())
    }

    /// 批量删除（物理删除）
    pub fn delete_notes(&self, ids: &[String]) -> Result<(), AppError> {
        let mut conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::storage_error(&format!("Failed to begin batch delete: {e}")))?;
        for id in ids {
            tx.execute("DELETE FROM notes WHERE id = ?", [id])
                .map_err(|e| AppError::storage_error(&format!("Failed to delete note {}: {}", id, e)))?;
        }
        tx.commit()
            .map_err(|e| AppError::storage_error(&format!("Failed to commit batch delete: {e}")))?;
        Ok(())
    }

    /// 轻量全文搜索：按标题/内容/标签 LIKE 匹配，随后在内存中过滤已删除笔记。
    /// 后续可升级为 SQLite FTS5 以获得与中文分词更适配的全文检索。
    pub fn search_notes(
        &self,
        query: &str,
        limit: i64,
        include_deleted: bool,
    ) -> Result<Vec<Note>, AppError> {
        let pattern = format!("%{}%", query.trim());
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content, notebook_id, tags, is_favorite, is_encrypted, created_at, updated_at, metadata
                 FROM notes
                 WHERE title LIKE ?1 OR content LIKE ?1 OR tags LIKE ?1
                 ORDER BY updated_at DESC LIMIT ?2",
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare search: {e}")))?;
        let rows = stmt
            .query_map(params![pattern, limit], Self::row_to_note)
            .map_err(|e| AppError::storage_error(&format!("Failed to run search: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            let note = row.map_err(|e| AppError::serialization_error(&format!("Search note row: {e}")))?;
            if !include_deleted && Self::is_note_deleted(&note) {
                continue;
            }
            result.push(note);
        }
        Ok(result)
    }

    /// 从 metadata 中读取 `isDeleted` 标志（前端 soft-delete 语义）
    fn is_note_deleted(note: &Note) -> bool {
        note.metadata
            .get("isDeleted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    /// 删除笔记
    pub fn delete_note(&self, id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM notes WHERE id = ?", [id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete note {}: {}", id, e)))?;
        Ok(())
    }

    /// 保存笔记版本快照
    pub fn save_version(&self, version: &crate::models::NoteVersion) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "INSERT INTO note_versions (id, note_id, content, title, created_at, label)
                 VALUES (?, ?, ?, ?, ?, ?)",
                params![
                    version.id,
                    version.note_id,
                    version.content,
                    version.title,
                    version.created_at.to_rfc3339(),
                    version.label,
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to save version: {}", e)))?;
        Ok(())
    }

    /// 更新版本快照内容（配合节流合并 / 里程碑更新）
    pub fn update_version(&self, version: &crate::models::NoteVersion) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute(
                "UPDATE note_versions SET content = ?, title = ?, label = ?, created_at = ?
                 WHERE id = ? AND note_id = ?",
                params![
                    version.content,
                    version.title,
                    version.label,
                    version.created_at.to_rfc3339(),
                    version.id,
                    version.note_id,
                ],
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to update version: {}", e)))?;
        Ok(())
    }

    /// 删除单条版本快照
    pub fn delete_version(&self, version_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM note_versions WHERE id = ?", [version_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to delete version {}: {}", version_id, e)))?;
        Ok(())
    }

    /// 删除某篇笔记的全部版本快照
    pub fn clear_versions(&self, note_id: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM note_versions WHERE note_id = ?", [note_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear versions for note {}: {}", note_id, e)))?;
        Ok(())
    }

    /// 获取笔记的所有历史版本
    pub fn get_versions(&self, note_id: &str) -> Result<Vec<crate::models::NoteVersion>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare("SELECT id, note_id, content, title, created_at, label FROM note_versions WHERE note_id = ? ORDER BY created_at DESC")
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare version query: {}", e)))?;

        let rows = stmt
            .query_map([note_id], |row| {
                Ok(crate::models::NoteVersion {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    content: row.get(2)?,
                    title: row.get(3)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap_or_default()
                        .with_timezone(&chrono::Utc),
                    label: row.get(5)?,
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query versions: {}", e)))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("Failed to deserialize version: {}", e)))?);
        }
        Ok(result)
    }

    /// 将数据库行转换为 Note 结构体
    fn row_to_note(row: &rusqlite::Row) -> Result<Note, rusqlite::Error> {
        let tags_str: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let metadata_str: String = row.get(9)?;
        let metadata: serde_json::Value =
            serde_json::from_str(&metadata_str).unwrap_or(serde_json::Value::Null);

        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            notebook_id: row.get(3)?,
            tags,
            is_favorite: row.get::<_, i32>(5)? != 0,
            is_encrypted: row.get::<_, i32>(6)? != 0,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                .unwrap_or_default()
                .with_timezone(&chrono::Utc),
            metadata,
        })
    }
}

// ─── 笔记双链（知识结构真实化） ─────────────────────────────
//
// 依据笔记内容中的 `[[笔记标题]]` 语料建立真实引用边，替代图谱的伪边。
// 链接目标以「标题精确匹配」解析为已存在笔记；未命中的 `[[条目]]` 视为
// 「孤儿链接」不落库（标题一旦创建，重新保存源笔记即可补上关系）。

impl HybridStorage {
    /// 解析被双链引用的标题列表：匹配 `[[...]]`，去空去重。
    fn parse_link_titles(content: &str) -> Vec<String> {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        let bytes = content.as_bytes();
        let mut i = 0;
        while i + 2 < bytes.len() {
            // 找 [[
            if bytes[i] == b'[' && bytes[i + 1] == b'[' {
                // 找对应的 ]]
                let close = content[i + 2..].find("]]");
                if let Some(rel) = close {
                    let abs = i + 2 + rel;
                    let raw = content[i + 2..abs].trim();
                    // 忽略链接别名形式 [[...|别名]]
                    let name = raw.split('|').next().unwrap_or(raw).trim();
                    if !name.is_empty() && seen.insert(name.to_string()) {
                        out.push(name.to_string());
                    }
                    i = abs + 2;
                    continue;
                }
            }
            i += 1;
        }
        out
    }

    /// 重建单条笔记的双链（非事务版，供 save_note 使用）。
    fn sync_note_links(&self, note_id: &str, content: &str) -> Result<(), AppError> {
        let titles = Self::parse_link_titles(content);
        // 清空原出边
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn
            .execute("DELETE FROM note_links WHERE note_id = ?", [note_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear note_links: {e}")))?;
        let mut ids = Vec::new();
        for t in titles {
            let id: Option<String> = conn
                .query_row(
                    "SELECT id FROM notes WHERE title = ?1 AND id != ?2 LIMIT 1",
                    [&t, note_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::storage_error(&format!("Failed to resolve link target: {e}")))?;
            if let Some(id) = id {
                ids.push(id);
            }
        }
        for tid in ids {
            conn
                .execute(
                    "INSERT OR IGNORE INTO note_links (note_id, target_note_id) VALUES (?, ?)",
                    [note_id, &tid],
                )
                .map_err(|e| AppError::storage_error(&format!("Failed to insert note_links: {e}")))?;
        }
        Ok(())
    }

    /// 重建单条笔记双链（事务版，batch 内复用同一事务）。
    fn sync_note_links_tx(
        tx: &rusqlite::Transaction<'_>,
        note_id: &str,
        content: &str,
    ) -> Result<(), AppError> {
        let titles = Self::parse_link_titles(content);
        tx.execute("DELETE FROM note_links WHERE note_id = ?", [note_id])
            .map_err(|e| AppError::storage_error(&format!("Failed to clear note_links(tx): {e}")))?;
        for t in titles {
            let id: Option<String> = tx
                .query_row(
                    "SELECT id FROM notes WHERE title = ?1 AND id != ?2 LIMIT 1",
                    [&t, note_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::storage_error(&format!("Failed to resolve link target(tx): {e}")))?;
            if let Some(id) = id {
                tx.execute(
                    "INSERT OR IGNORE INTO note_links (note_id, target_note_id) VALUES (?, ?)",
                    [note_id, &id],
                )
                .map_err(|e| AppError::storage_error(&format!("Failed to insert note_links(tx): {e}")))?;
            }
        }
        Ok(())
    }

    /// 读取全部双链真实边（图谱真实连接，去除自环）。
    pub fn get_all_note_links(&self) -> Result<Vec<crate::models::NoteLink>, AppError> {
        let conn = self.conn.lock().get().map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        let mut stmt = conn
            .prepare(
                "SELECT note_id, target_note_id FROM note_links
                 WHERE note_id != target_note_id
                 ORDER BY note_id",
            )
            .map_err(|e| AppError::storage_error(&format!("Failed to prepare note_links: {e}")))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(crate::models::NoteLink {
                    note_id: row.get(0)?,
                    target_note_id: row.get(1)?,
                })
            })
            .map_err(|e| AppError::storage_error(&format!("Failed to query note_links: {e}")))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::serialization_error(&format!("note_links row: {e}")))?);
        }
        Ok(result)
    }
}
