// 原生便签桌面窗口命令
// 由主窗调用：把便签参数写入临时 JSON，再以子进程(self, --desktop-sticky <json>)启动
// 独立的 eframe 原生窗口。子进程拥有自身 EventLoop/GL，崩溃不影响主应用。
use crate::egui_sticky::DesktopStickyArgs;

#[tauri::command]
pub fn open_desktop_sticky(args: DesktopStickyArgs) -> Result<(), String> {
    let json = serde_json::to_string(&args).map_err(|e| e.to_string())?;

    // 写入临时目录
    let file_name = format!(
        "yixian_desktop_sticky_{}.json",
        uuid::Uuid::new_v4().simple()
    );
    let tmp_path = std::env::temp_dir().join(file_name);
    std::fs::write(&tmp_path, json).map_err(|e| e.to_string())?;

    // 以子进程启动当前 exe（带 --desktop-sticky 参数）
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let child = std::process::Command::new(&exe)
        .args(["--desktop-sticky", tmp_path.to_str().unwrap_or("")])
        .spawn()
        .map_err(|e| e.to_string())?;

    // 避免父进程句柄堆积，尽快释放
    drop(child);
    Ok(())
}