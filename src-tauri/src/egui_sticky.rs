// 原生便签桌面窗口（eframe / egui，不含 WebView）
//
// 架构：与主应用共用同一个 exe，采用「双模式」入口。
//  - 主进程（无参数）→ 正常 Tauri 应用。
//  - 主进程带 --desktop-sticky <json路径> → 进入本模块，用 eframe 创建独立原生窗口。
// eframe 在独立子进程中运行，拥有自己的 winit EventLoop / GL 上下文，
// 不与 Tauri 冲突，崩溃互不影响，原生窗口可拖到任意屏幕。
//
// 显示优化：
//  - 注册系统 CJK 字体（微软雅黑），避免中文显示为方块；
//  - 便签为圆角卡片，配色映射到与主窗一致的便签色；
//  - 顶部按钮栏 + 正文多行编辑，布局用 egui 顶部面板，杜绝错乱。
use eframe::egui;
use serde::{Deserialize, Serialize};

/// 由主窗发起「置为桌面便签」时收到的便签参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopStickyArgs {
    pub title: String,
    pub content: String,
    /// 主题色 hex，如 #ffe89a
    pub color: String,
    /// 桌面坐标（逻辑像素）
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl DesktopStickyArgs {
    fn sample_color(&self) -> egui::Color32 {
        let s = self.color.trim_start_matches('#');
        if s.len() != 6 {
            return egui::Color32::from_rgb(255, 232, 154);
        }
        let r = u8::from_str_radix(&s[0..2], 16).unwrap_or(255);
        let g = u8::from_str_radix(&s[2..4], 16).unwrap_or(232);
        let b = u8::from_str_radix(&s[4..6], 16).unwrap_or(154);
        egui::Color32::from_rgb(r, g, b)
    }

    /// 标题栏颜色（略深于底色）
    fn header_color(&self) -> egui::Color32 {
        let c = self.sample_color();
        egui::Color32::from_rgb(
            c.r().saturating_sub(28),
            c.g().saturating_sub(28),
            c.b().saturating_sub(28),
        )
    }
}

struct DesktopStickyApp {
    note: DesktopStickyArgs,
    edit_content: String,
}

impl DesktopStickyApp {
    fn new(note: DesktopStickyArgs) -> Self {
        let edit_content = note.content.clone();
        Self { note, edit_content }
    }
}

impl eframe::App for DesktopStickyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let bg = self.note.sample_color();
        let header = self.note.header_color();

        // 顶栏：标题（左）+ 按钮（右）。保持系统标题栏以提供 OS 原生拖动。
        egui::TopBottomPanel::top("header")
            .resizable(false)
            .height_range(32.0..=32.0)
            .frame(
                egui::Frame::default()
                    .fill(header)
                    .inner_margin(egui::Margin::symmetric(10.0, 4.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(&self.note.title)
                            .color(egui::Color32::from_rgb(70, 60, 40))
                            .strong(),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .small_button("✕")
                            .on_hover_text("关闭便签")
                            .clicked()
                        {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                    });
                });
            });

        // 2) 正文卡片
        egui::CentralPanel::default()
            .frame(
                egui::Frame::default()
                    .fill(bg)
                    .inner_margin(egui::Margin::same(10.0))
                    .rounding(egui::Rounding::same(0.0)),
            )
            .show(ctx, |ui| {
                ui.add(
                    egui::TextEdit::multiline(&mut self.edit_content)
                        .font(egui::TextStyle::Body)
                        .desired_width(f32::INFINITY)
                        .desired_rows(6)
                        .hint_text("便签内容…")
                        .text_color(egui::Color32::from_rgb(60, 50, 30)),
                );
            });
    }
}

/// 加载系统中文字体（微软雅黑 → 宋体/黑体回退），避免中文变方块。
fn install_cjk_fonts(ctx: &egui::Context) {
    let candidates = [
        "C:\\Windows\\Fonts\\msyh.ttc",
        "C:\\Windows\\Fonts\\msyh.ttf",
        "C:\\Windows\\Fonts\\msyhbd.ttc",
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\simsun.ttc",
        "C:\\Windows\\Fonts\\NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
    ];

    let mut loaded_bytes: Option<Vec<u8>> = None;
    for path in candidates {
        if let Ok(bytes) = std::fs::read(path) {
            if !bytes.is_empty() {
                loaded_bytes = Some(bytes);
                break;
            }
        }
    }

    let Some(bytes) = loaded_bytes else {
        return; // 找不到 CJK 字体时保持默认（可能仍方块，但至少不崩溃）
    };

    let mut fonts = egui::FontDefinitions::default();
    fonts
        .font_data
        .insert("cjk".to_owned(), egui::FontData::from_owned(bytes));
    for family in [egui::FontFamily::Proportional, egui::FontFamily::Monospace] {
        fonts
            .families
            .entry(family)
            .or_default()
            .push("cjk".to_owned());
    }
    ctx.set_fonts(fonts);
}

/// —— 仅在子进程（--desktop-sticky）模式下调用 ——
/// 运行 eframe 原生便签窗口，直到用户关闭。
pub fn run_desktop_main() {
    let mut args = std::env::args().skip_while(|a| a != "--desktop-sticky");
    args.next(); // 跳过 "--desktop-sticky"
    let Some(json_path) = args.next() else {
        return;
    };

    let note: DesktopStickyArgs = match std::fs::read(&json_path)
        .map_err(|e| e.to_string())
        .and_then(|raw| serde_json::from_slice(&raw).map_err(|e| e.to_string()))
    {
        Ok(n) => n,
        Err(_) => return,
    };

    let viewport = egui::ViewportBuilder::default()
        .with_app_id("yixian.sticky")
        .with_title(note.title.clone())
        .with_inner_size([note.width.max(220.0), note.height.max(180.0)])
        .with_position([note.x, note.y])
        .with_resizable(true)
        .with_min_inner_size([180.0, 120.0]);

    let options = eframe::NativeOptions {
        viewport,
        ..Default::default()
    };

    let app = DesktopStickyApp::new(note);
    let _ = eframe::run_native(
        "yixian_sticky",
        options,
        Box::new(move |cc| {
            install_cjk_fonts(&cc.egui_ctx);
            Ok(Box::new(app))
        }),
    );

    // 清理临时便签文件
    let _ = std::fs::remove_file(&json_path);
}