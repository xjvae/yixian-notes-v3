// ══════════════════════════════════════════════════════════════
// 统一便签 Store Hook
// 以统一 StickyNote 数组为唯一数据源（便签墙 + 浮动便签共用）。
//   - 持久化到按工作区隔离的 localStorage
//   - 首次装载时把两套旧数据（便签墙 IStickyNote / 浮动 IFloatingNote）迁移进来
//   - 监听 storage 事件：浮动独立窗口编辑后，主窗实时刷新
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import type { StickyNote, StickyContentType } from "@/shared/types";
import {
  readUnifiedStickies,
  writeUnifiedStickies,
  unifiedStickiesStorageKey,
  legacyFloatingStorageKey,
  legacyStickyStorageKey,
  fromLegacySticky,
  fromLegacyFloating,
  createDefaultSticky,
  isUnifiedSticky,
  lineToItem,
} from "@/lib/floating-sticky";
import {
  extractSecContent,
  encryptSecContent,
  decryptSecContent,
  isNoteEncrypted,
  type StickySecContent,
} from "@/lib/sticky-sec";

/** 工作区是否变化 */
function sameRef(a?: string, b?: string): boolean {
  return (a ?? "") === (b ?? "");
}

export function useStickyNotes(activeWorkspaceId?: string) {
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(() =>
    loadOrMigrate(activeWorkspaceId),
  );
  const wsRef = useRef(activeWorkspaceId);
  // 供内部回调读取最新列表（避免闭包陈旧）
  const listRef = useRef<StickyNote[]>(stickyNotes);
  listRef.current = stickyNotes;

  // 工作区切换时重新获取（含迁移）
  useEffect(() => {
    if (!sameRef(wsRef.current, activeWorkspaceId)) {
      wsRef.current = activeWorkspaceId;
      setStickyNotes(loadOrMigrate(activeWorkspaceId));
    }
  }, [activeWorkspaceId]);

  // 持久化
  useEffect(() => {
    writeUnifiedStickies(activeWorkspaceId, stickyNotes);
  }, [stickyNotes, activeWorkspaceId]);

  // 跨窗口同步：浮动独立窗口修改同一份 localStorage（storage 事件）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== unifiedStickiesStorageKey(activeWorkspaceId)) return;
      setStickyNotes(readUnifiedStickies(activeWorkspaceId));
    };
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(() => {
      setStickyNotes((prev) => {
        const cur = readUnifiedStickies(activeWorkspaceId);
        if (
          cur.length === prev.length &&
          cur.every((n, i) => n.updated_at === prev[i]?.updated_at)
        ) {
          return prev;
        }
        return cur;
      });
    }, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [activeWorkspaceId]);

  // ── 基础 CRUD ──
  const createSticky = useCallback((partial?: Partial<StickyNote>) => {
    const n = createDefaultSticky(partial);
    setStickyNotes((prev) => [...prev, n]);
    return n;
  }, []);

  /** 以某便签为模板复制一张新便签（网格内，非浮动） */
  const duplicateSticky = useCallback((src: StickyNote) => {
    const n = createDefaultSticky({
      title: src.title ? `${src.title} 副本` : "副本",
      items: [...src.items],
      body: src.body,
      content_type: src.content_type,
      theme: src.theme,
      floating: false,
      width: src.width,
      height: src.height,
    });
    setStickyNotes((prev) => [...prev, n]);
    return n;
  }, []);

  const updateSticky = useCallback(
    (id: string, updates: Partial<Omit<StickyNote, "id">>) => {
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updated_at: Date.now() } : n,
        ),
      );
    },
    [],
  );

  /** 软删除：标记 deleted=true（回收站可恢复） */
  const deleteSticky = useCallback(
    (id: string) => updateSticky(id, { deleted: true }),
    [updateSticky],
  );

  /** 硬删除：仅从列表移除 */
  const removeSticky = useCallback((ids: string[]) => {
    setStickyNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
  }, []);

  // ── 内容类型切换（todo ↔ text，保留另一份数据以便切回）──
  const switchContentType = useCallback((id: string, type: StickyContentType) => {
    setStickyNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id || n.content_type === type) return n;
        if (type === "text") {
          const existingBody = n.body ?? "";
          const body =
            existingBody.trim().length > 0
              ? existingBody
              : n.items
                  .map((i) => i.replace(/^\[x\] /, "✓ ").replace(/^\[ \] /, "○ "))
                  .join("\n");
          return { ...n, content_type: "text", body, updated_at: Date.now() };
        }
        const existingItems = (n.items ?? []).filter((i) => i.trim().length > 0);
        const items =
          existingItems.length > 0
            ? existingItems
            : (n.body ?? "")
                .split("\n")
                .filter((l) => l.trim().length > 0)
                .map((l) => lineToItem(l));
        return {
          ...n,
          content_type: "todo",
          items: items.length === 0 ? [""] : items,
          updated_at: Date.now(),
        };
      }),
    );
  }, []);

  // ── 浮动窗口开关（触发 FloatingStickyManager 建/关窗）──
  const toggleFloating = useCallback((id: string, floating: boolean) => {
    setStickyNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              floating,
              x: floating ? (n.x ?? 80) : null,
              y: floating ? (n.y ?? 100) : null,
              updated_at: Date.now(),
            }
          : n,
      ),
    );
  }, []);

  const setAllFloating = useCallback((floating: boolean) => {
    setStickyNotes((prev) =>
      prev.map((n, i) => {
        if (n.floating === floating) return n;
        return {
          ...n,
          floating,
          x: floating ? (n.x ?? 80 + (i % 5) * 28) : null,
          y: floating ? (n.y ?? 100 + (i % 5) * 28) : null,
          updated_at: Date.now(),
        };
      }),
    );
  }, []);

  // ── 批量主题 ──
  const setAllThemes = useCallback((theme: string) => {
    setStickyNotes((prev) =>
      prev.map((n) =>
        n.theme === theme ? n : { ...n, theme, updated_at: Date.now() },
      ),
    );
  }, []);

  // ── 待办条目 ──
  const addItem = useCallback(
    (id: string) => {
      const cur = listRef.current.find((n) => n.id === id);
      const items = cur ? [...(cur.items ?? [""]), ""] : [""];
      updateSticky(id, { items });
    },
    [updateSticky],
  );

  const updateItem = useCallback(
    (id: string, idx: number, value: string) => {
      const cur = listRef.current.find((n) => n.id === id);
      if (!cur) return;
      const items = [...cur.items];
      items[idx] = value;
      updateSticky(id, { items });
    },
    [updateSticky],
  );

  const removeItem = useCallback(
    (id: string, idx: number) => {
      const cur = listRef.current.find((n) => n.id === id);
      if (!cur) return;
      const items = cur.items.filter((_, i) => i !== idx);
      updateSticky(id, { items: items.length === 0 ? [""] : items });
    },
    [updateSticky],
  );

  const setItemDone = useCallback(
    (id: string, idx: number, done: boolean) => {
      const cur = listRef.current.find((n) => n.id === id);
      if (!cur) return;
      const raw = cur.items[idx] ?? "";
      const text = raw.replace(/^\[[ xX]\] /, "").replace(/^[✓○]\s*/, "").trim();
      const items = [...cur.items];
      items[idx] = done ? `[x] ${text}` : `[ ] ${text}`;
      updateSticky(id, { items });
    },
    [updateSticky],
  );

  // ── 锁定 / 独立加密 ──
  /** 切换锁定：锁定后无法编辑（仅可由用户解锁） */
  const setLocked = useCallback((id: string, locked: boolean) => {
    updateSticky(id, { locked });
  }, [updateSticky]);

  /** 用独立口令加密便签内容；返回是否成功 */
  const encryptNote = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      const cur = listRef.current.find((n) => n.id === id);
      if (!cur || isNoteEncrypted(cur)) return false;
      const encData = await encryptSecContent(password, extractSecContent(cur));
      if (!encData) return false;
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                encrypted: true,
                enc_data: encData,
                // 加密后明文置空（仅存密文，标题变占位）
                title: "🔒 已加密",
                items: [],
                body: "",
                updated_at: Date.now(),
              }
            : n,
        ),
      );
      return true;
    },
    [],
  );

  /** 用独立口令解密并写回明文（用于查看/继续编辑）；口令错误返回 null */
  const decryptNote = useCallback(
    async (id: string, password: string): Promise<StickySecContent | null> => {
      const cur = listRef.current.find((n) => n.id === id);
      if (!cur || !cur.enc_data) return null;
      const sec = await decryptSecContent(password, cur.enc_data);
      if (!sec) return null; // 口令错误
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                encrypted: false,
                enc_data: undefined as string | undefined,
                title: sec.title,
                items: sec.items,
                body: sec.body,
                content_type: sec.content_type,
                updated_at: Date.now(),
              }
            : n,
        ),
      );
      return sec;
    },
    [],
  );

  /** 加密态便签：用同一口令把当前内容重新加密写回（保持存储为密文，边编即改密） */
  const updateEncryptedContent = useCallback(
    async (id: string, password: string, content: StickySecContent): Promise<void> => {
      const encData = await encryptSecContent(password, content);
      if (!encData) return;
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === id && n.encrypted
            ? { ...n, enc_data: encData, updated_at: Date.now() }
            : n,
        ),
      );
    },
    [],
  );

  return {
    stickyNotes,
    activeWorkspaceId,
    createSticky,
    duplicateSticky,
    updateSticky,
    deleteSticky,
    removeSticky,
    switchContentType,
    toggleFloating,
    setAllFloating,
    setAllThemes,
    addItem,
    updateItem,
    removeItem,
    setItemDone,
    setLocked,
    encryptNote,
    decryptNote,
    updateEncryptedContent,
  };
}

// ══════════════════════════════════════════════════════════════
// 迁移：两套旧数据 → 统一存储（按工作区隔离 key）
// ══════════════════════════════════════════════════════════════
function loadOrMigrate(ws?: string): StickyNote[] {
  // 旧默认宽度(320/300) → 统一为"卷起(最小化)状态"宽度 260px，
  // 使之前创建的存量便签也跟随新的窄默认（仅针对从未被主动改过的旧默认值）
  const LEGACY_DEFAULT_WIDTHS: Array<number | null | undefined> = [320, 300];
  const ROLLUP_WIDTH = 260;
  const rawExisting = readUnifiedStickies(ws);
  const existing = rawExisting.map((n) =>
    n && LEGACY_DEFAULT_WIDTHS.includes(n.width)
      ? { ...n, width: ROLLUP_WIDTH, updated_at: Date.now() }
      : n,
  );
  const widthChanged = existing.some((n, i) => n.width !== rawExisting[i]?.width);
  if (widthChanged) writeUnifiedStickies(ws, existing);
  // 已有统一数据：直接返回
  if (existing.length > 0) return existing;

  const merged: StickyNote[] = [];

  // 1) 旧浮动便签（__app_yixian_floating_notes[:ws]）
  try {
    const rawFloat = localStorage.getItem(legacyFloatingStorageKey(ws));
    if (rawFloat) {
      const arr = JSON.parse(rawFloat) as unknown[];
      if (Array.isArray(arr)) {
        arr
          .filter((x) => x && !isUnifiedSticky(x))
          .forEach((x) => merged.push(fromLegacyFloating(x as never)));
      }
    }
  } catch {
    /* ignore */
  }

  // 2) 旧便签墙（yixian_sticky_notes[:ws]）
  try {
    const rawSticky = localStorage.getItem(legacyStickyStorageKey(ws));
    if (rawSticky) {
      const arr = JSON.parse(rawSticky) as unknown[];
      if (Array.isArray(arr)) {
        arr
          .filter((x) => x && !isUnifiedSticky(x))
          .forEach((x) => merged.push(fromLegacySticky(x as never)));
      }
    }
  } catch {
    /* ignore */
  }

  // 按 id 去重（浮动优先）
  const seen = new Set<string>();
  const deduped: StickyNote[] = [];
  for (const n of merged) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    deduped.push(n);
  }

  if (deduped.length > 0) {
    writeUnifiedStickies(ws, deduped);
  }
  return deduped;
}