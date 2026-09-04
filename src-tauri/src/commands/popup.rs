// ============================================================
// popup — 全局弹窗（独立无边框置顶小窗，不唤起主窗口）
//
// 供全局快捷键（双击 Ctrl 本地搜索 / Ctrl+Shift+N 新建笔记 /
// Ctrl+Shift+P 快速打开 / Ctrl+Shift+V 剪贴板）在任意应用上
// 弹出对应 UI，而无需显示完整主窗口。
//
// 复用单一窗口 label `ym-popup`，加载 popup.html。
// 注意：窗口 Webview 刚创建时前端事件监听可能尚未就绪，直接 emit
// 会丢失首帧动作；因此用"当前 action 静态量 + 前端主动读取命令"
// 来保证初始渲染正确，事件仅用于切换已存在窗口的内容。
// ============================================================
use crate::error::AppError;
use std::sync::atomic::{AtomicU8, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

fn action_id(action: &str) -> u8 {
    match action {
        "local-search" => 0,
        "new-note" => 1,
        "quick-open" => 2,
        "clipboard" => 3,
        _ => 0,
    }
}

fn action_str(id: u8) -> &'static str {
    match id {
        1 => "new-note",
        2 => "quick-open",
        3 => "clipboard",
        _ => "local-search",
    }
}

/// 当前弹窗应展示的 action（无论窗口是否已创建，均正确反映最近一次请求）。
static CURRENT_ACTION: AtomicU8 = AtomicU8::new(0);

fn popup_size(action: &str) -> (f64, f64) {
    match action {
        "local-search" => (640.0, 480.0),
        "new-note" => (460.0, 340.0),
        "quick-open" => (520.0, 430.0),
        "clipboard" => (540.0, 460.0),
        _ => (520.0, 430.0),
    }
}

/// 打开/切换到全局弹窗并注入 action。（快捷键回调与命令共用）
pub fn open_popup(app: &tauri::AppHandle, action: &str) -> Result<(), AppError> {
    let (w, h) = popup_size(action);
    CURRENT_ACTION.store(action_id(action), Ordering::Relaxed);

    if let Some(win) = app.get_webview_window("global-popup") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.set_size(tauri::LogicalSize::new(w, h));
        let _ = win.center();
        // 已存在的窗口：前端已就绪，可通过事件即时切换
        let _ = win.emit("popup:action", action);
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "global-popup", WebviewUrl::App("popup.html".into()))
        .title("一闲笔记")
        .inner_size(w, h)
        .center()
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(true)
        .build()
        .map_err(|e| AppError::new("WINDOW_ERROR", &format!("创建全局弹窗失败: {e}")))?;

    Ok(())
}

/// 前端挂载时读取当前 action，避免因 Webview 未就绪丢失初始化事件。
#[tauri::command]
pub fn get_global_popup_action() -> String {
    action_str(CURRENT_ACTION.load(Ordering::Relaxed)).to_string()
}

#[tauri::command]
pub fn open_global_popup(app: AppHandle, action: String) -> Result<(), AppError> {
    open_popup(&app, &action)
}

#[tauri::command]
pub fn close_global_popup(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("global-popup") {
        win.close()
            .map_err(|e| AppError::new("WINDOW_ERROR", &format!("关闭弹窗失败: {e}")))?;
    }
    Ok(())
}