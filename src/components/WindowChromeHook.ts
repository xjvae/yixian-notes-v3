import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * 浮动窗口通用工具（浮动便签 / 四象限钉桌面 共用）
 *
 * 统一封装独立浮动窗口的：置顶、关闭、屏幕比例、位置读取，以及
 * -webkit-app-region 拖拽区样式。避免两个窗口各自重复封装。
 */

/** -webkit-app-region 拖拽区 / 禁拖区 样式（WebView2 原生窗口拖动） */
export const APP_DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
export const APP_NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

/** 返回当前窗口的缩放系数（默认 1） */
export async function windowScale(): Promise<number> {
  try {
    return (await getCurrentWindow().scaleFactor()) || 1;
  } catch {
    return 1;
  }
}

/**
 * 浮动窗口通用 Hook：
 * - 返回当前窗口句柄与常用操作（置顶切换、关闭）
 * - 提供 -webkit-app-region 拖拽区样式常量
 */
export function useFloatingWindow() {
  const win = getCurrentWindow();
  const suppressRef = useRef(false);

  /** 取当前置顶状态 */
  const isAlwaysOnTop = useCallback(() => win.isAlwaysOnTop(), [win]);

  /** 置顶；返回新状态（用于驱动图标） */
  const setAlwaysOnTop = useCallback(
    (next: boolean) => win.setAlwaysOnTop(next),
    [win],
  );

  /** 切换置顶并返回新状态 */
  const toggleAlwaysOnTop = useCallback(async () => {
    const next = !(await win.isAlwaysOnTop());
    await win.setAlwaysOnTop(next);
    return next;
  }, [win]);

  /** 关闭当前浮动窗口 */
  const close = useCallback(() => {
    win.close().catch(() => {});
  }, [win]);

  return {
    win,
    suppressRef,
    windowScale,
    isAlwaysOnTop,
    setAlwaysOnTop,
    toggleAlwaysOnTop,
    close,
    APP_DRAG,
    APP_NO_DRAG,
  };
}