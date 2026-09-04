use crate::error::AppError;
use crate::storage::HybridStorage;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub struct AppState {
    /// SQLite 连接池：内部 `r2d2::Pool` 自身线程安全，命令层可直接访问，无需外层 Mutex。
    pub storage: Arc<HybridStorage>,
    pub app_data_dir: PathBuf,
}

impl AppState {
    pub fn new(handle: AppHandle) -> Result<Self, AppError> {
        let app_data_dir = handle
            .path()
            .app_data_dir()
            .map_err(|e| AppError::storage_error(&format!("Failed to get app data dir: {}", e)))?;

        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| AppError::storage_error(&format!("Failed to create app data dir: {}", e)))?;

        let storage = HybridStorage::new(&app_data_dir)
            .map_err(|e| AppError::storage_error(&format!("Failed to initialize storage: {}", e)))?;

        Ok(AppState {
            storage: Arc::new(storage),
            app_data_dir,
        })
    }
}
