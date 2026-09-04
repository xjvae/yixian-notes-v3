import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./app";
import { ErrorBoundary } from "./components/ErrorBoundary";
import FloatingStickyWindow from "./components/FloatingStickyWindow";
import PinnedImageWindow from "./components/PinnedImageWindow";
import PinnedTextWindow from "./components/PinnedTextWindow";
import FloatingQuadrantWindow from "./components/FloatingQuadrantWindow";
import { recordAppReady } from "./lib/perf";
import "./index.css";

// 通过窗口 label 判断渲染模式（最可靠，不依赖 initialization_script 时序）
//   主窗口:       label = "main"
//   浮动便签窗口:   label = "sticky-{id}"
//   四象限桌面窗:   label = "quadrant-{workspaceId}"
//   图片贴图窗口:   label = "clipimg-{id}"
//   文本贴图窗口:   label = "cliptext-{id}"
type WindowMode = "app" | "sticky" | "quadrant" | "clipimg" | "cliptext";

let mode: WindowMode = "app";
let stickyId: string | null = null;
let quadrantWs: string | null = null;

try {
  const label = getCurrentWindow().label;
  if (label.startsWith("sticky-")) {
    mode = "sticky";
    stickyId = label.slice("sticky-".length);
  } else if (label.startsWith("quadrant-")) {
    mode = "quadrant";
    quadrantWs = label.slice("quadrant-".length);
  } else if (label.startsWith("clipimg-")) {
    mode = "clipimg";
  } else if (label.startsWith("cliptext-")) {
    mode = "cliptext";
  }
} catch {
  // 非 Tauri 环境（浏览器开发模式）：回退检查注入变量
  const win = window as unknown as { __STICKY_ID__?: unknown; __QUADRANT_WS__?: unknown };
  const val = win.__STICKY_ID__;
  const qws = win.__QUADRANT_WS__;
  if (typeof val === "string" && val) {
    mode = "sticky";
    stickyId = val;
  } else if (typeof qws === "string" && qws) {
    mode = "quadrant";
    quadrantWs = qws;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

// 启动诊断:标记 JS 已执行,任何渲染错误都会写入 #boot-status 显示(参考仓库做法)
const bootStatus = document.getElementById("boot-status");
if (bootStatus) bootStatus.textContent = "JS 已加载，正在渲染 React…";

try {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        {mode === "sticky" && stickyId ? (
          <FloatingStickyWindow />
        ) : mode === "quadrant" && quadrantWs ? (
          <FloatingQuadrantWindow workspaceId={quadrantWs} />
        ) : mode === "clipimg" ? (
          <PinnedImageWindow />
        ) : mode === "cliptext" ? (
          <PinnedTextWindow />
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (e) {
  if (bootStatus)
    bootStatus.textContent =
      "React 渲染失败: " + (e instanceof Error ? e.message : String(e));
}

// 渲染成功后移除诊断占位，避免遮挡界面（所有窗口模式：主窗/便签/贴图/四象限）
window.addEventListener("load", () => {
  const bs = document.getElementById("boot-status");
  if (bs && root.hasChildNodes()) bs.remove();
});

// 性能监控：首帧后记录一次启动时序，供优化前后对比
requestAnimationFrame(() => {
  requestAnimationFrame(() => recordAppReady());
});