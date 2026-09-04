use crate::error::AppError;
use crate::state::AppState;
use parking_lot::Mutex;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

/// 浮动便签数据缓存：主窗把便签 JSON 暂存到主进程。
/// 独立窗口打开后通过命令拉取——避免注入到 WebView 脚本导致白屏。
#[derive(Default)]
pub struct FloatingPayloadCache {
    inner: Mutex<HashMap<String, String>>,
}

#[tauri::command]
pub fn set_floating_sticky_data(
    app: AppHandle,
    id: String,
    json: String,
) -> Result<(), AppError> {
    if !valid_sticky_id(&id) {
        return Err(AppError::new("WINDOW_ERROR", "非法的便笺 id"));
    }
    app.state::<FloatingPayloadCache>().inner.lock().insert(id, json);
    Ok(())
}

#[tauri::command]
pub fn get_floating_sticky_data(app: AppHandle, id: String) -> Result<Option<String>, AppError> {
    if !valid_sticky_id(&id) {
        return Ok(None);
    }
    Ok(app.state::<FloatingPayloadCache>().inner.lock().get(&id).cloned())
}

#[tauri::command]
pub fn remove_floating_sticky_data(app: AppHandle, id: String) -> Result<(), AppError> {
    if !valid_sticky_id(&id) {
        return Ok(());
    }
    app.state::<FloatingPayloadCache>().inner.lock().remove(&id);
    Ok(())
}

#[tauri::command]
pub fn create_capsule_window(app: AppHandle) -> Result<(), AppError> {
    use tauri::webview::WebviewWindowBuilder;

    let _win = WebviewWindowBuilder::new(&app, "capsule", tauri::WebviewUrl::App("capsule.html".into()))
        .title("Capsule")
        .inner_size(300.0, 400.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .visible(true)
        .build()
        .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to create capsule window: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub fn close_capsule_window(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("capsule") {
        win.close()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to close capsule window: {}", e)))?;
    }
    Ok(())
}

const STICKY_WIN_PREFIX: &str = "sticky-";

fn valid_sticky_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// 创建浮动便签独立窗口（label: `sticky-{id}`，index.tsx 据此渲染 FloatingStickyWindow）
#[tauri::command]
// 参考仓库（sticky_window.rs）：此命令必须为 async。
// 同步执行会在构建 WebView2 时阻塞主线程/IPC，从而导致主窗口所有按钮无法点击「冻结」。
pub async fn create_floating_sticky(
    app: AppHandle,
    id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    always_on_top: Option<bool>,
    workspace_id: Option<String>,
) -> Result<(), AppError> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if !valid_sticky_id(&id) {
        return Err(AppError::new("WINDOW_ERROR", "非法的便笺 id"));
    }
    let label = format!("{}{}", STICKY_WIN_PREFIX, id);

    // 参考仓库（sticky_window.rs）的做法：
    // 窗口统一加载 index.html，前端按窗口 label(sticky-*) 分流渲染便签 UI。
    // 仅注入便签 id 与工作区 id（短字符串，安全），不注入完整数据。
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let id_json = serde_json::to_string(&id).unwrap_or_default();
    let ws_json = serde_json::to_string(&workspace_id).unwrap_or_else(|_| "null".into());
    let init_script = format!(
        "window.__STICKY_ID__ = {}; window.__STICKY_WS__ = {};",
        id_json, ws_json
    );

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("便签")
        .inner_size(w.max(220.0), h.max(200.0))
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .always_on_top(always_on_top.unwrap_or(true))
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .visible(true)
        .initialization_script(&init_script)
        .build()
        .map_err(|e| AppError::new("WINDOW_ERROR", &format!("创建便签窗口失败: {e}")))?;

    Ok(())
}

const QUADRANT_WIN_PREFIX: &str = "quadrant-";

/// 创建“钉在桌面”的四象限独立窗口（label: `quadrant-{workspaceId}`）。
/// 窗口加载 index.html，前端按窗口 label(quadrant-*) 分流渲染 FloatingQuadrantWindow，
/// 并注入工作区 id 以便定位该工作区的四象限数据（localStorage 同源多窗共享）。
#[tauri::command]
pub async fn create_floating_quadrant(
    app: AppHandle,
    workspace_id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    always_on_top: Option<bool>,
) -> Result<(), AppError> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if !valid_sticky_id(&workspace_id) {
        return Err(AppError::new(
            "WINDOW_ERROR",
            "非法的四象限窗口工作区 id",
        ));
    }
    let label = format!("{}{}", QUADRANT_WIN_PREFIX, workspace_id);

    // 已有同名窗口则聚焦而非重复创建
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let ws_json = serde_json::to_string(&workspace_id).unwrap_or_else(|_| "null".into());
    let init_script = format!("window.__QUADRANT_WS__ = {};", ws_json);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("四象限")
        .inner_size(w.max(520.0), h.max(400.0))
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .always_on_top(always_on_top.unwrap_or(true))
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .visible(true)
        .initialization_script(&init_script)
        .build()
        .map_err(|e| AppError::new("WINDOW_ERROR", &format!("创建四象限窗口失败: {e}")))?;

    Ok(())
}

/// 关闭“钉在桌面”的四象限独立窗口
#[tauri::command]
pub fn close_floating_quadrant(app: AppHandle, workspace_id: String) -> Result<(), AppError> {
    if !valid_sticky_id(&workspace_id) {
        return Err(AppError::new(
            "WINDOW_ERROR",
            "非法的四象限窗口工作区 id",
        ));
    }
    let label = format!("{}{}", QUADRANT_WIN_PREFIX, workspace_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.close()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("关闭四象限窗口失败: {e}")))?;
    }
    Ok(())
}

/// 关闭浮动便签独立窗口
#[tauri::command]
pub fn close_floating_sticky(app: AppHandle, id: String) -> Result<(), AppError> {
    if !valid_sticky_id(&id) {
        return Err(AppError::new("WINDOW_ERROR", "非法的便笺 id"));
    }
    let label = format!("{}{}", STICKY_WIN_PREFIX, id);
    if let Some(win) = app.get_webview_window(&label) {
        win.close()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("关闭便签窗口失败: {e}")))?;
    }
    Ok(())
}

#[tauri::command]
pub fn minimize_to_tray(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to hide main window: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_minimized().unwrap_or(false) {
            win.unminimize()
                .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to unminimize main window: {}", e)))?;
        }
        win.show()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to show main window: {}", e)))?;
        win.set_focus()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to focus main window: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_main_window_visible(app: AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or_default()
}

/// 切换精简模式：持久化状态、隐藏/显示主窗口、广播事件供前端同步。
/// 精简模式 = 只保留系统托盘 + 浮动便签窗口，隐藏完整主窗口。
///
/// 作为自由函数暴露，供 Tauri 命令 `set_lite_mode` 与系统托盘菜单共同调用。
pub fn set_lite_mode<R: tauri::Runtime>(app: &AppHandle<R>, state: &AppState, enabled: bool) -> Result<(), AppError> {
    state.storage.set_setting("lite_mode", if enabled { "1" } else { "0" })?;

    if enabled {
        if let Some(win) = app.get_webview_window("main") {
            win.hide()
                .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to hide main window: {}", e)))?;
        }
    } else {
        if let Some(win) = app.get_webview_window("main") {
            if win.is_minimized().unwrap_or(false) {
                win.unminimize()
                    .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to unminimize main window: {}", e)))?;
            }
            win.show()
                .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to show main window: {}", e)))?;
            win.set_focus()
                .map_err(|e| AppError::new("WINDOW_ERROR", &format!("Failed to focus main window: {}", e)))?;
        }
    }

    // 广播给前端：切换到相应 UI 反馈（浮动便签、设置开关等同步状态）
    let _ = app.emit("yx:lite-mode-changed", enabled);
    Ok(())
}

#[tauri::command]
pub fn set_lite_mode_cmd(app: AppHandle, state: State<'_, AppState>, enabled: bool) -> Result<(), AppError> {
    set_lite_mode(&app, &state, enabled)
}