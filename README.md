# 一闲笔记 v3

个人知识管理桌面应用 — React + TypeScript + Tauri

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 4
- **路由**: React Router DOM 7
- **动画**: Framer Motion
- **图表**: ECharts + Recharts
- **桌面封装**: Tauri v1

## 快速开始

### 1. 环境准备

需要安装：
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)（打包桌面应用必需）

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
- `.exe` — 单文件安装程序

## 项目结构

```
yixian-notes-v3/
├── src/
│   ├── app.tsx              # 应用入口 + 路由配置
│   ├── index.tsx            # React 渲染入口
│   ├── components/          # 共享组件
│   ├── pages/               # 页面组件
│   ├── features/            # 特性模块（重构中）
│   ├── shared/
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── hooks/           # 共享 Hooks
│   │   ├── store/           # 状态管理
│   │   └── lib/             # 工具函数
│   ├── data/                # Mock 数据
│   ├── hooks/               # 业务 Hooks
│   └── lib/                 # 工具库
├── src-tauri/               # Tauri 桌面应用配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/main.rs
├── public/                  # 静态资源
├── index.html
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
- 6 套主题包（竹青、深蓝、森林绿、琥珀、墨竹、霜白）
- CSS 自定义变量驱动，250ms 平滑过渡

## 许可证

MIT
