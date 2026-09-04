use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub is_encrypted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteVersion {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyNote {
    pub id: String,
    pub content: String,
    pub color: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_pinned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub image_path: Option<String>,
    #[serde(default)]
    pub image_width: Option<u32>,
    #[serde(default)]
    pub image_height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub note_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub remind_at: DateTime<Utc>,
    pub is_completed: bool,
    pub repeat: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// 待办（计划域）：对应 `todos` 表。`related_note_id` 打通「笔记 → 待办」执行链路。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub notebook_id: Option<String>,
    pub related_note_id: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub font_size: i32,
    pub auto_save: bool,
    pub auto_save_interval: i32,
    pub webdav_url: Option<String>,
    pub webdav_username: Option<String>,
    pub webdav_password: Option<String>,
    pub backup_enabled: bool,
    pub backup_interval: i32,
    pub encryption_enabled: bool,
    pub global_shortcut: Option<String>,
    // 全局快捷键（独立置顶小窗 / 双击）：action -> 绑定
    pub global_shortcuts: Vec<GlobalShortcutBinding>,
    // 精简模式：只显示系统托盘与浮动便签（持久化，重启后保持）
    pub lite_mode: bool,
}

/// 单个全局快捷键绑定。
/// `key` 取值：普通组合键（如 "Ctrl+Shift+N"）；"DoubleCtrl" 表示双击 Ctrl。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalShortcutBinding {
    pub action: String,
    pub key: String,
    pub enabled: bool,
}

/// 全局快捷键默认配置（动作 → 默认键）
impl GlobalShortcutBinding {
    pub fn defaults() -> Vec<GlobalShortcutBinding> {
        vec![
            GlobalShortcutBinding { action: "local-search".into(), key: "DoubleCtrl".into(), enabled: true },
            GlobalShortcutBinding { action: "new-note".into(), key: "Ctrl+Shift+N".into(), enabled: true },
            GlobalShortcutBinding { action: "quick-open".into(), key: "Ctrl+Shift+P".into(), enabled: true },
            GlobalShortcutBinding { action: "clipboard".into(), key: "Ctrl+Shift+V".into(), enabled: true },
        ]
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            theme: "system".to_string(),
            language: "zh-CN".to_string(),
            font_size: 14,
            auto_save: true,
            auto_save_interval: 30,
            webdav_url: None,
            webdav_username: None,
            webdav_password: None,
            backup_enabled: false,
            backup_interval: 24,
            encryption_enabled: false,
            global_shortcut: Some("CmdOrCtrl+Shift+N".to_string()),
            global_shortcuts: GlobalShortcutBinding::defaults(),
            lite_mode: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub encrypted_data: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Drawing {
    pub id: String,
    pub title: String,
    pub data: String,
    pub width: i32,
    pub height: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

/// 笔记双链（知识结构真实化）：`note_id` 笔记的内容中引用了 `target_note_id` 笔记。
/// 对应 `note_links` 表，图 / 图谱 / Wiki 反链据此渲染真实关系，替代伪边。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteLink {
    pub note_id: String,
    pub target_note_id: String,
}

/// 采集项：剪贴板 / OCR / 导入 的统一落点，对应 `captured_items` 表。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedItem {
    pub id: String,
    pub source: String,
    pub kind: String,
    pub content: String,
    pub preview: String,
    pub status: String,
    pub processed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub targets: Vec<CaptureTarget>,
}

/// 采集处理目标：记录采集项被转成笔记 / 待办 / 提醒后的去向。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureTarget {
    pub id: String,
    pub captured_item_id: String,
    pub target_type: String,
    pub target_id: String,
    pub created_at: DateTime<Utc>,
}

/// 跨对象搜索命中条目（阶段2：跨对象检索的统一下游）。
/// `source` ∈ note / todo / captured / tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossHit {
    pub source: String,
    pub object_id: String,
    pub title: String,
    pub snippet: String,
    pub sort_key: String,
}

/// 备份记录（阶段3：备份恢复基础能力——每次备份落一条可追溯元数据）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: i64,
    pub created_at: String,
}
