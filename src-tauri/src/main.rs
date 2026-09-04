// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let is_desktop_sticky = std::env::args().any(|a| a == "--desktop-sticky");
    if is_desktop_sticky {
        // 桌面便签子进程：独立运行 eframe 原生窗口（独立 EventLoop/GL，不碰 Tauri）
        yixian_notes_v3_lib::desktop_sticky_subprocess_main();
        return;
    }
    yixian_notes_v3_lib::run()
}