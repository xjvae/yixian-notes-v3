mod commands;
mod egui_sticky;
mod error;
mod globalkeys;
mod models;
mod state;
mod storage;
mod tray;
mod watcher;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = AppState::new(handle)?;
            app.manage(state);
            // 浮动便签子窗口数据缓存
            app.manage(commands::window::FloatingPayloadCache::default());

            // Initialize file watcher
            watcher::init(app.handle().clone());

            // Initialize system tray
            tray::build_tray(app.handle())?;

            // 全局快捷键：桌面上"连按两次 Ctrl"唤起主窗口并弹出本地搜索
            globalkeys::init(app.handle().clone());
            // 全局组合快捷键：Ctrl+Shift+N 新建笔记 / Ctrl+Shift+P 快速打开 / Ctrl+Shift+V 剪贴板
            globalkeys::register_system_shortcuts(app.handle());

            // 关闭主窗口时最小化到托盘（而非退出），真正退出走托盘菜单「退出」
            if let Some(main_win) = app.get_webview_window("main") {
                let handle = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = handle.hide();
                    }
                });
            }

            // 若上次处于精简模式，启动时保持隐藏主窗口（只留托盘 + 浮动便签）
            let app_state = app.state::<AppState>();
            if let Ok(settings) = app_state.storage.get_all_settings() {
                if settings.lite_mode {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.hide();
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::get_notes,
            commands::notes::get_note,
            commands::notes::save_note,
            commands::notes::delete_note,
            commands::notes::get_note_versions,
            commands::notes::restore_version,
            commands::notes::save_note_version,
            commands::notes::update_version,
            commands::notes::delete_version,
            commands::notes::clear_versions,
            commands::notes::save_notes_batch,
            commands::notes::create_note,
            commands::notes::delete_notes,
            commands::notes::search_notes,
            commands::notes::get_all_note_links,
            // Object system (tags / notebooks / sync state)
            commands::objects::get_tags,
            commands::objects::save_tag,
            commands::objects::rename_tag,
            commands::objects::delete_tag,
            commands::objects::merge_tags,
            commands::objects::set_note_tags,
            commands::objects::get_notebooks,
            commands::objects::save_notebook,
            commands::objects::delete_notebook,
            commands::objects::get_sync_state,
            commands::objects::get_all_sync_states,
            commands::objects::put_sync_state,
            commands::objects::cross_search,
            // Resources (captured items)
            commands::resources::get_captured_items,
            commands::resources::save_captured_item,
            commands::resources::delete_captured_item,
            // Todo (plan domain)
            commands::todos::get_todos,
            commands::todos::save_todo,
            commands::todos::delete_todo,
            commands::todos::create_todo,
            // Reminder (plan domain)
            commands::reminders::get_reminders,
            commands::reminders::save_reminder,
            commands::reminders::complete_reminder,
            commands::reminders::create_reminder,
            commands::reminders::delete_reminder,
            // Sticky notes commands
            commands::stickies::get_stickies,
            commands::stickies::save_sticky,
            commands::stickies::delete_sticky,
            // Clipboard commands
            commands::clipboard::get_clipboard_history,
            commands::clipboard::add_clipboard_entry,
            commands::clipboard::clear_clipboard_history,
            commands::clipboard::clipboard_write_text,
            commands::clipboard::clipboard_read_text,
            commands::clipboard::clipboard_write_image,
            commands::clipboard::clipboard_read_image,
            commands::clipboard::save_clipboard_image_to_file,
            commands::clipboard::clipboard_open_file,
            commands::clipboard::clipboard_open_file_location,
            commands::clipboard::clipboard_read_local_image,
            commands::clipboard::clipboard_delete_local_image,
            commands::clipboard::clipboard_start_listener,
            commands::clipboard::clipboard_listener_status,
            commands::clipboard::clipboard_inspect,
            commands::clipboard::clipboard_read_image_png,
            commands::clipboard::clipboard_ocr_image,
            commands::clipboard::clipboard_pin_image,
            commands::clipboard::clipboard_pin_text,
            commands::clipboard::clipboard_get_pin_path,
            commands::clipboard::clipboard_unpin_image,
            commands::clipboard::clipboard_set_pin_opacity,
            commands::clipboard::clipboard_register_shortcut,
            commands::clipboard::clipboard_unregister_shortcut,
            // 原生便签桌面窗口（eframe，不含 WebView）
            commands::egui_sticky::open_desktop_sticky,
            // File operations
            commands::files::export_note,
            commands::files::local_search,
            commands::files::open_local_file,
            commands::files::reveal_local_file,
            commands::files::save_text_file,
            commands::files::pick_search_folder,
            commands::files::pick_save_file,
            commands::notes::import_note,
            commands::backup::create_backup,
            commands::backup::restore_backup,
            commands::backup::list_backups,
            commands::backup::delete_backup,
            // Drawings
            commands::drawings::get_drawings,
            commands::drawings::save_drawing,
            commands::drawings::delete_drawing,
            // Vault
            commands::vault::get_vault_items,
            commands::vault::save_vault_item,
            commands::vault::delete_vault_item,
            // Settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::patch_settings,
            // Window commands
            commands::window::create_capsule_window,
            commands::window::close_capsule_window,
            commands::window::create_floating_sticky,
            commands::window::close_floating_sticky,
            commands::window::create_floating_quadrant,
            commands::window::close_floating_quadrant,
            commands::window::set_floating_sticky_data,
            commands::window::get_floating_sticky_data,
            commands::window::remove_floating_sticky_data,
            commands::window::minimize_to_tray,
            commands::window::show_main_window,
            commands::window::is_main_window_visible,
            commands::window::set_lite_mode_cmd,
            // Global popups (standalone floating windows)
            commands::popup::open_global_popup,
            commands::popup::close_global_popup,
            commands::popup::get_global_popup_action,
            globalkeys::apply_global_shortcuts,
            commands::app::restart_app,
            commands::app::check_single_instance,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 桌面便签子进程入口（eframe，不含 WebView）。由 main.rs 在检测到
/// `--desktop-sticky` 参数时调用，避免与 Tauri 主进程的 EventLoop 冲突。
pub fn desktop_sticky_subprocess_main() {
    egui_sticky::run_desktop_main();
}
