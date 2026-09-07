// 弹窗窗口拖动帮助：全局弹窗为无边框 + 透明窗口，Tauri v2 的 data-tauri-drag-region
// 在透明窗口上并不可靠。这里改用显式 startDragging()，由用户手势（mousedown）触发，保证可拖动。
import type { MouseEvent } from "react";

export function handleDragStart(e: MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  // 交互性元素（按钮/输入框/文本域/选择框/链接）上不触发拖动，避免拦截其点击
  const target = e.target as HTMLElement | null;
  if (target?.closest("button, input, textarea, select, a, [role='button'], [contenteditable='true']")) return;
  e.preventDefault();
  void startDrag();
}

async function startDrag(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    /* 非 Tauri 环境：忽略 */
  }
}