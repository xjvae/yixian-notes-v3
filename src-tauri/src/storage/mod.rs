// ============================================================
// Storage 模块 - 按业务领域拆分的持久化层
// ============================================================

pub mod clipboard;
pub mod connection;
pub mod drawings;
pub mod notes;
pub mod objects;
pub mod reminders;
pub mod settings;
pub mod stickies;
pub mod todos;
pub mod vault;
pub mod backup;

// 重新导出主要类型
pub use connection::HybridStorage;
