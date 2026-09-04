// ══════════════════════════════════════════════════════════════
// 统一便签 浮动窗口协调器
// 职责：监听统一 store 中 floating=true 的便签，为新增创建 Tauri 独立窗口，
//       为已收回/删除的关闭窗口。本组件不渲染内容，返回 null。
// ══════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import type { StickyNote } from "@/shared/types";

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

// 与"卷起(最小化)状态"宽度保持一致 (卷起时裁切为 260px)
const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 280;
const DEFAULT_X = 80;
const DEFAULT_Y = 100;

interface FloatingStickyManagerProps {
  stickies: StickyNote[];
  workspaceId?: string;
}

export default function FloatingStickyManager({
  stickies,
  workspaceId,
}: FloatingStickyManagerProps) {
  // 已托管窗口的 sticky id 集合（避免重复创建/关闭）
  const managedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 排除已删除的便签
    const activeStickies = stickies.filter((s) => !s.deleted);
    const floatingIds = new Set(
      activeStickies.filter((s) => s.floating).map((s) => s.id),
    );

    // 为新增的浮动便签创建窗口
    activeStickies.forEach((s) => {
      if (s.floating && !managedRef.current.has(s.id)) {
        managedRef.current.add(s.id);
        const x = s.x ?? DEFAULT_X;
        const y = s.y ?? DEFAULT_Y;
        const w = s.width ?? DEFAULT_WIDTH;
        const h = s.height ?? DEFAULT_HEIGHT;
        const alwaysOnTop = s.always_on_top ?? true;
        if (isTauri()) {
          invokeTauri(
            "create_floating_sticky",
            {
              id: s.id,
              x,
              y,
              w,
              h,
              alwaysOnTop,
              workspaceId: workspaceId ?? null,
            },
            s.id,
            managedRef,
          );
        }
      }
    });

    // 关闭已收回/删除的便签窗口
    Array.from(managedRef.current).forEach((id) => {
      if (!floatingIds.has(id)) {
        if (isTauri()) {
          invokeTauri("close_floating_sticky", { id }, id, managedRef, false);
        }
        managedRef.current.delete(id);
      }
    });
  }, [stickies, workspaceId]);

  return null;
}

/** 包装 invoke，创建失败时回滚托管状态以允许重试 */
function invokeTauri(
  cmd: string,
  args: Record<string, unknown>,
  id?: string,
  managed?: React.MutableRefObject<Set<string>>,
  rollbackOnError = true,
): void {
  import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke(cmd, args))
    .catch(() => {
      if (id && managed && rollbackOnError) {
        managed.current.delete(id);
      }
    });
}