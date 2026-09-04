use serde::Serialize;
use std::fmt;

/// 应用统一错误类型
/// 使用 struct 设计，便于序列化为 JSON 并传递给前端
#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,
}

impl AppError {
    pub fn new(code: &str, message: &str) -> Self {
        AppError {
            code: code.to_string(),
            message: message.to_string(),
            resource: None,
        }
    }

    pub fn storage_error(msg: &str) -> Self {
        Self::new("STORAGE_ERROR", msg)
    }

    pub fn crypto_error(msg: &str) -> Self {
        Self::new("CRYPTO_ERROR", msg)
    }

    pub fn not_found(resource: &str) -> Self {
        Self::new("NOT_FOUND", &format!("{resource} not found"))
    }

    pub fn validation_error(msg: &str) -> Self {
        Self::new("VALIDATION_ERROR", msg)
    }

    pub fn serialization_error(msg: &str) -> Self {
        Self::new("SERIALIZATION_ERROR", msg)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.resource {
            Some(res) => write!(f, "[{}] {} (resource: {})", self.code, self.message, res),
            None => write!(f, "[{}] {}", self.code, self.message),
        }
    }
}

impl std::error::Error for AppError {}

// === From 实现，便于错误转换 ===

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::storage_error(&err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::serialization_error(&err.to_string())
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(err: base64::DecodeError) -> Self {
        AppError::crypto_error(&format!("Base64 decode error: {}", err))
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::storage_error(&format!("SQLite error: {}", err))
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::new("UNKNOWN_ERROR", &msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::new("UNKNOWN_ERROR", msg)
    }
}

/// 日志记录并转换错误为 AppError
#[macro_export]
macro_rules! log_and_err {
    ($code:expr, $msg:expr) => {{
        let err = AppError::new($code, $msg);
        tracing::error!("{}", err);
        Err(err)
    }};
    ($code:expr, $fmt:expr, $($arg:tt)*) => {{
        let msg = format!($fmt, $($arg)*);
        let err = AppError::new($code, &msg);
        tracing::error!("{}", err);
        Err(err)
    }};
}
