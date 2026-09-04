// ============================================================
// globalkeys — 全局快捷键（在应用外仍生效）
//
// 组合键 Ctrl+Shift+N / Ctrl+Shift+P / Ctrl+Shift+V 分别弹出
// 新建笔记 / 快速打开 / 剪贴板独立小窗（由 tauri-plugin-global-shortcut 注册）。
//
// "双击 Ctrl" 打开本地搜索：采用 GetAsyncKeyState 轮询方式检测，而
// 不使用 WH_KEYBOARD_LL 低级键盘钩子——因为低层钩子常被安全软件/系统
// 策略拦截而静默失效（表现为"组合键正常、双击无反应"）。轮询只读取
// 系统击键状态，不安装任何钩子，故更健壮可靠。
// ============================================================
use std::sync::Mutex;
use std::time::{Duration, SystemTime};
use tauri::Manager;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL,
};

/// 当前已注册的全局组合快捷键（供"重新注册"时清理）。
static REGISTERED: Mutex<Vec<tauri_plugin_global_shortcut::Shortcut>> =
    Mutex::new(Vec::new());

/// 合并设置里的绑定：返回给定 action 是否应使用"双击 Ctrl"轮询触发本地搜索。
fn use_ctrl_double() -> bool {
    local_search_binding().map(|b| b.enabled && b.key == "DoubleCtrl").unwrap_or(true)
}

fn local_search_binding() -> Option<crate::models::GlobalShortcutBinding> {
    APP.with(|cell| {
        let app = cell.borrow().clone()?;
        let state = app.state::<crate::state::AppState>();
        let settings = state.storage.get_all_settings().ok()?;
        settings.global_shortcuts.iter().find(|b| b.action == "local-search").cloned()
    })
}

/// 双击判定窗口：两次 Ctrl 输入事件的时间间隔在此时长内视为"连按两次"
const DOUBLE_WINDOW_MS: u128 = 400;
/// 轮询间隔（毫秒）：越小越灵敏，但增加 CPU；10ms 左右足够
const POLL_INTERVAL_MS: u64 = 10;

thread_local! {
    static APP: std::cell::RefCell<Option<tauri::AppHandle>> = const { std::cell::RefCell::new(None) };
    static LAST_PRESS_MS: std::cell::Cell<u128> = const { std::cell::Cell::new(0) };
}

/// 启动全局"双击 Ctrl"监听（独立轮询线程）。
pub fn init(app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("globalkey-poll".into())
        .spawn(move || poll_loop(app))
        .expect("failed to start global ctrl poll thread");
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn poll_loop(app: tauri::AppHandle) {
    APP.with(|cell| *cell.borrow_mut() = Some(app.clone()));

    let mut pressed = false;
    loop {
        // 读取 Ctrl 当前按下状态（GetAsyncKeyState 返回 SHORT，bit15=1 表示按下）
        let is_down =
            unsafe { (GetAsyncKeyState(VK_CONTROL.0 as i32) as i16 as u16 & 0x8000) != 0 };

        // 检测 Ctrl 的"上升沿"：由未按下 → 按下
        if is_down && !pressed {
            let t = now_ms();
            let prev = LAST_PRESS_MS.with(|c| c.replace(t));
            if prev != 0 && t.saturating_sub(prev) <= DOUBLE_WINDOW_MS {
                // 连按两次 Ctrl → 复位并触发本地搜索
                LAST_PRESS_MS.with(|c| c.set(0));
                trigger();
            }
        }
        pressed = is_down;
        std::thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
    }
}

fn trigger() {
    // 仅当本地搜索仍绑定为"双击 Ctrl"且启用时才响应轮询双击
    if !use_ctrl_double() {
        return;
    }
    let app = APP.with(|cell| cell.borrow().clone());
    let Some(app) = app else { return };
    // 轮询线程不是 Tauri 主线程，窗口需切到主线程创建，避免调度冲突。
    // 双击 Ctrl → 弹出本地搜索独立小窗（不唤起主窗口）
    let _ = app.clone().run_on_main_thread(move || {
        let _ = crate::commands::popup::open_popup(&app, "local-search");
    });
}

/// 注册系统级全局组合快捷键（应用外也能触发）。
/// 启动时用默认绑定（冷启动即生效）；随后前端加载用户配置后调用
/// `apply_global_shortcuts` 精确覆盖。"DoubleCtrl" 仅用于本地搜索（轮询线程）。
pub fn register_system_shortcuts(app: &tauri::AppHandle) {
    apply_map(app, &crate::models::GlobalShortcutBinding::defaults());
}

/// 应用一组全局快捷键（设置页改键 / 启停后调用，无需重启进程）。
/// 前端以其存储的用户配置为基准调用本命令。
#[tauri::command]
pub fn apply_global_shortcuts(
    app: tauri::AppHandle,
    shortcuts: Vec<crate::models::GlobalShortcutBinding>,
) -> Result<(), crate::error::AppError> {
    apply_map(&app, &shortcuts);
    Ok(())
}

fn apply_map(app: &tauri::AppHandle, shortcuts: &[crate::models::GlobalShortcutBinding]) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    // 先清理已注册的旧快捷键
    unregister_all(app);

    for binding in shortcuts {
        if !binding.enabled || binding.key.is_empty() || binding.key == "DoubleCtrl" {
            continue; // 双击走轮询线程；禁用项跳过
        }
        let Ok(shortcut) = binding.key.parse::<Shortcut>() else { continue };
        let action = binding.action.clone();
        let Ok(()) = app.global_shortcut().on_shortcut(shortcut, move |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = crate::commands::popup::open_popup(app, &action);
            }
        }) else { continue };
        if let Ok(mut reg) = REGISTERED.lock() {
            reg.push(shortcut);
        }
    }
}

fn unregister_all(app: &tauri::AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
    let to_unregister: Vec<Shortcut> = REGISTERED.lock().map(|r| r.clone()).unwrap_or_default();
    for sc in to_unregister {
        let _ = app.global_shortcut().unregister(sc);
    }
    if let Ok(mut reg) = REGISTERED.lock() {
        reg.clear();
    }
}