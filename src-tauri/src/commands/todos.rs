// ============================================================
// 待办命令（计划域）
// ============================================================

use crate::error::AppError;
use crate::models::Todo;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, AppError> {
    state.storage.get_todos()
}

#[tauri::command]
pub fn save_todo(state: State<'_, AppState>, item: Todo) -> Result<(), AppError> {
    state.storage.save_todo(&item)
}

#[tauri::command]
pub fn delete_todo(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_todo(&id)
}

/// 创建待办并返回已落库对象，打通「记录 → 执行」链路。
#[tauri::command]
pub fn create_todo(
    state: State<'_, AppState>,
    title: String,
    description: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    notebook_id: Option<String>,
    related_note_id: Option<String>,
    tags: Vec<String>,
) -> Result<Todo, AppError> {
    let now = crate::storage::HybridStorage::now();
    let todo = Todo {
        id: crate::storage::HybridStorage::generate_id(),
        title,
        description,
        priority: priority.or(Some("medium".to_string())),
        status: Some("pending".to_string()),
        due_date: due_date
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
            .map(|d| d.with_timezone(&chrono::Utc)),
        notebook_id,
        related_note_id,
        tags,
        created_at: now,
        updated_at: now,
    };
    state.storage.save_todo(&todo)?;
    Ok(todo)
}