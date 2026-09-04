use crate::error::AppError;
use crate::models::Reminder;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>, AppError> {
    state.storage.get_reminders()
}

#[tauri::command]
pub fn save_reminder(state: State<'_, AppState>, item: Reminder) -> Result<(), AppError> {
    state.storage.save_reminder(&item)
}

#[tauri::command]
pub fn complete_reminder(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.complete_reminder(&id)
}

#[tauri::command]
pub fn delete_reminder(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.storage.delete_reminder(&id)
}

/// 创建提醒并返回已落库对象，打通「记录 → 执行」链路。
#[tauri::command]
pub fn create_reminder(
    state: State<'_, AppState>,
    title: String,
    description: Option<String>,
    remind_at: String,
    note_id: Option<String>,
    repeat: Option<String>,
) -> Result<Reminder, AppError> {
    let now = crate::storage::HybridStorage::now();
    let reminder = Reminder {
        id: crate::storage::HybridStorage::generate_id(),
        note_id,
        title,
        description,
        remind_at: chrono::DateTime::parse_from_rfc3339(&remind_at)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or(now),
        is_completed: false,
        repeat,
        created_at: now,
    };
    state.storage.save_reminder(&reminder)?;
    Ok(reminder)
}