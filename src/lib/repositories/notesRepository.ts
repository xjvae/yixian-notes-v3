// ============================================================
// Repository 层 — 数据访问收口（阶段0/1）
//
// 目的：把「读 localStorage + 写后端」从页面/Hook 中抽离，
//      统一由 Repository 负责数据获取与持久化。后续 SQLite 接管
//      主链路时，只改这里，不动页面。
// 说明：当前仍以 localStorage 作为前端真实源，Repository 负责
//      数据的加载、写入与后端桥接（渐进式同步）。
// ============================================================

import { useState, useEffect, useRef } from "react";
import {
  MOCK_NOTES,
  MOCK_TAGS,
  MOCK_STICKY_NOTES,
  MOCK_TODOS,
  MOCK_TEMPLATES,
  MOCK_CLIPBOARD,
  MOCK_NOTEBOOKS,
  type INote,
  type ITag,
  type IStickyNote,
  type ITodo,
  type ITemplate,
  type IClipboardItem,
  type INotebook,
} from "@/data/notes";
import {
  NOTES_STORAGE_KEY,
  TAGS_STORAGE_KEY,
  STICKY_STORAGE_KEY,
  TODOS_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
  CLIPBOARD_STORAGE_KEY,
  NOTEBOOKS_STORAGE_KEY,
  getStorageKey,
} from "@/hooks/useWorkspaceStorage";
import { loadJSON, saveJSON } from "@/hooks/useLocalStorage";
import {
  syncNoteToBackend,
  syncStickyToBackend,
  syncNotesToBackend,
  syncStickiesToBackend,
  deleteNotesFromBackend,
  loadNotesFromBackend,
  syncTodosToBackend,
} from "@/lib/backend";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

/** 单项领域集合的持久化访问器：返回 [value, setter(自动落盘)] */
export function usePersisted<T>(key: string, fallback: T): [T, Setter<T>] {
  const [value, setValue] = useState<T>(() => loadJSON(key, fallback));
  const setPersisted: Setter<T> = (updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      saveJSON(key, next);
      return next;
    });
  };
  return [value, setPersisted];
}

/**
 * 提供工作区内全部业务对象的持久化状态与写入句柄。
 * 写入时同步落 localStorage，并将变更批量桥接到后端（Tauri 可用时）。
 */
export function useNotesRepository(activeWorkspaceId: string) {
  const [notes, setNotes] = usePersisted<INote[]>(getStorageKey(NOTES_STORAGE_KEY, activeWorkspaceId), MOCK_NOTES);
  const [tags, setTags] = usePersisted<ITag[]>(getStorageKey(TAGS_STORAGE_KEY, activeWorkspaceId), MOCK_TAGS);
  const [stickyNotes, setStickyNotes] = usePersisted<IStickyNote[]>(getStorageKey(STICKY_STORAGE_KEY, activeWorkspaceId), MOCK_STICKY_NOTES);
  const [todos, setTodos] = usePersisted<ITodo[]>(getStorageKey(TODOS_STORAGE_KEY, activeWorkspaceId), MOCK_TODOS);
  const [templates, setTemplates] = usePersisted<ITemplate[]>(getStorageKey(TEMPLATES_STORAGE_KEY, activeWorkspaceId), MOCK_TEMPLATES);
  const [clipboard, setClipboard] = usePersisted<IClipboardItem[]>(getStorageKey(CLIPBOARD_STORAGE_KEY, activeWorkspaceId), MOCK_CLIPBOARD);
  const [notebooks, setNotebooks] = usePersisted<INotebook[]>(getStorageKey(NOTEBOOKS_STORAGE_KEY, activeWorkspaceId), MOCK_NOTEBOOKS);

  // SQLite 接管主链路（阶段2）：启动时以 SQLite 为真实源加载笔记。
  // - SQLite 有数据 → 以它为准覆盖本地（localStorage 降级为离线缓存）。
  // - SQLite 空库   → 用当前本地初值（localStorage/MOCK）作为种子一次性写入，建立基线。
  // - 非 Tauri / 失败 → 保持 localStorage 逻辑（渐进式降级）。
  const rawStoreRef = useRef<{ notes: INote[] }>({ notes });
  rawStoreRef.current = { notes };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverNotes = await loadNotesFromBackend();
      if (cancelled || serverNotes === null) return;
      if (serverNotes.length > 0) {
        // SQLite 为真实源：覆盖本地，并同步回 localStorage 缓存
        setNotes(serverNotes);
      } else {
        // 空库：把当前本地笔记作为种子一次性写入 SQLite
        void syncNotesToBackend(rawStoreRef.current.notes);
      }
    })();
    return () => { cancelled = true; };
    // 仅在挂载时执行一次
  }, []);

  // ─── 自动保存调度（阶段2）──────────────
  // 不再"每次状态变更都立即触发 IPC"，改为状态变化后防抖批量全量镜像：
  //  - 高频编辑（输入/拖拽/开关）期间不写后端，停顿后仅一次批量 IPC。
  //  - 物理删除的笔记从 SQLite 镜像中显式删除（save_notes_batch 为 upsert，不删多余）。
  const mirrorRef = useRef<{ lastNoteIds: Set<string> }>({ lastNoteIds: new Set() });

  // 监听 notes 变化：防抖 500ms 后全量批量镜像到后端
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        // 处理物理删除：上一次已镜像、但本次已从本地消失的 id
        const removedIds: string[] = [];
        mirrorRef.current.lastNoteIds.forEach((id) => {
          if (removedIds.length < 200 && !notes.some((n) => n.id === id)) removedIds.push(id);
        });
        if (removedIds.length > 0) await deleteNotesFromBackend(removedIds);
        await syncNotesToBackend(notes);
        // 便签也进入同一调度，随笔记一起批量写入
        await syncStickiesToBackend(stickyNotes);
        // 待办进入同一调度，打通「计划 → 执行」后端落库
        await syncTodosToBackend(todos);
      } finally {
        mirrorRef.current.lastNoteIds = new Set(notes.map((n) => n.id));
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [notes, stickyNotes, todos]);

  // 后端桥接（兼容旧调用点；成效经上面的防抖 effect 兜底，这里仅做即时补充）
  const sync = {
    note: (n: INote) => {
      try {
        void syncNoteToBackend(n);
      } catch {
        /* ignore */
      }
    },
    notes: (list: INote[]) => {
      try {
        void syncNotesToBackend(list);
      } catch {
        /* ignore */
      }
    },
    sticky: (s: IStickyNote) => {
      try {
        void syncStickyToBackend(s);
      } catch {
        /* ignore */
      }
    },
  };

  return {
    notes,
    tags,
    stickyNotes,
    todos,
    templates,
    clipboard,
    notebooks,
    setNotes,
    setTags,
    setStickyNotes,
    setTodos,
    setTemplates,
    setClipboard,
    setNotebooks,
    sync,
  };
}

export type NotesRepository = ReturnType<typeof useNotesRepository>;