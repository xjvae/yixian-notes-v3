use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
};

use crate::commands::window::set_lite_mode as apply_lite_mode;
use crate::state::AppState;

/// 构建系统托盘图标与菜单。
/// 依赖 Cargo.toml 中 `tauri` 开启 `tray-icon` feature。
pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let icon = app.default_window_icon().cloned();

    let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "最小化到托盘", true, None::<&str>)?;
    let new_note_i = MenuItem::with_id(app, "new-note", "新建笔记", true, None::<&str>)?;
    let clipboard_i = MenuItem::with_id(app, "clipboard", "打开剪贴板", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "settings", "打开设置", true, None::<&str>)?;
    let lite_on_i = MenuItem::with_id(app, "lite-on", "进入精简模式", true, None::<&str>)?;
    let lite_off_i = MenuItem::with_id(app, "lite-off", "退出精简模式", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_i,
            &hide_i,
            &new_note_i,
            &clipboard_i,
            &settings_i,
            &sep,
            &lite_on_i,
            &lite_off_i,
            &sep,
            &quit_i,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("一闲笔记 v3")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "hide" => hide_main_window(app),
            "new-note" => open_page(app, "/notes"),
            "clipboard" => open_page(app, "/clipboard"),
            "settings" => open_page(app, "/settings"),
            "lite-on" => toggle_lite(app, true),
            "lite-off" => toggle_lite(app, false),
            "quit" => {
                // 先销毁所有子窗口(便签/贴图等),再退出,避免 run 循环被阻塞导致退出无效
                for (_, w) in app.webview_windows() {
                    let _ = w.close();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }
    builder.build(app)?;

    Ok(())
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("yx:tray-visible", true);
    if let Some(win) = app.get_webview_window("main") {
        if win.is_minimized().unwrap_or(false) {
            let _ = win.unminimize();
        }
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("yx:tray-visible", false);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

/// 从托盘切换精简模式（复用后端 `set_lite_mode` 命令的核心逻辑）
fn toggle_lite<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    if let Some(state) = app.try_state::<AppState>() {
        let _ = apply_lite_mode(app, &state, enabled);
    } else {
        // 状态尚未就绪时回退到最基本的窗口显隐
        if enabled {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
            }
        } else if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn open_page<R: Runtime>(app: &AppHandle<R>, route: &str) {
    // 先显示主窗口，再通过 JS 修改 hash 让前端 HashRouter 跳转
    show_main_window(app);
    if let Some(win) = app.get_webview_window("main") {
        // 直接改 location.hash，HashRouter 会自动响应导航；无需依赖前端事件监听
        let _ = win.eval(&format!("window.location.hash = '{}';", route));
    }
    // 兜底：同时广播事件（供前端监听做额外处理）
    let _ = app.emit("tray:open-page", route);
}