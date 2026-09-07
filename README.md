# 一闲笔记 v3

个人知识管理桌面应用 — React 19 + TypeScript + Tauri v2 + SQLite

「一闲笔记」是一款本地优先的桌面级知识管理工具，把「笔记」「便签」「待办」「剪贴板」「四象限」「提醒」等能力整合进同一个工作区，数据默认保存在本地 SQLite，并可随工作区切换主题与功能。

![一闲笔记主界面](https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20clean%20modern%20personal%20knowledge%20management%20desktop%20app%20dashboard%2C%20dark%20sidebar%20with%20notebooks%20and%20note%20list%2C%20light%20editor%20area%20in%20the%20center%2C%20info%20panel%20on%20the%20right%2C%20bamboo%20green%20accent%20color%2C%20blueprint%2C%20flat%20design&image_size=landscape_16_9)

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 4
- **路由**: React Router DOM 7
- **动画**: Framer Motion
- **图表**: ECharts + Recharts
- **桌面封装**: Tauri v2 + SQLite
- **富文本 / Markdown**: 富文本编辑器 + react-markdown（GFM / 代码高亮 / Mermaid / 数学公式）

## 快速开始

### 1. 环境准备

需要安装：

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)（打包桌面应用必需）
- Windows：另有安装包可直接使用（见「下载与安装」）

### 2. 安装依赖

```bash
cd yixian-notes-v3
npm install
```

### 3. 开发模式

```bash
# Web 开发
npm run dev

# 桌面应用开发
npm run tauri:dev
```

### 4. 构建 Web 应用

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 5. 打包 Windows 桌面应用

```bash
npm run tauri:build
```

打包后的安装程序在 `src-tauri/target/release/bundle/` 目录：

- `.msi` — Windows 安装包
- `.exe` — 单文件安装程序（NSIS）

---

## 核心功能

### 📝 笔记

- **多工作区笔记**：支持独立的笔记本 / 标签 / 笔记列表，跨工作区切换主题与功能包。
- **富文本 + Markdown 双模式**：笔记既可富文本所见即所得编辑，也可一键切换 Markdown 源码（含分屏 / 预览）。
- **实时自动保存**：防抖 + 增量同步，改到哪存到哪，无需手动保存。
- **全局搜索**：跨笔记 / 待办 / 采集项 / 标签的快捷搜索（`Ctrl+K`）。
- **标签与收藏**：按标签筛选、收藏置顶，快速定位重点内容。

### 2. 一体化数据面板

| 面板 | 说明 |
|------|------|
| 📋 剪贴板 | 复制即采集的文本暂存，可转存为笔记 / 待办 |
| 📌 便签 | 悬浮便签墙，支持置顶、置底、锁定 |
| ✅ 待办 | 计划 → 执行闭环，随笔记一起落库 |
| 🔲 四象限 | 紧急 / 重要四象限看板，拖拽管理任务 |
| ⏰ 提醒 | 基于时间的到期提醒 |

### 3. 全局悬浮搜索

在主界面按 `Ctrl+K`（或托盘搜索）唤起跨对象搜索，实时模糊匹配笔记 / 待办 / 采集项 / 标签，回车即跳转。

### 4. 快捷新建（PopUp 全局弹窗）

通过托盘「快捷新建笔记」唤起无边框小窗，**新建笔记**、**快速打开**、**本地文件搜索**、**剪贴板**四个面板一键切换：

- 默认富文本编辑，工具栏一键切到 Markdown；
- 新增后立即可在主窗口看到并自动选中新笔记；
- 本地文件搜索可扫描指定目录内文件名与文本内容。

### 5. 主题系统

- 支持 **Light / Dark / System** 三种模式；
- 6 套主题包（竹青、深蓝、森林绿、琥珀、墨竹、霜白）；
- CSS 变量驱动，250ms 平滑过渡。

### 6. 隐私与安全

- **笔记加密**：支持对单篇笔记加密，口令验证后会话内解密，切换离开后自动重加密，明文不落盘。
- **私密隐藏**：支持隐藏性笔记（`isPrivate`），默认遮挡，需要时再展示。

### 7. 数据存储

- 笔记、版本历史、待办、便签等默认持久化到 **本地 SQLite**。
- 版本历史：自动快照 + 里程碑标记，附带字数差异，支持一键恢复 / 删除 / 清空。

---

## 使用说明

### 新建一篇笔记

1. 点击左侧「+ 新建」，或使用全局悬浮窗「快捷新建」。
2. 输入标题与正文。
3. 保存后笔记即时出现在笔记列表，并自动选中定位。

### 切换 Markdown / 富文本

- 在编辑器工具栏点击 **Markdown 图标** 切换到源码编辑。
- 再次点击回到富文本。
- 源码模式下支持编辑 / 分屏 / 预览三种视图。

### 使用版本历史

1. 打开一篇笔记。
2. 点击「历史」图标打开版本侧边栏。
3. 「标记」保存一个里程碑版本，或点击「恢复此版本」回退到任意历史，右侧显示相对上一版的字数增减。

### 加密笔记

1. 编辑器工具栏点击「加密」，设置口令。
2. 之后打开该笔记需输入口令，输入后会话内可正常编辑，离开后自动重加密回写。

### 使用快捷新建弹窗

1. 在桌面托盘点击「快捷新建」。
2. 在弹窗底部切换面板：新建笔记 / 快速打开 / 本地文件搜索 / 剪贴板。
3. 输入完成后保存 / 打开，主窗口同步刷新。

### 本地文件搜索

1. 打开「快捷新建 → 本地文件搜索」。
2. 点击选择根目录。
3. 输入关键字，按文件名或文本命中结果，点击打开定位。

---

## 项目结构

```
yixian-notes-v3/
├── src/
│   ├── app.tsx              # 应用入口 + 路由配置
│   ├── index.tsx            # React 渲染入口
│   ├── components/          # 共享组件
│   │   └── popup/           # 全局悬浮（NewNote / QuickOpen / LocalSearch / Clipboard）
│   ├── pages/               # 页面组件（NotesWorkspace 等）
│   ├── hooks/               # 业务 Hooks（useNoteOperations / useEditorSync …）
│   ├── lib/                 # 工具库（backend / noteVersions / markdown …）
│   │   └── repositories/    # notesRepository 数据仓储（SQLite 同步）
│   ├── store/               # 状态管理
│   └── data/                # Mock 数据
├── src-tauri/               # Tauri v2 桌面应用（Rust + SQLite）
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/        # 各窗口权限（事件 / 拖动）
│   └── src/
│       ├── models.rs        # 数据模型
│       ├── storage/         # SQLite 存储
│       ├── commands/        # 命令（save_note/get_notes/popup …）
│       └── main.rs
├── public/                  # 静态资源
├── index.html
├── popup.html               # 全局悬浮弹窗入口
├── vite.config.ts
├── tsconfig.app.json
└── package.json
```

## 工作区系统

支持 3 个工作区，每个工作区有独立的主题和功能配置：

| 工作区 | 主题包 | 定位 |
|--------|--------|------|
| 个人笔记 | 竹青 | 生活、灵感、日常记录 |
| 工作项目 | 深蓝 | 项目管理、效率工具 |
| 学习成长 | 森林绿 | 知识管理、学习规划 |

## 主题系统

- 支持 Light / Dark / System 三种模式
- 6 套主题包（竹青、松柏、森林绿、琥珀、墨竹、霜白）
- CSS 自定义变量驱动，250ms 平滑过渡

## 常见问题（FAQ）

**Q1：打包时提示 CI 环境变量问题？**
在 PowerShell 打包前执行 `Remove-Item env:CI`，或直接使用 `npm run tauri:build`（项目脚本已处理）。

**Q2：快捷新建保存后主窗口没立刻出现？**
确认已使用最新版；保存后主窗口会通过 SQLite / 事件桥自动刷新并选中新笔记。

**Q3：加密笔记无法编辑？**
需先输入口令解锁；解锁后会话内可编辑，切换后自动重加密。

## 许可证

MIT