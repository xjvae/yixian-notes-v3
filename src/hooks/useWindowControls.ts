// 窗口控制 — 最大化状态追踪 + 全局快捷键
// 使用 Tauri v2 API (window.getCurrentWindow())
import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

export function useWindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlistenState: (() => void) | undefined;
    let unlistenShortcut: (() => void) | undefined;

    const win = getCurrentWindow();

    // 初始最大化状态
    win.isMaximized().then(setMaximized).catch(() => {});

    // 监听窗口 resize 变化来更新最大化状态
    win.onResized(() => {
      win.isMaximized().then(setMaximized).catch(() => {});
    }).then((fn) => (unlistenState = fn)).catch(() => {});

    // Ctrl+Shift+P → 命令面板（由 store 处理）
    listen<string>("yx-global-shortcut", (e) => {
      if (e.payload === "command-palette") {
        window.dispatchEvent(new CustomEvent("yx-open-command-palette"));
      }
    }).then((fn) => (unlistenShortcut = fn)).catch(() => {});

    return () => {
      unlistenState?.();
      unlistenShortcut?.();
    };
  }, []);

  const minimize = useCallback(() => {
    getCurrentWindow().minimize().catch(() => {});
  }, []);

  const toggleMaximize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      if (maximized) {
        await win.unmaximize();
        setMaximized(false);
      } else {
        await win.maximize();
        setMaximized(true);
      }
    } catch {
      /* ignore */
    }
  }, [maximized]);

  const close = useCallback(() => {
    getCurrentWindow().close().catch(() => {});
  }, []);

  const startDrag = useCallback(() => {
    // Tauri v2 使用 startDragging（如果可用）
    const win = getCurrentWindow();
    if ('startDragging' in win && typeof win.startDragging === 'function') {
      (win as unknown as { startDragging: () => Promise<void> }).startDragging().catch(() => {});
    }
  }, []);

  return { maximized, minimize, toggleMaximize, close, startDrag };
}
