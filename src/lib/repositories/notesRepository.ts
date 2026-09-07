// ============================================================
// Repository 层 — 数据访问收口（阶段0/1）
//
// 目的：把「读 localStorage + 写后端」从页面/Hook 中抽离，
//      统一由 Repository 负责数据获取与持久化。后续 SQLite 接管
//      主链路时，只改这里，不动页面。
// 说明：当前仍以 localStorage 作为前端真实源，Repository 负责
//      数据的加载、写入与后端桥接（渐进式同步）。
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
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
import { isNoteEncrypted } from "@/lib/note-sec";

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

  // 从后端 SQLite 加载并合并本地加密密文，写回 notes。返回是否成功覆盖。
  const reloadFromBackend = useCallback(async (): Promise<boolean> => {
    const serverNotes = await loadNotesFromBackend();
    if (serverNotes === null) return false;
    if (serverNotes.length > 0) {
      // SQLite 为真实源：覆盖本地，并合并 localStorage 缓存。
      // 加密笔记保护：密文只存本地（enc_data），后端可能尚未同步或仅存于
      // metadata。若本地已加密且携带密文，优先保留本地，避免重载后才解密丢失。
      const localById = new Map(rawStoreRef.current.notes.map((n) => [n.id, n]));
      const merged = serverNotes.map((server) => {
        const local = localById.get(server.id);
        if (local && isNoteEncrypted(local)) {
          return { ...server, encrypted: true, enc_data: local.enc_data };
        }
        return server;
      });
      // 本地新增的加密笔记（后端尚不存在）也要保留密文
      rawStoreRef.current.notes.forEach((local) => {
        if (isNoteEncrypted(local) && !merged.some((s) => s.id === local.id)) {
          merged.push(local);
        }
      });
      setNotes(merged);
      return true;
    }
    // 空库：把当前本地笔记作为种子一次性写入 SQLite
    void syncNotesToBackend(rawStoreRef.current.notes);
    return false;
  }, [setNotes]);

  useEffect(() => {
    void reloadFromBackend();
    // 仅在挂载时执行一次，避免重复监听
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 快捷新建笔记弹窗保存后：从 SQLite 重载，让新笔记立即出现在主列表；
  // 然后用浏览器事件通知主窗口选中该笔记（activeNoteId 由 useNoteOperations 持有）。
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<{ id?: string }>("popup:note-created", async (e) => {
        const id = e.payload?.id;
        await reloadFromBackend();
        if (id) window.dispatchEvent(new CustomEvent("yixian:select-note", { detail: id }));
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [reloadFromBackend]);

  // 快捷新建弹窗保存后会写入本工作区的 localStorage 笔记列表，
  // 同源多窗口会触发 storage 事件；据此从 SQLite 重载，保证弹窗新建笔记即时可见。
  const notesLocalKey = getStorageKey(NOTES_STORAGE_KEY, activeWorkspaceId);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === notesLocalKey) void reloadFromBackend();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [notesLocalKey, reloadFromBackend]);

  // ─── 自动保存调度（阶段2） ──────────────
  // 防抖 1000ms 后仅把「发生变化」的笔记增量 upsert（而非每次全量重写），
  // 同时把物理删除的笔记从 SQLite 镜像中显式删除；便签/待办随同批量调度。
  const mirrorRef = useRef<{ lastSynced: Map<string, string> }>({ lastSynced: new Map() });

  // 笔记内容指纹：任一相关字段变化即视为「发生修改」。
  const noteFingerprint = (n: INote) =>
    JSON.stringify({
      t: n.title, c: n.content, e: n.excerpt, nb: n.notebookId, tags: n.tags,
      fav: n.isFavorite, pin: n.isPinned, del: n.isDeleted, ts: n.updatedAt,
    });

  // 监听 notes 变化：防抖 1s 后增量同步到后端。
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const lastSynced = mirrorRef.current.lastSynced;
      try {
        // 仅挑选「新增或内容有变」的笔记，避免每次全量重写
        const changed = notes.filter((n) => lastSynced.get(n.id) !== noteFingerprint(n));
        // 上次已存在、但本次已从本地消失的 id → 物理删除
        const removedIds = notes.length <= 0
          ? []
          : [...lastSynced.keys()].filter((id) => !notes.some((n) => n.id === id));
        if (removedIds.length > 0) await deleteNotesFromBackend(removedIds.slice(0, 200));
        if (changed.length > 0) await syncNotesToBackend(changed);
        // 便签 / 待办仍随同一调度批量落库
        if (stickyNotes.length > 0) await syncStickiesToBackend(stickyNotes);
        if (todos.length > 0) await syncTodosToBackend(todos);
      } finally {
        // 兜底：无论是否成功都更新 lastSynced，避免异常导致反复全量重发
        mirrorRef.current.lastSynced =
          notes.length === 0
            ? new Map()
            : new Map(notes.map((n) => [n.id, noteFingerprint(n)]));
      }
    }, 1000);
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