use crate::error::AppError;
use crate::models::ClipboardEntry;
use crate::state::AppState;
use base64::Engine;
use std::fs;
use std::sync::atomic::AtomicBool;
use std::sync::OnceLock;
use tauri::{image::Image, AppHandle, Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use uuid::Uuid;

// ============================================================
// 现有命令：剪贴板历史记录管理
// ============================================================

#[tauri::command]
pub fn get_clipboard_history(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<ClipboardEntry>, AppError> {
    state.storage.get_clipboard(limit.unwrap_or(50))
}

#[tauri::command]
pub fn add_clipboard_entry(state: State<'_, AppState>, entry: ClipboardEntry) -> Result<(), AppError> {
    state.storage.add_clipboard(&entry)
}

#[tauri::command]
pub fn clear_clipboard_history(state: State<'_, AppState>) -> Result<(), AppError> {
    state.storage.clear_clipboard()
}

// ============================================================
// 新增命令：剪贴板读写（通过 tauri-plugin-clipboard-manager）
// ============================================================

/// 将文本写入系统剪贴板
#[tauri::command]
pub fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), AppError> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| AppError::new("CLIPBOARD_WRITE_ERROR", &format!("Failed to write text to clipboard: {}", e)))
}

/// 从系统剪贴板读取文本
#[tauri::command]
pub fn clipboard_read_text(app: AppHandle) -> Result<String, AppError> {
    app.clipboard()
        .read_text()
        .map_err(|e| AppError::new("CLIPBOARD_READ_ERROR", &format!("Failed to read text from clipboard: {}", e)))
}

/// 将图片写入系统剪贴板（接受 base64 编码的 PNG 数据）
#[tauri::command]
pub fn clipboard_write_image(app: AppHandle, base64_data: String) -> Result<(), AppError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| AppError::new("CLIPBOARD_IMAGE_ERROR", &format!("Failed to decode base64 image: {}", e)))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| AppError::new("CLIPBOARD_IMAGE_ERROR", &format!("Failed to load image: {}", e)))?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let raw: Vec<u8> = rgba.into_raw();

    let tauri_image = Image::new(&raw, width, height);
    app.clipboard()
        .write_image(&tauri_image)
        .map_err(|e| AppError::new("CLIPBOARD_WRITE_ERROR", &format!("Failed to write image to clipboard: {}", e)))
}

/// 从系统剪贴板读取图片（返回 base64 编码的 PNG 数据）
#[tauri::command]
pub fn clipboard_read_image(app: AppHandle) -> Result<String, AppError> {
    let image_data = app.clipboard()
        .read_image()
        .map_err(|e| AppError::new("CLIPBOARD_READ_ERROR", &format!("Failed to read image from clipboard: {}", e)))?;

    // image_data 为 tauri::image::Image 类型
    let raw = image_data.rgba();
    let width = image_data.width();
    let height = image_data.height();

    // 将 RGBA 原始数据编码为 PNG
    let img = image::RgbaImage::from_raw(width, height, raw.to_vec())
        .ok_or_else(|| AppError::new("CLIPBOARD_IMAGE_ERROR", "Failed to reconstruct image from raw data"))?;

    let mut png_data: Vec<u8> = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut png_data), image::ImageFormat::Png)
        .map_err(|e| AppError::new("CLIPBOARD_IMAGE_ERROR", &format!("Failed to encode PNG: {}", e)))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(&png_data))
}

/// 把 base64 图片数据保存到本地文件，返回文件路径
/// 用于前端读取剪贴板图片后持久化存储
#[tauri::command]
pub fn save_clipboard_image_to_file(
    app: AppHandle,
    base64_data: String,
    file_name: Option<String>,
) -> Result<String, AppError> {
    // 解码 base64
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| AppError::new("IMAGE_DECODE_ERROR", &format!("Failed to decode base64: {}", e)))?;

    // 确定图片格式
    let format = guess_image_format(&bytes);
    let ext = match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Gif => "gif",
        ImageFormat::WebP => "webp",
        ImageFormat::Bmp => "bmp",
        _ => "png",
    };

    // 生成文件名
    let name = file_name.unwrap_or_else(|| format!("clipboard_{}", Uuid::new_v4()));
    let file_name = format!("{}.{}", name, ext);

    // 保存到 app_data_dir/clipboard_images/
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::storage_error(&format!("Failed to get app data dir: {}", e)))?;

    let images_dir = app_data_dir.join("clipboard_images");
    fs::create_dir_all(&images_dir)
        .map_err(|e| AppError::storage_error(&format!("Failed to create images dir: {}", e)))?;

    let file_path = images_dir.join(&file_name);

    // 如果文件已存在，添加序号
    let final_path = if file_path.exists() {
        let stem = file_path.file_stem().unwrap_or_default().to_string_lossy();
        let mut counter = 1;
        loop {
            let new_name = format!("{}_{}.{}", stem, counter, ext);
            let new_path = images_dir.join(&new_name);
            if !new_path.exists() {
                break new_path;
            }
            counter += 1;
        }
    } else {
        file_path
    };

    fs::write(&final_path, &bytes)
        .map_err(|e| AppError::storage_error(&format!("Failed to write image file: {}", e)))?;

    Ok(final_path.to_string_lossy().to_string())
}

/// 用系统默认程序打开文件（ShellExecute via `explorer`/`cmd start`），
/// 绕过 tauri-plugin-shell 的 scope 限制，支持任意本地路径。
#[tauri::command]
pub fn clipboard_open_file(path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::new("OPEN_FILE_ERROR", &format!("启动资源管理器失败: {e}")))?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::new("OPEN_FILE_ERROR", &format!("打开文件失败: {e}")))?;
        Ok(())
    }
}

/// 打开文件所在目录并在资源管理器中选中该文件（explorer.exe /select）
#[tauri::command]
pub fn clipboard_open_file_location(path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        // /select,path 参数：explorer 支持带空格路径，无需额外转义
        std::process::Command::new("explorer.exe")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| AppError::new("OPEN_FILE_ERROR", &format!("启动资源管理器失败: {e}")))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::new("OPEN_FILE_ERROR", &format!("打开文件位置失败: {e}")))?;
        Ok(())
    }
}

/// 剪贴板图片目录的绝对路径（app_data_dir/clipboard_images）
fn clipboard_images_dir(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage_error(&format!("获取数据目录失败: {e}")))?;
    Ok(app_data_dir.join("clipboard_images"))
}

/// 将本地剪贴板图片文件读取为 base64 data URL（用于渲染缩略图）
#[tauri::command]
pub fn clipboard_read_local_image(
    app: AppHandle,
    name: String,
) -> Result<String, AppError> {
    // 防路径穿越：仅允许纯文件名
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::new("IMAGE_READ_ERROR", "非法的图片文件名"));
    }
    let dir = clipboard_images_dir(&app)?;
    let path = dir.join(&name);
    if !path.exists() {
        return Err(AppError::new("IMAGE_READ_ERROR", "图片文件不存在"));
    }
    let bytes = fs::read(&path)
        .map_err(|e| AppError::storage_error(&format!("读取图片文件失败: {e}")))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// 删除本地剪贴板图片文件
#[tauri::command]
pub fn clipboard_delete_local_image(app: AppHandle, name: String) -> Result<(), AppError> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::new("IMAGE_DELETE_ERROR", "非法的图片文件名"));
    }
    let dir = clipboard_images_dir(&app)?;
    let path = dir.join(&name);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| AppError::storage_error(&format!("删除图片文件失败: {e}")))?;
    }
    Ok(())
}

// ============================================================
// 辅助函数
// ============================================================

#[derive(Debug)]
enum ImageFormat {
    Png,
    Jpeg,
    Gif,
    WebP,
    Bmp,
    Unknown,
}

/// 通过文件头魔数猜测图片格式
fn guess_image_format(bytes: &[u8]) -> ImageFormat {
    if bytes.len() < 8 {
        return ImageFormat::Unknown;
    }
    match &bytes[0..8] {
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => ImageFormat::Png,
        [0xFF, 0xD8, 0xFF, ..] => ImageFormat::Jpeg,
        [0x47, 0x49, 0x46, 0x38, ..] => ImageFormat::Gif,
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => ImageFormat::WebP,
        [0x42, 0x4D, ..] => ImageFormat::Bmp,
        _ => ImageFormat::Unknown,
    }
}

// ============================================================
// 进阶剪贴板能力：WinRT OCR / 格式探测 / 事件监听 / 贴图浮动窗口 / 全局快捷键
// ============================================================

/// 获取剪贴板序列号（Win32: GetClipboardSequenceNumber），内容变化时递增
fn clipboard_seq_number() -> Result<u32, String> {
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
    Ok(unsafe { GetClipboardSequenceNumber() })
}

/// 启动剪贴板事件监听（Windows 专用）
/// 剪贴板监听线程的运行状态（供前端展示「开启监听」按钮与提示条是否置灰）
static LISTENING: OnceLock<AtomicBool> = OnceLock::new();

/// 查询剪贴板监听是否已开启（供前端开关按钮实时反映状态）
#[tauri::command]
pub fn clipboard_listener_status() -> bool {
    use std::sync::atomic::Ordering;
    match LISTENING.get() {
        Some(b) => b.load(Ordering::SeqCst),
        None => false,
    }
}

/// 一次性开启剪贴板监听：后台线程每 500ms 用序列号检测剪贴板变化，
/// 变化时 emit `yx-clipboard-changed`。避免重复启动（OnceLock 原子布尔）。
#[tauri::command]
pub fn clipboard_start_listener(app: AppHandle) -> Result<(), AppError> {
    use std::sync::atomic::Ordering;

    if LISTENING.get_or_init(|| AtomicBool::new(false)).swap(true, Ordering::SeqCst) {
        return Ok(()); // 已在监听
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut last_seq: u32 = 0;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let seq = match clipboard_seq_number() {
                Ok(s) => s,
                Err(_) => {
                    continue;
                }
            };
            if seq == 0 || seq == last_seq {
                continue;
            }
            last_seq = seq;
            // 把剪贴板内容写入历史表，使浮动小窗 / 历史页实时同步
            let _ = persist_current_clipboard(&app_handle);
            use tauri::Emitter;
            let _ = app_handle.emit("yx-clipboard-changed", ());
        }
    });
    Ok(())
}

/// 读取系统剪贴板当前文本并写入历史表（已开启监听后，变化时自动落库）。
/// 仅写入非空文本，并与最新一条去重，避免重复记录。
fn persist_current_clipboard(app: &AppHandle) -> Result<(), AppError> {
    use tauri::Manager;

    // 仅当剪贴板含文本时才处理（图片/文件暂不入历史）
    if !clipboard_win::is_format_avail(clipboard_win::formats::CF_UNICODETEXT) {
        return Ok(());
    }
    let text = app
        .clipboard()
        .read_text()
        .map(|s| s.trim().to_string())
        .map_err(|e| AppError::new("CLIPBOARD_READ_ERROR", &format!("read failed: {e}")))?;
    if text.is_empty() {
        return Ok(());
    }

    let state = app.state::<AppState>();
    // 与最新一条比较，内容相同则跳过
    if let Ok(latest) = state.storage.get_clipboard(1) {
        if latest.first().map(|e| e.content == text).unwrap_or(false) {
            return Ok(());
        }
    }

    let entry = ClipboardEntry {
        id: Uuid::new_v4().to_string(),
        content: text,
        content_type: "text".into(),
        created_at: chrono::Utc::now(),
        image_path: None,
        image_width: None,
        image_height: None,
    };
    state.storage.add_clipboard(&entry)?;
    Ok(())
}

/// 剪贴板格式探测结果（一次 IPC 同时判断文本/图片/文件，避免反复试错）
#[derive(serde::Serialize)]
pub struct ClipboardInspect {
    /// 剪贴板序列号（内容未变化时不变，用于轮询去重）
    pub seq: u32,
    pub has_text: bool,
    pub has_image: bool,
    pub has_files: bool,
    /// CF_HDROP 文件路径列表（仅 has_files=true 时填充）
    pub files: Vec<String>,
}

#[tauri::command]
pub fn clipboard_inspect() -> Result<ClipboardInspect, AppError> {
    let seq = clipboard_win::seq_num().map(|n| n.get()).unwrap_or(0);
    let has_text = clipboard_win::is_format_avail(clipboard_win::formats::CF_UNICODETEXT);
    let has_image = clipboard_win::is_format_avail(clipboard_win::formats::CF_DIB)
        || clipboard_win::is_format_avail(clipboard_win::formats::CF_DIBV5);
    let has_files = clipboard_win::is_format_avail(clipboard_win::formats::CF_HDROP);
    let files: Vec<String> = if has_files {
        clipboard_win::get_clipboard(clipboard_win::formats::FileList).unwrap_or_default()
    } else {
        Vec::new()
    };
    Ok(ClipboardInspect {
        seq,
        has_text,
        has_image,
        has_files,
        files,
    })
}

/// 剥离 data URL 前缀，返回纯 base64 数据
fn strip_data_url(s: &str) -> &str {
    if s.starts_with("data:") {
        if let Some(idx) = s.find(',') {
            return &s[idx + 1..];
        }
    }
    s
}

/// 把 CF_DIB 数据转为完整 BMP 文件（DIB 前加 14 字节 BITMAPFILEHEADER）
fn dib_to_bmp(dib: &[u8]) -> Result<Vec<u8>, String> {
    if dib.len() < 40 {
        return Err("DIB too small".to_string());
    }
    let header_size = u32::from_le_bytes([dib[0], dib[1], dib[2], dib[3]]) as usize;
    if header_size < 40 || dib.len() < header_size {
        return Err("invalid DIB header".to_string());
    }
    let bit_count = u16::from_le_bytes([dib[14], dib[15]]);
    let palette_size = if bit_count <= 8 {
        let clr_used = if dib.len() >= 36 {
            u32::from_le_bytes([dib[32], dib[33], dib[34], dib[35]])
        } else {
            0
        };
        if clr_used > 0 {
            (clr_used * 4) as usize
        } else {
            (1usize << bit_count) * 4
        }
    } else {
        0
    };
    let pixel_offset = 14 + header_size + palette_size;
    let total_size = 14 + dib.len();
    let mut bmp = Vec::with_capacity(total_size);
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&(total_size as u32).to_le_bytes());
    bmp.extend_from_slice(&0u16.to_le_bytes());
    bmp.extend_from_slice(&0u16.to_le_bytes());
    bmp.extend_from_slice(&(pixel_offset as u32).to_le_bytes());
    bmp.extend_from_slice(dib);
    Ok(bmp)
}

/// 同步读取剪贴板图片并编码为 PNG base64 data URL（clipboard-win 的 CF_DIB）
fn read_clipboard_image_png_sync() -> Result<String, String> {
    let _clip = clipboard_win::Clipboard::new_attempts(10)
        .map_err(|e| format!("open clipboard: {e}"))?;
    let mut dib = Vec::new();
    let fmt = if clipboard_win::is_format_avail(clipboard_win::formats::CF_DIBV5) {
        clipboard_win::formats::CF_DIBV5
    } else {
        clipboard_win::formats::CF_DIB
    };
    clipboard_win::raw::get_vec(fmt, &mut dib).map_err(|e| format!("read dib: {e}"))?;
    if dib.is_empty() {
        return Err("empty dib data".to_string());
    }
    let bmp = dib_to_bmp(&dib)?;
    let img = image::load_from_memory_with_format(&bmp, image::ImageFormat::Bmp)
        .map_err(|e| format!("decode bmp: {e}"))?;
    let mut png_buf = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut png_buf), image::ImageFormat::Png)
        .map_err(|e| format!("encode png: {e}"))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_buf);
    Ok(format!("data:image/png;base64,{b64}"))
}

/// 读取剪贴板图片为 PNG base64 data URL（clipboard-win 直接读 CF_DIB，比插件稳定）
#[tauri::command]
pub async fn clipboard_read_image_png() -> Result<Option<String>, AppError> {
    let has_image = clipboard_win::is_format_avail(clipboard_win::formats::CF_DIB)
        || clipboard_win::is_format_avail(clipboard_win::formats::CF_DIBV5);
    if !has_image {
        return Ok(None);
    }
    tauri::async_runtime::spawn_blocking(read_clipboard_image_png_sync)
        .await
        .map_err(|e| AppError::new("CLIPBOARD_IMAGE_ERROR", &format!("读剪贴板图片任务失败: {e}")))?
        .map_err(|e| AppError::new("CLIPBOARD_IMAGE_ERROR", &e))
        .map(Some)
}

/// 同步执行 OCR（在阻塞线程内，Windows 10+ 系统自带 OcrEngine）
fn ocr_bytes_sync(bytes: &[u8]) -> Result<String, String> {
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

    if bytes.is_empty() {
        return Ok(String::new());
    }

    let test_engine = OcrEngine::TryCreateFromUserProfileLanguages();
    if test_engine.is_err() {
        return Err(
            "系统未安装 OCR 语言包。请到 Windows 设置-时间和语言-语言-添加语言，搜索并安装「中文（简体）」语言包（包含 OCR 功能）后重试。".to_string()
        );
    }

    let stream = InMemoryRandomAccessStream::new()
        .map_err(|e| format!("create stream failed: {e}"))?;
    let writer = DataWriter::CreateDataWriter(&stream)
        .map_err(|e| format!("create writer failed: {e}"))?;
    writer.WriteBytes(bytes).map_err(|e| format!("write bytes failed: {e}"))?;
    writer.StoreAsync().map_err(|e| format!("store async failed: {e}"))?.get()
        .map_err(|e| format!("store get failed: {e}"))?;
    let _ = writer.DetachStream();
    let _ = stream.Seek(0).map_err(|e| format!("stream seek failed: {e}"))?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("create decoder async failed: {e}"))?.get()
        .map_err(|e| format!("decoder get failed: {e}"))?;
    let bitmap = decoder.GetSoftwareBitmapAsync()
        .map_err(|e| format!("get bitmap async failed: {e}"))?.get()
        .map_err(|e| format!("bitmap get failed: {e}"))?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("创建 OCR 引擎失败: {e}（请确认已安装 OCR 语言包）"))?;
    let result = engine.RecognizeAsync(&bitmap)
        .map_err(|e| format!("recognize async failed: {e}"))?.get()
        .map_err(|e| format!("recognize get failed: {e}"))?;
    let text = result.Text().map_err(|e| format!("get text failed: {e}"))?;
    Ok(text.to_string())
}

/// 对 base64 图片执行 OCR，返回识别文本
#[tauri::command]
pub async fn clipboard_ocr_image(base64_data: String) -> Result<String, AppError> {
    let raw = strip_data_url(&base64_data).to_string();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&raw)
        .map_err(|e| AppError::new("OCR_ERROR", &format!("base64 解码失败: {e}")))?;
    if bytes.is_empty() {
        return Ok(String::new());
    }
    tauri::async_runtime::spawn_blocking(move || ocr_bytes_sync(&bytes))
        .await
        .map_err(|e| AppError::new("OCR_ERROR", &format!("OCR 任务失败: {e}")))?
        .map_err(|e| AppError::new("OCR_ERROR", &e))
}

/// 贴图图片窗口 label 前缀（与便签 sticky- 区分）
pub const CLIPIMG_WIN_PREFIX: &str = "clipimg-";
/// 文本贴图窗口 label 前缀
pub const CLIPTEXT_WIN_PREFIX: &str = "cliptext-";

/// 贴图窗口 label -> 图片/文本注入数据（一次性，取出即删）
static PIN_PAYLOADS: OnceLock<parking_lot::Mutex<std::collections::HashMap<String, String>>> =
    OnceLock::new();

fn pin_payloads() -> &'static parking_lot::Mutex<std::collections::HashMap<String, String>> {
    PIN_PAYLOADS.get_or_init(|| parking_lot::Mutex::new(std::collections::HashMap::new()))
}

/// 校验窗口 id（仅字母数字/下划线/连字符，防注入 label）
fn validate_win_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// 创建桌面浮动图片贴图窗口
///
/// `image_data` 为 PNG base64 或 data URL，注入到 `window.__CLIPIMG_PATH__`。
/// 前端 PinnedImageWindow 将其直接渲染为 data URL 图片。
#[tauri::command]
pub async fn clipboard_pin_image(
    app: AppHandle,
    id: String,
    image_data: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), AppError> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if !validate_win_id(&id) {
        return Err(AppError::new("PIN_ERROR", "非法的图片 id"));
    }
    if image_data.trim().is_empty() {
        return Err(AppError::new("PIN_ERROR", "图片数据为空"));
    }

    let label = format!("{}{}", CLIPIMG_WIN_PREFIX, id);

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    pin_payloads().lock().insert(label.clone(), image_data.clone());

    let init_script = format!(
        "window.__CLIPIMG_PATH__ = {};",
        serde_json::to_string(&image_data).unwrap_or_default()
    );

    let url = WebviewUrl::App("index.html".into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("贴图")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .visible(true)
        .min_inner_size(100.0, 100.0)
        .initialization_script(&init_script)
        .build()
        .map_err(|e| AppError::new("PIN_ERROR", &format!("创建贴图窗口失败: {e}")))?;

    Ok(())
}

/// 创建桌面浮动文本贴图窗口
#[tauri::command]
pub async fn clipboard_pin_text(
    app: AppHandle,
    id: String,
    text: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), AppError> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if !validate_win_id(&id) {
        return Err(AppError::new("PIN_ERROR", "非法的文本 id"));
    }

    let label = format!("{}{}", CLIPTEXT_WIN_PREFIX, id);

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let init_script = format!(
        "window.__CLIPTEXT_CONTENT__ = {};",
        serde_json::to_string(&text).unwrap_or_default()
    );

    let url = WebviewUrl::App("index.html".into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("文本贴图")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .visible(true)
        .min_inner_size(120.0, 80.0)
        .initialization_script(&init_script)
        .build()
        .map_err(|e| AppError::new("PIN_ERROR", &format!("创建文本贴图窗口失败: {e}")))?;

    Ok(())
}

/// 取出贴图注入数据（一次性，即删防泄漏）
#[tauri::command]
pub fn clipboard_get_pin_path(label: String) -> Option<String> {
    if label.trim().is_empty() {
        return None;
    }
    pin_payloads().lock().remove(&label)
}

/// 关闭贴图窗口
#[tauri::command]
pub fn clipboard_unpin_image(app: AppHandle, id: String) -> Result<(), AppError> {
    let label = format!("{}{}", CLIPIMG_WIN_PREFIX, id);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.destroy();
    }
    Ok(())
}

/// 设置贴图窗口透明度（通过注入 CSS 实现窗口级透明，0.3 ~ 1.0）
#[tauri::command]
pub fn clipboard_set_pin_opacity(app: AppHandle, label: String, opacity: f64) -> Result<(), AppError> {
    if let Some(wv) = app.get_webview_window(&label) {
        let clamped = opacity.clamp(0.3, 1.0);
        let js = format!("document.documentElement.style.opacity = '{:.2}';", clamped);
        wv.eval(&js).map_err(|e| AppError::new("PIN_ERROR", &e.to_string()))?;
    }
    Ok(())
}

/// 为剪贴板项注册全局快捷键（触发时 emit `yx-clipboard-shortcut`，payload 为 id）
#[tauri::command]
pub fn clipboard_register_shortcut(
    app: AppHandle,
    id: String,
    shortcut_str: String,
) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let shortcut: Shortcut = shortcut_str
        .parse()
        .map_err(|e| AppError::new("SHORTCUT_ERROR", &format!("无效快捷键 '{shortcut_str}': {e}")))?;

    let id_for_closure = id;
    use tauri::Emitter;
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.emit("yx-clipboard-shortcut", &id_for_closure);
            }
        })
        .map_err(|e| AppError::new("SHORTCUT_ERROR", &format!("注册快捷键失败: {e}")))?;

    Ok(())
}

/// 注销剪贴板项的全局快捷键
#[tauri::command]
pub fn clipboard_unregister_shortcut(app: AppHandle, shortcut_str: String) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let shortcut: Shortcut = shortcut_str
        .parse()
        .map_err(|e| AppError::new("SHORTCUT_ERROR", &format!("无效快捷键 '{shortcut_str}': {e}")))?;

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| AppError::new("SHORTCUT_ERROR", &format!("注销快捷键失败: {e}")))?;

    Ok(())
}