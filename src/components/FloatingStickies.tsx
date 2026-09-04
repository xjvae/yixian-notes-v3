// 浮动便签窗口协调器
// 职责: 监听 store 中浮动状态, 为每张浮动便签创建/关闭独立 OS 窗口
// 本组件不渲染任何可视内容(返回 null), 仅负责窗口生命周期管理
//
// 注意: 此组件需要 Tauri 窗口管理功能支持
// 当前版本作为占位实现，实际窗口创建需要配置 tauri.conf.json 中的 webview 权限

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store/useStore";
import { invoke } from "@tauri-apps/api/core";

// 浮动便签默认尺寸
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 280;
const DEFAULT_X = 80;
const DEFAULT_Y = 100;

// 是否真实 Tauri 桌面环境（否则忽略建/关窗，保持浏览器开发可用）
function isTauri(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>)
    );
  } catch {
    return false;
  }
}

export default function FloatingStickies() {
  const stickies = useStore(useShallow((s) => s.stickyNotes));
  const managedRef = useRef<Set<string>>(new Set());

  // 监听浮动状态变化
  useEffect(() => {
    const activeStickies = stickies.filter((s) => !(s as any).deleted);
    const floatingIds = new Set(
      activeStickies.filter((s) => (s as any).floating).map((s) => s.id)
    );

    // 为新增的浮动便签创建窗口
    activeStickies.forEach((s) => {
      if ((s as any).floating && !managedRef.current.has(s.id)) {
        managedRef.current.add(s.id);
        const x = s.x ?? DEFAULT_X;
        const y = s.y ?? DEFAULT_Y;
        const w = s.width ?? DEFAULT_WIDTH;
        const h = s.height ?? DEFAULT_HEIGHT;
        const alwaysOnTop = (s as any).always_on_top ?? true;
        if (isTauri()) {
          // 调用 Rust 端真实创建独立窗口
          invoke("create_floating_sticky", { id: s.id, x, y, w, h, alwaysOnTop }).catch(() => {
            managedRef.current.delete(s.id);
          });
        }
      }
    });

    // 关闭已收回/删除的便签窗口
    Array.from(managedRef.current).forEach((id) => {
      if (!floatingIds.has(id)) {
        if (isTauri()) {
          invoke("close_floating_sticky", { id }).catch(() => {
            /* 窗口可能已不存在，忽略 */
          });
        }
        managedRef.current.delete(id);
      }
    });
  }, [stickies]);

  return null;
}
