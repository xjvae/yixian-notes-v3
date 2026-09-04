use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn export_note(
    state: State<'_, AppState>,
    note_id: String,
    format: String,
    output_path: String,
) -> Result<(), AppError> {
    let storage = &*state.storage;
    let note = storage
        .get_note(&note_id)?
        .ok_or_else(|| AppError::not_found(&format!("Note {} not found", note_id)))?;

    let content = match format.as_str() {
        "md" => note.content.clone(),
        "txt" => {
            // Strip markdown syntax for plain text
            note.content
                .replace("**", "")
                .replace("*", "")
                .replace("# ", "")
                .replace("## ", "")
                .replace("### ", "")
                .replace("```", "")
        }
        "html" => {
            // Simple markdown to HTML conversion
            let mut html = String::from("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>");
            html.push_str(&note.title);
            html.push_str("</title></head><body>");
            html.push_str(&markdown_to_html(&note.content));
            html.push_str("</body></html>");
            html
        }
        _ => return Err(AppError::validation_error(&format!("Unsupported format: {}", format))),
    };

    fs::write(&output_path, content)
        .map_err(|e| AppError::storage_error(&format!("Failed to write file: {}", e)))?;
    Ok(())
}

fn markdown_to_html(md: &str) -> String {
    let mut html = String::new();
    for line in md.lines() {
        if line.starts_with("# ") {
            html.push_str(&format!("<h1>{}</h1>", &line[2..]));
        } else if line.starts_with("## ") {
            html.push_str(&format!("<h2>{}</h2>", &line[3..]));
        } else if line.starts_with("### ") {
            html.push_str(&format!("<h3>{}</h3>", &line[4..]));
        } else if line.starts_with("```") {
            html.push_str("<pre><code>");
        } else if line == "```" {
            html.push_str("</code></pre>");
        } else if line.starts_with("- ") {
            html.push_str(&format!("<li>{}</li>", &line[2..]));
        } else if line.starts_with("**") && line.ends_with("**") {
            html.push_str(&format!("<strong>{}</strong>", &line[2..line.len()-2]));
        } else if !line.is_empty() {
            html.push_str(&format!("<p>{}</p>", line));
        }
    }
    html
}

// ══════════════════════════════════════════════════════════════
// 本地文件搜索（local_search）
//
// 在用户选择的根目录内递归遍历文件，命中"文件名"或"文本内容"即返回。
// - 仅回溯有限深度，跳过隐藏目录与常见重型目录（node_modules / .git 等）
// - 内容扫描仅针对常见文本扩展名（文本、脚本、标记语言等），二进制一律跳过
// - 返回上限由 limit 控制，避免超大目录拖死 UI
// ══════════════════════════════════════════════════════════════

const LOCAL_SEARCH_MAX_DEPTH: usize = 12;
const LOCAL_SEARCH_MAX_RESULTS: usize = 200;
/// 内容匹配时读入的最大字节数（超过视为大文件，只做文件名匹配）
const CONTENT_READ_LIMIT: u64 = 2 * 1024 * 1024;
/// 单文件最多返回的上下文片段数
const MAX_SNIPPETS: usize = 5;

/// 跳过遍历的目录名（常见重型/版本控制目录）
const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", ".svn", ".hg", "target", "dist", "build",
    "vendor", "__pycache__", ".cache", ".turbo", "coverage", "bower_components",
    "$recycle.bin", "system volume information",
];

/// 参与"内容扫描"的扩展名白名单（其余扩展名仅匹配文件名）
const TEXT_EXTENSIONS: &[&str] = &[
    "md", "txt", "markdown", "html", "htm", "css", "scss", "less", "js",
    "jsx", "ts", "tsx", "mjs", "cjs", "json", "xml", "yaml", "yml", "toml",
    "ini", "cfg", "conf", "py", "rb", "go", "rs", "java", "kt", "c", "h",
    "cpp", "hpp", "cs", "php", "swift", "sh", "bat", "ps1", "sql", "csv",
];

#[derive(Debug, Clone, Serialize)]
pub struct LocalFileHit {
    pub path: String,
    pub name: String,
    /// 相对根目录的路径（用于展示）
    pub rel_path: String,
    pub size: u64,
    pub modified: u64,
    /// 文件名是否命中关键词
    pub name_match: bool,
    /// 是否内容命中
    pub content_match: bool,
    /// 内容命中时的上下文片段（首个，向后兼容；完整片段见 snippets）
    pub snippet: String,
    /// 内容中命中的多个上下文片段
    pub snippets: Vec<String>,
    /// 内容中命中的总次数
    pub content_hits: u32,
}

fn is_skip_dir(name: &str) -> bool {
    let lower = name.to_lowercase();
    // 隐藏目录（.name 以点开头）
    if name.starts_with('.') {
        return true;
    }
    SKIP_DIRS.iter().any(|d| d.eq_ignore_ascii_case(&lower))
}

fn extension_of(name: &str) -> String {
    Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn is_text_like(name: &str) -> bool {
    let ext = extension_of(name);
    TEXT_EXTENSIONS.iter().any(|e| *e == ext)
}

/// 解码文本：尽量 UTF-8，失败回退到常见中文编码（GBK/Big5）
fn decode_text(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    for enc in [encoding_rs::GBK, encoding_rs::BIG5] {
        let (cow, _, had_errors) = enc.decode(bytes);
        if !had_errors {
            return cow.into_owned();
        }
    }
    String::from_utf8_lossy(bytes).into_owned()
}

// ─── 搜索语法解析 ─────────────────────────────────────────────
// 支持：
//   - 多关键词（空格分隔，全部命中 = AND）
//   - 排除词「-foo」：文件名与内容均不含
//   - 类型限定「ext:md / ext:.ts」：仅匹配该扩展名
// ──────────────────────────────────────────────────────────────

#[derive(Debug, Default, Clone)]
struct ParsedQuery {
    /// 必须同时命中的词（全部小写）
    terms: Vec<String>,
    /// 必须被排除的词（全部小写）
    excludes: Vec<String>,
    /// 可选扩展名限定（小写，无前导点）
    ext: Option<String>,
}

impl ParsedQuery {
    fn parse(input: &str) -> Self {
        let mut q = ParsedQuery::default();
        for token in input.split_whitespace() {
            let t = token.trim();
            if t.is_empty() {
                continue;
            }
            if let Some(rest) = t.strip_prefix('-') {
                let rest = rest.trim();
                if !rest.is_empty() {
                    q.excludes.push(rest.to_lowercase());
                }
            } else if let Some(rest) = t.strip_prefix("ext:") {
                let rest = rest.trim_start_matches('.');
                if !rest.is_empty() {
                    q.ext = Some(rest.to_lowercase());
                }
            } else {
                q.terms.push(t.to_lowercase());
            }
        }
        q
    }

    /// 关键词是否命中内容（所有词都出现，且不含排除词）
    fn content_matches(&self, lower: &str) -> bool {
        self.terms.iter().all(|t| lower.contains(t))
            && !self.excludes.iter().any(|x| lower.contains(x))
    }

    /// 文件名是否命中（所有词并存，且无排除词）
    fn name_matches(&self, name_lower: &str) -> bool {
        self.terms.iter().all(|t| name_lower.contains(t))
            && !self.excludes.iter().any(|x| name_lower.contains(x))
    }
}

struct Walker<'a> {
    root: &'a Path,
    query: &'a ParsedQuery,
    limit: usize,
    results: Vec<LocalFileHit>,
    visited_files: usize,
    name_only: bool,
    content_only: bool,
    max_depth: usize,
}

impl<'a> Walker<'a> {
    fn run(&mut self, dir: &Path, depth: usize) {
        if self.results.len() >= self.limit {
            return;
        }
        self.visited_files += 1;
        if self.visited_files > 200_000 {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            if self.results.len() >= self.limit {
                return;
            }
            let path = entry.path();
            if path.is_dir() {
                if !is_skip_dir(&entry.file_name().to_string_lossy().to_lowercase()) {
                    if depth < self.max_depth {
                        self.run(&path, depth + 1);
                    }
                }
            } else if path.is_file() {
                // 目录过深就不扫描内容，只匹配文件名（性能保护）
                let deep = depth >= self.max_depth;
                self.try_file(&path, &entry.file_name().to_string_lossy(), deep);
            }
        }
    }

    fn try_file(&mut self, path: &Path, name: &str, deep: bool) {
        if self.results.len() >= self.limit {
            return;
        }
        // 类型限定（用户未指定扩展名时不走此过滤）
        if let Some(want) = &self.query.ext {
            if !want.is_empty() && extension_of(name) != *want {
                return;
            }
        }

        let name_lower = name.to_lowercase();
        let name_match = self.query.name_matches(&name_lower);

        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => return,
        };

        let mut hit = LocalFileHit {
            path: path.to_string_lossy().to_string(),
            name: name.to_string(),
            rel_path: path
                .strip_prefix(self.root)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| name.to_string()),
            size: metadata.len(),
            modified: metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as u64 * 1000)
                .unwrap_or(0),
            name_match,
            content_match: false,
            snippet: String::new(),
            snippets: Vec::new(),
            content_hits: 0,
        };

        // 1) 文件名命中收集（content 模式下不参与文件名命中）
        if !self.content_only && name_match {
            self.results.push(hit.clone());
        }

        // 2) 内容扫描（name 模式跳过；content 模式始终扫描；all 模式仅在文件名未命中时）
        let do_content = !self.name_only && (self.content_only || !name_match);
        if do_content && !deep && is_text_like(name) && metadata.len() <= CONTENT_READ_LIMIT {
            if let Some((hits, snippets)) = self.read_and_match(path) {
                hit.content_match = true;
                hit.content_hits = hits;
                hit.snippet = snippets.first().cloned().unwrap_or_default();
                hit.snippets = snippets;
                self.results.push(hit);
            }
        }
    }

    /// 读取文件内容并匹配。返回 (内容命中总数, 片段列表)；不命中返回 None。
    fn read_and_match(&self, path: &Path) -> Option<(u32, Vec<String>)> {
        let mut file = fs::File::open(path).ok()?;
        if file.metadata().ok()?.len() > CONTENT_READ_LIMIT {
            return None;
        }
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).ok()?;
        if bytes.is_empty() {
            return None;
        }
        let text = decode_text(&bytes);
        let lower = text.to_lowercase();
        if !self.query.content_matches(&lower) {
            return None;
        }

        // 收集所有命中位置，合并相邻命中为一个片段
        let mut positions: Vec<usize> = Vec::new();
        for t in &self.query.terms {
            let mut s = 0usize;
            while let Some(rel) = lower[s..].find(t) {
                positions.push(s + rel);
                s += rel + t.len();
            }
        }
        if positions.is_empty() {
            return None;
        }
        positions.sort_unstable();

        let hit_count = positions.len() as u32;
        let mut snippets = Vec::new();
        let mut last_end = 0usize;
        for p in positions {
            if snippets.len() >= MAX_SNIPPETS {
                break;
            }
            // 与前一高度重叠则跳过（避免碎片过多）
            if p < last_end.saturating_sub(48) {
                continue;
            }
            let start = p.saturating_sub(50);
            let end = (p + 30 + 90).min(text.len());
            let snip = text[start..end]
                .chars()
                .take(400)
                .collect::<String>()
                .replace(['\n', '\r'], " ")
                .trim()
                .to_string();
            if !snip.is_empty() {
                snippets.push(snip);
                last_end = end;
            }
        }
        Some((hit_count, snippets))
    }
}

/// 本地文件搜索命令。`root` 为用户选择的根目录，`query` 支持搜索语法：
/// - 多关键词（空格分隔，全部命中 = AND），如 `报告 模板`
/// - 排除词 `-foo`（文件名与内容均不含），如 `报告 -demo`
/// - 类型限定 `ext: md`（仅匹配该扩展名），如 `ext:ts`
/// 同时支持非 UTF-8（GBK/Big5）文本内容解码。返回命中文件列表，
/// 每条命中附带文件信息、命中标记与上下文片段。
#[tauri::command]
pub fn local_search(root: String, query: String, limit: Option<usize>, mode: Option<String>, max_depth: Option<usize>) -> Result<Vec<LocalFileHit>, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::validation_error(&format!("目录不存在: {root}")));
    }
    let input = query.trim();
    if input.is_empty() {
        return Ok(Vec::new());
    }
    let parsed = ParsedQuery::parse(input);
    if parsed.terms.is_empty() {
        // 只输入了排除词/类型限定等，缺少正向关键词，无结果
        return Ok(Vec::new());
    }
    // mode: all(默认,文件名+内容) / name(仅文件名) / content(仅内容)
    let mode = mode.unwrap_or_else(|| "all".to_string());
    let limit = limit.unwrap_or(LOCAL_SEARCH_MAX_RESULTS).min(LOCAL_SEARCH_MAX_RESULTS);
    let max_depth = max_depth
        .unwrap_or(LOCAL_SEARCH_MAX_DEPTH)
        .clamp(2, 32);

    let mut walker = Walker {
        root: root_path,
        query: &parsed,
        limit,
        results: Vec::new(),
        visited_files: 0,
        name_only: mode == "name",
        content_only: mode == "content",
        max_depth,
    };
    walker.run(root_path, 0);
    Ok(walker.results)
}

/// 将文本写入指定本地文件（导出搜索结果等，避免受 fs 插件作用域限制）
#[tauri::command]
pub fn save_text_file(path: String, content: String) -> Result<bool, AppError> {
    use std::io::Write;
    // 创建父目录（若存在）
    if let Some(parent) = Path::new(&path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut f = fs::File::create(&path)
        .map_err(|e| AppError::validation_error(&format!("无法写入 {}: {e}", &path)))?;
    f.write_all(content.as_bytes())
        .map_err(|e| AppError::validation_error(&format!("写入失败: {e}")))?;
    Ok(true)
}

/// 用 Rust 侧原生目录选择器（不受 webview dialog 插件作用域限制）。取消返回 None。
#[tauri::command]
pub fn pick_search_folder(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().blocking_pick_folder();
    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// 用 Rust 侧原生保存对话框选择导出路径（不受 webview dialog 插件作用域限制）。取消返回 None。
#[tauri::command]
pub fn pick_save_file(app: tauri::AppHandle, file_name: String) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .set_file_name(file_name)
        .blocking_save_file();
    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// 用系统默认程序打开本地文件（返回 true 表示已发起打开）
#[tauri::command]
pub fn open_local_file(path: String) -> Result<bool, AppError> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(AppError::validation_error(&format!("文件不存在: {path}")));
    }
    if cfg!(windows) {
        let _ = std::process::Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&path)
            .spawn();
    } else {
        let _ = std::process::Command::new("xdg-open").arg(path).spawn();
    }
    Ok(true)
}

/// 在资源管理器中定位/显示文件（Windows 用 explorer /select，其余打开所在目录）
#[tauri::command]
pub fn reveal_local_file(path: String) -> Result<bool, AppError> {
    let p = Path::new(&path);
    if cfg!(windows) {
        let _ = std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", &path))
            .spawn();
        return Ok(true);
    }
    let dir = p.parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_else(|| path.clone());
    if cfg!(target_os = "macos") {
        let _ = std::process::Command::new("open").arg("-R").arg(&path).spawn();
    } else {
        let _ = std::process::Command::new("xdg-open").arg(&dir).spawn();
    }
    Ok(true)
}