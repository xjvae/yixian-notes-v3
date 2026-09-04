// 笔记操作 Hook — 笔记、标签、便签、任务、模板、剪贴板的 CRUD
//
// 阶段0/1 重构：将「读 mock + 读写 localStorage + 后端同步」的数据访问
// 收口到 Repository 层（src/lib/repositories），本 Hook 只负责组合状态
// 与操作逻辑，保持对外返回结构不变，调用方无需改动。
import { useState, useCallback, useRef } from "react";
import {
  MOCK_NOTES,
  type INote, type ITag, type IStickyNote, type ITodo, type ITemplate,
  type IClipboardItem,
} from "@/data/notes";
import { ACTIVE_NOTE_KEY, ACTIVE_FILTER_KEY } from "./useWorkspaceStorage";
import { useNotesRepository } from "@/lib/repositories";
import { genId } from "@/lib/id";
import { plainTextToExcerpt } from "@/lib/text";
import {
  extractNoteSecContent,
  encryptNoteSec,
  decryptNoteSec,
  isNoteEncrypted,
} from "@/lib/note-sec";

export function useNoteOperations(activeWorkspaceId: string) {
  // 数据访问收口到 Repository：状态加载、localStorage 落盘、后端桥接统一在此
  const {
    notes, tags, stickyNotes, todos, templates, clipboard, notebooks,
    setNotes, setTags, setStickyNotes, setTodos, setTemplates, setClipboard, setNotebooks,
  } = useNotesRepository(activeWorkspaceId);

  // 供内部回调读取最新列表（避免异步回调闭包陈旧）
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_NOTE_KEY);
    if (stored) return stored;
    const firstNonDeleted = MOCK_NOTES.find((n) => !n.isDeleted);
    return firstNonDeleted?.id ?? "n1";
  });
  const [activeFilter, setActiveFilter] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_FILTER_KEY);
    return stored ?? "all";
  });

  // 笔记操作
  const handleNoteSelect = useCallback((id: string) => { setActiveNoteId(id); }, []);
  const handleFilterChange = useCallback((filter: string) => { setActiveFilter(filter); }, []);

  const handleNoteUpdate = useCallback((id: string, updates: Partial<INote>) => {
    setNotes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      let merged = { ...n, ...updates, updatedAt: Date.now() };
      // 加密态保护：不允许通过普通更新污染明文（加密笔记的标题/正文是空的，只作展示占位）
      if (isNoteEncrypted(merged)) {
        merged = { ...merged, title: "🔒 已加密笔记", content: "", excerpt: "" };
      }
      return merged;
    }));
  }, [notes, setNotes]);

  // 加密操作：加密、解密、更新加密内容、锁定/解锁
  const handleNoteEncrypt = useCallback(async (id: string, password: string): Promise<boolean> => {
    const cur = notesRef.current.find((n) => n.id === id);
    if (!cur || isNoteEncrypted(cur)) return false;
    const encData = await encryptNoteSec(password, extractNoteSecContent(cur));
    if (!encData) return false;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              encrypted: true,
              enc_data: encData,
              // 加密后明文置空（仅存密文，标题变占位）
              title: "🔒 已加密笔记",
              content: "",
              excerpt: "",
              updatedAt: Date.now(),
            }
          : n,
      ),
    );
    return true;
  }, [setNotes]);

  const handleNoteDecrypt = useCallback(async (id: string, password: string): Promise<boolean> => {
    const cur = notesRef.current.find((n) => n.id === id);
    if (!cur || !isNoteEncrypted(cur)) return false;
    if (!cur.enc_data) return false;
    const plain = await decryptNoteSec(password, cur.enc_data);
    if (!plain) return false;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              encrypted: false,
              enc_data: undefined,
              title: plain.title,
              content: plain.content,
              excerpt: plain.excerpt ?? plainTextToExcerpt(plain.content, 80, { ellipsis: false }),
              updatedAt: Date.now(),
            }
          : n,
      ),
    );
    return true;
  }, [setNotes]);

  // 设置加密锁定状态（锁定时不显示明文，只显示占位）
  const handleSetNoteLocked = useCallback((id: string, locked: boolean) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (locked && isNoteEncrypted(n)) {
          return { ...n, title: "🔒 已加密笔记", content: "", excerpt: "" };
        }
        return n;
      }),
    );
  }, [setNotes]);

  const handleImportNotes = useCallback(
    (imported: INote[]) => {
      if (!imported || imported.length === 0) return 0;
      const existing = new Set(notes.map((n) => n.id));
      const normalized = imported
        .filter((n) => n && !existing.has(n.id))
        .map((n, i) => ({
          ...n,
          id: n.id || `n-import-${Date.now()}-${i}`,
          isDeleted: false,
          updatedAt: n.updatedAt ?? Date.now(),
        }));
      if (normalized.length === 0) return 0;
      const next = [...notes, ...normalized];
      setNotes(next);
      return normalized.length;
    },
    [notes, setNotes],
  );

  const handleNewNote = useCallback(
    (opts?: { template?: ITemplate; notebookId?: string }) => {
      const now = Date.now();
      const today = new Date();
      const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
      const timeStr = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
      const weekNum = Math.ceil(
        ((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(today.getFullYear(), 0, 1).getDay() + 1) / 7,
      ).toString();

      let title = "无标题笔记";
      let content = "<p>开始记录你的想法...</p>";
      let excerpt = "开始记录你的想法...";
      const tagIds: string[] = [];

      if (opts?.template) {
        const tpl = opts.template;
        title = tpl.name;
        let replaced = tpl.content
          .replace(/\{\{日期\}\}/g, dateStr)
          .replace(/\{\{时间\}\}/g, timeStr)
          .replace(/\{\{昨日日期\}\}/g, (() => { const y = new Date(now - 86400000); return `${y.getFullYear()}年${y.getMonth() + 1}月${y.getDate()}日`; })())
          .replace(/\{\{开始日期\}\}/g, dateStr)
          .replace(/\{\{结束日期\}\}/g, (() => { const y = new Date(now + 6 * 86400000); return `${y.getFullYear()}年${y.getMonth() + 1}月${y.getDate()}日`; })())
          .replace(/\{\{出发日期\}\}/g, dateStr)
          .replace(/\{\{返回日期\}\}/g, (() => { const y = new Date(now + 6 * 86400000); return `${y.getFullYear()}年${y.getMonth() + 1}月${y.getDate()}日`; })())
          .replace(/\{\{周数\}\}/g, weekNum)
          .replace(/\{\{姓名\}\}/g, "我")
          .replace(/\{\{主持人\}\}/g, "我")
          .replace(/\{\{负责人\}\}/g, "我")
          .replace(/\{\{汇报人\}\}/g, "我")
          .replace(/\{\{参会人\}\}/g, "同事 A、同事 B")
          .replace(/\{\{同行人\}\}/g, "朋友 / 家人")
          .replace(/\{\{作者\}\}/g, "待填写")
          .replace(/\{\{书名\}\}/g, "待填写书名")
          .replace(/\{\{项目名称\}\}/g, "新项目")
          .replace(/\{\{会议主题\}\}/g, "会议主题")
          .replace(/\{\{目的地\}\}/g, "旅行目的地")
          .replace(/\{\{灵感标题\}\}/g, "我的灵感")
          .replace(/\{\{分类\}\}/g, "灵感")
          .replace(/\{\{\w+\}\}/g, "");
        content = replaced;
        const tmp = document.createElement("div");
        tmp.innerHTML = replaced;
        excerpt = plainTextToExcerpt((tmp.innerText || tmp.textContent || ""), 80, { ellipsis: false });
        setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, usageCount: t.usageCount + 1 } : t)));
      }

      const newNote: INote = {
        id: `n${now}`, title, content, excerpt,
        notebookId: opts?.notebookId ?? "nb1",
        tags: tagIds, isFavorite: false, isDeleted: false, isPinned: false, sortOrder: Date.now(),
        createdAt: now, updatedAt: now,
      };
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setActiveFilter("all");
      return newNote;
    },
    [setNotes, setTemplates],
  );

  const handleBatchUpdate = useCallback((ids: string[], updates: Partial<INote>) => {
    setNotes((prev) => {
      const next = prev.map((n) => (ids.includes(n.id) ? { ...n, ...updates, updatedAt: Date.now() } : n));
      return next;
    });
  }, [setNotes]);

  // 批量元数据更新：仅写指定字段，不改动 updatedAt/版本，避免影响"最近更新"排序
  const handleBatchUpdateMeta = useCallback((ids: string[], updates: Partial<INote>) => {
    if (!ids || ids.length === 0) return;
    setNotes((prev) => {
      return prev.map((n) => {
        if (!ids.includes(n.id)) return n;
        return { ...n, ...updates };
      });
    });
  }, [setNotes]);

  // 手动排序专用更新：仅写 sortOrder，不触碰 updatedAt
  const handleReorderNotes = useCallback((orderedIds: string[]) => {
    if (!orderedIds || orderedIds.length === 0) return;
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    setNotes((prev) => {
      return prev.map((n) => {
        if (!orderMap.has(n.id)) return n;
        const sortOrder = orderMap.get(n.id)!;
        if (n.sortOrder === sortOrder) return n;
        return { ...n, sortOrder };
      });
    });
  }, [setNotes]);

  const handleBatchDelete = useCallback((ids: string[], permanent = false) => {
    if (permanent) { setNotes((prev) => prev.filter((n) => !ids.includes(n.id))); }
    else {
      setNotes((prev) => {
        const next = prev.map((n) => (ids.includes(n.id) ? { ...n, isDeleted: true, updatedAt: Date.now() } : n));
        return next;
      });
    }
  }, [setNotes]);

  const handleBatchRestore = useCallback((ids: string[]) => {
    setNotes((prev) => {
      const next = prev.map((n) => (ids.includes(n.id) ? { ...n, isDeleted: false, updatedAt: Date.now() } : n));
      return next;
    });
  }, [setNotes]);

  const handleEmptyTrash = useCallback(() => { setNotes((prev) => prev.filter((n) => !n.isDeleted)); }, [setNotes]);

  // 标签操作
  const handleAddTag = useCallback((tag: ITag) => { setTags((prev) => [...prev, tag]); }, [setTags]);
  const handleUpdateTag = useCallback((id: string, updates: Partial<ITag>) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, [setTags]);
  const handleDeleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setNotes((prev) => prev.map((n) => ({ ...n, tags: n.tags.filter((t) => t !== id) })));
  }, [setTags, setNotes]);
  const handleMergeTags = useCallback((fromId: string, toId: string) => {
    setNotes((prev) => prev.map((n) => {
      if (!n.tags.includes(fromId)) return n;
      const newTags = [...n.tags.filter((t) => t !== fromId)];
      if (!newTags.includes(toId)) newTags.push(toId);
      return { ...n, tags: newTags, updatedAt: Date.now() };
    }));
    setTags((prev) => prev.filter((t) => t.id !== fromId));
  }, [setTags, setNotes]);

  // 便签操作
  const handleStickyCreate = useCallback((color: string) => {
    const newSticky: IStickyNote = {
      id: `s${Date.now()}`, content: "", color,
      x: 50 + Math.random() * 200, y: 50 + Math.random() * 150,
      notebookId: "nb1", createdAt: Date.now(), updatedAt: Date.now(),
      pinned: false, width: 208, height: 208,
      zIndex: Date.now(),
    };
    setStickyNotes((prev) => [...prev, newSticky]);
  }, [setStickyNotes]);

  const handleStickyUpdate = useCallback((id: string, updates: Partial<IStickyNote>) => {
    setStickyNotes((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s));
      return next;
    });
  }, [setStickyNotes]);

  const handleStickyDelete = useCallback((id: string) => {
    setStickyNotes((prev) => prev.filter((s) => s.id !== id));
  }, [setStickyNotes]);

  // 任务操作
  const handleTodoCreate = useCallback((todo: Partial<ITodo>) => {
    const newTodo: ITodo = {
      id: `td${Date.now()}`, title: todo.title ?? "新任务", description: todo.description ?? "",
      priority: todo.priority ?? "medium", status: "pending", dueDate: todo.dueDate ?? null,
      notebookId: todo.notebookId ?? "nb1", tags: todo.tags ?? [], relatedNoteId: todo.relatedNoteId ?? null,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    setTodos((prev) => [newTodo, ...prev]);
  }, [setTodos]);
  const handleTodoUpdate = useCallback((id: string, updates: Partial<ITodo>) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)));
  }, [setTodos]);
  const handleTodoToggle = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed", updatedAt: Date.now() } : t)));
  }, [setTodos]);
  const handleTodoDelete = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, [setTodos]);

  // 模板操作
  const handleTemplateCreate = useCallback((template: Partial<ITemplate>) => {
    const newTpl: ITemplate = {
      id: `tpl${Date.now()}`, name: template.name ?? "自定义模板", description: template.description ?? "",
      category: template.category ?? "自定义", preview: template.preview ?? "📄",
      content: template.content ?? "<p>开始书写...</p>", usageCount: 0,
      isFavorite: false, isCustom: true, createdAt: Date.now(),
    };
    setTemplates((prev) => [newTpl, ...prev]);
  }, [setTemplates]);
  const handleTemplateUpdate = useCallback((id: string, updates: Partial<ITemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, [setTemplates]);
  const handleTemplateDelete = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [setTemplates]);

  // 剪贴板操作
  const handleClipboardPin = useCallback((id: string) => {
    setClipboard((prev) => prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)));
  }, [setClipboard]);
  const handleClipboardDelete = useCallback((id: string) => {
    setClipboard((prev) => prev.filter((c) => c.id !== id));
  }, [setClipboard]);
  const handleClipboardClear = useCallback(() => {
    setClipboard((prev) => prev.filter((c) => c.isPinned));
  }, [setClipboard]);
  // 把「监听捕获到的新剪贴板内容」写入历史；内容重复时自动合并并累加复制次数
  const handleClipboardAdd = useCallback((raw: string) => {
    const content = (raw ?? "").trim();
    if (!content) return;
    setClipboard((prev) => {
      const existing = prev.find((c) => c.content === content);
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id ? { ...c, copyCount: (c.copyCount ?? 1) + 1 } : c,
        );
      }
      const type: IClipboardItem["type"] = /^https?:\/\/\S+$/i.test(content) ? "link" : "text";
      const item: IClipboardItem = {
        id: genId("cb", 5),
        type,
        content,
        preview: content.slice(0, 80),
        sourceApp: "系统剪贴板",
        createdAt: Date.now(),
        isPinned: false,
        copyCount: 1,
      };
      return [item, ...prev];
    });
  }, [setClipboard]);
  // 手动复制某条记录时累加其复制次数
  const handleClipboardIncrement = useCallback((id: string) => {
    setClipboard((prev) =>
      prev.map((c) => (c.id === id ? { ...c, copyCount: (c.copyCount ?? 0) + 1 } : c)),
    );
  }, [setClipboard]);

  // 计算值
  const noteCounts = useNoteCounts(notes);

  const todoCount = todos.filter((t) => t.status === "pending").length;
  const favoriteCount = notes.filter((n) => n.isFavorite && !n.isDeleted).length;
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  return {
    // 状态
    notes, setNotes,
    tags, setTags,
    stickyNotes, setStickyNotes,
    todos, setTodos,
    templates, setTemplates,
    clipboard, setClipboard,
    notebooks, setNotebooks,
    activeNoteId, setActiveNoteId,
    activeFilter, setActiveFilter,
    // 计算值
    noteCounts, todoCount, favoriteCount, activeNote,
    // 操作
    handleNoteSelect, handleFilterChange, handleNoteUpdate, handleNewNote,
    handleNoteEncrypt, handleNoteDecrypt, handleSetNoteLocked,
    handleImportNotes,
    handleBatchUpdate, handleBatchDelete, handleBatchRestore, handleEmptyTrash,
    handleBatchUpdateMeta,
    handleReorderNotes,
    handleAddTag, handleUpdateTag, handleDeleteTag, handleMergeTags,
    handleStickyCreate, handleStickyUpdate, handleStickyDelete,
    handleTodoCreate, handleTodoUpdate, handleTodoToggle, handleTodoDelete,
    handleTemplateCreate, handleTemplateUpdate, handleTemplateDelete,
    handleClipboardPin, handleClipboardDelete, handleClipboardClear, handleClipboardAdd,
    handleClipboardIncrement,
  };
}

function useNoteCounts(notes: INote[]) {
  const counts: Record<string, number> = {
    all: notes.filter((n) => !n.isDeleted).length,
    favorite: notes.filter((n) => n.isFavorite && !n.isDeleted).length,
    trash: notes.filter((n) => n.isDeleted).length,
  };
  notes.forEach((n) => {
    if (!n.isDeleted) {
      const nbKey = `nb:${n.notebookId}`;
      counts[nbKey] = (counts[nbKey] ?? 0) + 1;
      n.tags.forEach((t) => { const tagKey = `tag:${t}`; counts[tagKey] = (counts[tagKey] ?? 0) + 1; });
    }
  });
  return counts;
}