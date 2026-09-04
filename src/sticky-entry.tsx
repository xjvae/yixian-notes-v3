// 浮动便签独立窗口专用入口（最小化，不加载主窗口 App bundle）
// 由独立窗口以 sticky.html 加载，直接渲染浮动便签。
// 通过 #__boot__ 自检元素逐步记录进度，便于判断脚本执行到哪一步。
import { createRoot } from "react-dom/client";
import "./index.css";
import FloatingStickyWindow from "./components/FloatingStickyWindow";

function bootLog(txt: string) {
  try {
    const el = document.getElementById("__boot__");
    if (el) {
      el.textContent += `\n> ${txt}`;
    }
  } catch {
    /* ignore */
  }
}

bootLog("入口脚本已执行 (sticky-entry.tsx)");

// 页面级错误浮层：任何脚本错误都直接打印到 #__boot__ 上
window.addEventListener("error", (e) => {
  bootLog(`[error] ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "unknown");
  bootLog(`[unhandled] ${reason}`);
});

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

const boot = document.getElementById("__boot__");
try {
  createRoot(root).render(<FloatingStickyWindow />);
  bootLog("React 已挂载 FloatingStickyWindow");
  if (boot) {
    // 渲染成功后隐藏诊断层（短暂保留，让便签正常显示）
    boot.style.display = "none";
  }
} catch (err) {
  bootLog(`React 渲染失败: ${err instanceof Error ? err.message : String(err)}`);
}