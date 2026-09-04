// ============================================================
// 数据库连接和初始化
// ============================================================

use crate::error::AppError;
use r2d2::Pool;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// SQLite 连接管理器：为 r2d2 连接池提供 `rusqlite::Connection`。
///
/// 不直接引入 `r2d2_sqlite`：其依赖的 rusqlite 版本与当前（0.32）不符，
/// 双版本会触发 `libsqlite3-sys`（links=sqlite3）单例冲突导致链接失败。
/// 此处用自定义 `ManageConnection` 直接托管 rusqlite 连接，开连接时应用必要 PRAGMA。
#[derive(Clone)]
pub struct SqliteConnectionManager {
    db_path: PathBuf,
}

impl SqliteConnectionManager {
    pub fn new(db_path: PathBuf) -> Self {
        SqliteConnectionManager { db_path }
    }
}

impl r2d2::ManageConnection for SqliteConnectionManager {
    type Connection = Connection;
    type Error = rusqlite::Error;

    fn connect(&self) -> Result<Connection, rusqlite::Error> {
        let conn = Connection::open(&self.db_path)?;
        // 连接级优化：
        // - WAL：读写并发更友好，崩溃恢复更稳；
        // - busy_timeout：并发命令时等待而非立即失败；
        // - foreign_keys：真正启用 schema 中声明的外键级联约束。
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "foreign_keys", 1)?;
        Ok(conn)
    }

    fn is_valid(&self, conn: &mut Connection) -> Result<(), rusqlite::Error> {
        conn.query_row("SELECT 1", [], |_| Ok(())).map(|_| ())
    }

    fn has_broken(&self, _conn: &mut Connection) -> bool {
        false
    }
}

/// 混合存储结构体（SQLite 连接池 + 文件系统）
pub struct HybridStorage {
    /// SQLite 连接池：多线程命令可从池中借出独立连接，避免单一连接串行化。
    /// 用 `Mutex` 包装允许在备份恢复后重建连接池（r2d2 0.8 的 Pool 无 reset_all）。
    pub conn: parking_lot::Mutex<Pool<SqliteConnectionManager>>,
    /// 数据库文件绝对路径，供 `reopen` 重建连接池使用。
    db_path: PathBuf,
}

impl HybridStorage {
    /// 创建新的存储实例：初始化连接池与表结构。
    pub fn new(data_dir: &Path) -> Result<Self, AppError> {
        let db_path = data_dir.join("yixian.db");
        let pool = Self::build_pool(&db_path)?;

        let mut storage = HybridStorage {
            conn: parking_lot::Mutex::new(pool),
            db_path,
        };
        storage.migrate()?;
        Ok(storage)
    }

    /// 依据数据库路径构建连接池。
    fn build_pool(db_path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
        let manager = SqliteConnectionManager::new(db_path.to_path_buf());
        Pool::builder()
            .max_size(8)
            .min_idle(Some(1))
            .connection_timeout(Duration::from_secs(5))
            .build(manager)
            .map_err(|e| AppError::storage_error(&format!("Failed to build sqlite pool: {}", e)))
    }

    /// 读取当前 schema 版本（从池中借用一个连接）
    fn current_version(&self) -> Result<i64, AppError> {
        let conn = self
            .conn
            .lock()
            .get()
            .map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
        conn.query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|e| AppError::storage_error(&format!("Failed to read user_version: {}", e)))
    }

    /// 顺序执行尚未应用的迁移，并维护 `user_version`。
    /// 每条迁移在池中同一连接上以事务方式完成并提交。
    fn migrate(&mut self) -> Result<(), AppError> {
        for (version, applied) in [
            (1, Self::migrate_baseline as fn(&Connection) -> rusqlite::Result<()>),
            (2, Self::migrate_add_image_columns),
            (3, Self::migrate_add_object_system),
        ] {
            if self.current_version()? >= version {
                continue;
            }
            let mut conn = self
                .conn
                .lock()
                .get()
                .map_err(|e| AppError::storage_error(&format!("Failed to get connection: {}", e)))?;
            let tx = conn
                .transaction()
                .map_err(|e| AppError::storage_error(&format!("Failed to start migration tx: {}", e)))?;
            applied(&tx).map_err(|e| AppError::storage_error(&format!("Migration {version}: {e}")))?;
            tx.pragma_update(None, "user_version", version)
                .and_then(|_| tx.commit())
                .map_err(|e| AppError::storage_error(&format!("Failed to commit migration {version}: {e}")))?;
        }
        Ok(())
    }

    /// V1：初始表结构与索引
    fn migrate_baseline(conn: &Connection) -> rusqlite::Result<()> {
        let sql = vec![
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT DEFAULT '',
                notebook_id TEXT,
                tags TEXT DEFAULT '[]',
                is_favorite INTEGER DEFAULT 0,
                is_encrypted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                metadata TEXT DEFAULT '{}'
            )",
            "CREATE TABLE IF NOT EXISTS note_versions (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                content TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                label TEXT,
                FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
            )",
            "CREATE TABLE IF NOT EXISTS notebooks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                parent_id TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS sticky_notes (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                color TEXT DEFAULT '#FEF08A',
                x REAL DEFAULT 100,
                y REAL DEFAULT 100,
                width REAL DEFAULT 200,
                height REAL DEFAULT 200,
                is_pinned INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS clipboard_history (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                content_type TEXT DEFAULT 'text',
                created_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                note_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                remind_at TEXT NOT NULL,
                is_completed INTEGER DEFAULT 0,
                repeat TEXT,
                created_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS vault_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                encrypted_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS drawings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                data TEXT NOT NULL,
                width INTEGER DEFAULT 800,
                height INTEGER DEFAULT 600,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            "CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id)",
            "CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_versions_note ON note_versions(note_id, created_at DESC)",
        ];
        for s in &sql {
            conn.execute(s, [])?;
        }
        Ok(())
    }

    /// V2：为已存在的 clipboard_history 表补充图片相关列（幂等）
    fn migrate_add_image_columns(conn: &Connection) -> rusqlite::Result<()> {
        let columns = ["image_path", "image_width", "image_height"];
        for col in &columns {
            let sql = format!(
                "ALTER TABLE clipboard_history ADD COLUMN {} {}",
                col,
                match *col {
                    "image_path" => "TEXT",
                    "image_width" | "image_height" => "INTEGER",
                    _ => "TEXT",
                }
            );
            // 忽略列已存在的错误
            let _ = conn.execute(&sql, []);
        }
        Ok(())
    }

    /// V3：统一对象系统 — 标签、待办、附件、采集项、同步状态与关系表。
    /// 为「笔记→标签/待办/提醒/附件/采集」建立正式的关系建模，
    /// 并引入 `sync_state` 作为 WebDAV 增量同步与脏状态的基础。
    fn migrate_add_object_system(conn: &Connection) -> rusqlite::Result<()> {
        let sql = vec![
            "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT,
                created_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            // 待办：与笔记建立可空关系，打通「记录 → 执行」链路
            "CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                due_date TEXT,
                notebook_id TEXT,
                related_note_id TEXT,
                tags TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(related_note_id) REFERENCES notes(id) ON DELETE SET NULL
            )",
            "CREATE TABLE IF NOT EXISTS note_links (
                note_id TEXT NOT NULL,
                target_note_id TEXT NOT NULL,
                PRIMARY KEY (note_id, target_note_id),
                FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY(target_note_id) REFERENCES notes(id) ON DELETE CASCADE
            )",
            // 采集项：剪贴板 / OCR / 导入 的统一落点
            "CREATE TABLE IF NOT EXISTS captured_items (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                kind TEXT NOT NULL,
                content TEXT DEFAULT '',
                preview TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                processed_at TEXT,
                created_at TEXT NOT NULL
            )",
            // 采集处理目标（转笔记/待办/提醒后记录去向）
            "CREATE TABLE IF NOT EXISTS capture_targets (
                id TEXT PRIMARY KEY,
                captured_item_id TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(captured_item_id) REFERENCES captured_items(id) ON DELETE CASCADE
            )",
            // 同步状态（WebDAV 增量同步 / 同步记账 / 冲突标记）
            "CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS backup_records (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                size INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )",
            "CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id)",
            "CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)",
            "CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date)",
            "CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(related_note_id)",
            "CREATE INDEX IF NOT EXISTS idx_captured_status ON captured_items(status)",
            "CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at)",
            "CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id)",
            "CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id)",
            "CREATE INDEX IF NOT EXISTS idx_capture_targets_item ON capture_targets(captured_item_id)",
        ];
        for s in &sql {
            conn.execute(s, [])?;
        }
        Ok(())
    }

    /// 生成 UUID v4
    pub fn generate_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// 获取当前 UTC 时间
    pub fn now() -> chrono::DateTime<chrono::Utc> {
        chrono::Utc::now()
    }

    /// 恢复备份后重建数据库连接池，使之后借出的连接指向磁盘上覆盖后的新数据。
    /// 旧的 Pool 被整体替换（旧连接随之 drop），确保不再读到被覆盖前的旧页缓存。
    pub fn reopen(&self) -> Result<(), AppError> {
        let new_pool = Self::build_pool(&self.db_path)?;
        *self.conn.lock() = new_pool;
        Ok(())
    }
}
