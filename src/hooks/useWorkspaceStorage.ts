// 工作区存储管理 — storage key 常量、workspace 隔离逻辑、CRUD、迁移、导入/导出
import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  MOCK_NOTES,
  MOCK_TAGS,
  MOCK_NOTEBOOKS,
  MOCK_WORKSPACES,
  WORKSPACE_THEMES,
  WORKSPACE_TEMPLATES,
  WORKSPACE_PERSONALITY_MAP,
  type INote,
  type IStickyNote,
  type ITag,
  type ITodo,
  type ITemplate,
  type INotebook,
  type IWorkspace,
  type WorkspaceTemplateKey,
} from "@/data/notes";
import { loadJSON, saveJSON, wsKey } from "./useLocalStorage";

// ===== Storage Key 常量 =====
export const NOTES_STORAGE_KEY = "yixian_notes";
export const STICKY_STORAGE_KEY = "yixian_sticky_notes";
export const SETTINGS_STORAGE_KEY = "yixian_settings";
export const TAGS_STORAGE_KEY = "yixian_tags";
export const ACTIVE_NOTE_KEY = "yixian_active_note_id";
export const ACTIVE_FILTER_KEY = "yixian_active_filter";
export const TODOS_STORAGE_KEY = "yixian_todos";
export const TEMPLATES_STORAGE_KEY = "yixian_templates";
export const CLIPBOARD_STORAGE_KEY = "yixian_clipboard";
export const PRIVACY_STORAGE_KEY = "yixian_privacy";
export const NOTIFICATIONS_STORAGE_KEY = "yixian_notifications";
export const REMINDERS_STORAGE_KEY = "yixian_reminders";
export const NOTIF_SETTINGS_STORAGE_KEY = "yixian_notification_settings";
export const NOTEBOOKS_STORAGE_KEY = "yixian_notebooks";
export const FLASH_STORAGE_KEY = "yixian_flash_thoughts";
export const DAILY_RECORD_KEY = "yixian_daily_record";
export const FLASHCARDS_STORAGE_KEY = "yixian_flashcards";
export const WORKSPACES_KEY = "yixian_workspaces";
export const ACTIVE_WORKSPACE_KEY = "yixian_active_workspace";
export const ONBOARDED_KEY = "yixian_onboarded";
export const ENABLED_FEATURES_KEY = "yixian_enabled_features";

// 各工作区共享的全局数据（不随工作区切换）
const GLOBAL_KEYS = new Set([
  WORKSPACES_KEY, ACTIVE_WORKSPACE_KEY, SETTINGS_STORAGE_KEY, PRIVACY_STORAGE_KEY,
  NOTIF_SETTINGS_STORAGE_KEY,
  FLASHCARDS_STORAGE_KEY,
]);

export function getStorageKey(baseKey: string, workspaceId: string): string {
  if (GLOBAL_KEYS.has(baseKey)) return baseKey;
  return wsKey(baseKey, workspaceId);
}

// 根据 themeKey 获取预设主题配置
export function getThemeByKey(key?: string) {
  return WORKSPACE_THEMES.find((t) => t.key === key) ?? WORKSPACE_THEMES[0];
}

// 将工作区主题色应用到全局 CSS 变量
export function applyWorkspaceTheme(themeKey?: string) {
  const theme = getThemeByKey(themeKey);
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primaryLight);
  root.style.setProperty("--ring", theme.ring);
}

// 生成工作区模板数据
export function generateWorkspaceTemplateData(templateKey: WorkspaceTemplateKey) {
  const template = WORKSPACE_TEMPLATES.find((t) => t.key === templateKey) ?? WORKSPACE_TEMPLATES[0];
  const now = Date.now();

  const notebooks: INotebook[] = template.notebooks.map((nb, i) => ({
    id: `tpl_nb_${i}`, name: nb.name, icon: nb.icon, color: nb.color,
    createdAt: now - (template.notebooks.length - i) * 60000,
  }));

  const tags: ITag[] = template.tags.map((t, i) => ({
    id: `tpl_tag_${i}`, name: t.name, color: t.color,
  }));

  const notes: INote[] = template.sampleNotes.map((sn, i) => {
    const notebook = notebooks[sn.notebookIndex] ?? notebooks[0];
    const tagIds = sn.tags.map((tname) => tags.find((t) => t.name === tname)?.id).filter(Boolean) as string[];
    return {
      id: `tpl_note_${i}`, title: sn.title, content: sn.content,
      excerpt: sn.content.replace(/[#>*\-\n]/g, " ").slice(0, 80),
      notebookId: notebook.id, tags: tagIds, isFavorite: false, isDeleted: false, isPinned: false, sortOrder: i,
      createdAt: now - (template.sampleNotes.length - i) * 3600000,
      updatedAt: now - (template.sampleNotes.length - i) * 3600000,
    };
  });

  return { notebooks, tags, notes };
}

// 工作区推荐功能映射
const WORKSPACE_FEATURES: Record<string, string[]> = {
  ws1: [
    "notebooks", "templates",
    "todos", "calendar", "daily-review",
    "floating-notes", "sticky-wall", "clipboard", "export",
    "dashboard", "flashcards",
  ],
  ws2: [
    "notebooks", "templates",
    "todos", "calendar",
    "floating-notes", "clipboard", "export", "import",
    "dashboard", "ai-assistant", "notifications",
  ],
  ws3: [
    "notebooks", "templates",
    "todos", "calendar", "daily-review",
    "floating-notes", "clipboard", "export",
    "dashboard", "flashcards",
  ],
};

export function getWorkspaceFeatures(workspaceId: string): string[] {
  return WORKSPACE_FEATURES[workspaceId] ?? WORKSPACE_FEATURES.ws1;
}

// 当前工作区数据快照接口（用于统计和迁移）
export interface WorkspaceDataSnapshot {
  notes: INote[];
  stickyNotes: IStickyNote[];
  tags: ITag[];
  todos: ITodo[];
  notebooks: INotebook[];
}

// ===== 工作区存储 Hook =====
export function useWorkspaceStorage() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    return stored ?? "ws1";
  });

  const [workspaces, setWorkspaces] = useState<IWorkspace[]>(() => loadJSON(WORKSPACES_KEY, MOCK_WORKSPACES));

  // 持久化
  useEffect(() => saveJSON(WORKSPACES_KEY, workspaces), [workspaces]);
  useEffect(() => localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId), [activeWorkspaceId]);

  // 切换工作区时应用主题色
  useEffect(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    applyWorkspaceTheme(ws?.themeKey);
    if (ws) {
      setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? { ...w, lastActivityAt: Date.now() } : w)));
    }
  }, [activeWorkspaceId]);

  // 工作区切换
  const handleSwitchWorkspace = useCallback(
    (id: string) => {
      if (id === activeWorkspaceId) return;
      const targetWs = workspaces.find((w) => w.id === id);
      if (!targetWs) return;
      if (targetWs.archived) {
        toast.warning("该工作区已归档");
        return;
      }
      setActiveWorkspaceId(id);
      toast.success(`已切换到「${targetWs.name}」`);
    },
    [activeWorkspaceId, workspaces],
  );

  // 切换工作区（带过渡动画）
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [transitionWs, setTransitionWs] = useState<{ name: string; color: string; icon: string; slogan: string }>({ name: "", color: "", icon: "", slogan: "" });

  const switchWithTransition = useCallback(
    (id: string) => {
      const targetWs = workspaces.find((w) => w.id === id);
      if (!targetWs || targetWs.archived || id === activeWorkspaceId) {
        handleSwitchWorkspace(id);
        return;
      }
      setTransitionWs({ name: targetWs.name, color: targetWs.color, icon: targetWs.icon, slogan: WORKSPACE_PERSONALITY_MAP[id]?.slogan ?? "" });
      setTransitionVisible(true);
      setTimeout(() => handleSwitchWorkspace(id), 600);
      setTimeout(() => setTransitionVisible(false), 1800);
    },
    [workspaces, activeWorkspaceId, handleSwitchWorkspace],
  );

  // 创建工作区
  const handleAddWorkspace = useCallback(
    (ws: Omit<IWorkspace, "id" | "createdAt">, templateKey?: WorkspaceTemplateKey) => {
      const now = Date.now();
      const newId = `ws${now}`;
      const theme = getThemeByKey(ws.themeKey);
      const newWs: IWorkspace = {
        ...ws, id: newId, createdAt: now, lastActivityAt: now,
        order: workspaces.length, color: ws.color || theme.primary,
      };
      setWorkspaces((prev) => [...prev, newWs]);
      if (templateKey && templateKey !== "blank") {
        const { notebooks: nbs, tags: tgs, notes: nts } = generateWorkspaceTemplateData(templateKey);
        saveJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, newId), nbs);
        saveJSON(getStorageKey(TAGS_STORAGE_KEY, newId), tgs);
        saveJSON(getStorageKey(NOTES_STORAGE_KEY, newId), nts);
      }
      return newWs;
    },
    [workspaces.length],
  );

  // 删除工作区
  const handleDeleteWorkspace = useCallback(
    (id: string) => {
      if (id === activeWorkspaceId) {
        toast.error("不能删除当前活跃的工作区");
        return false;
      }
      const allKeys = [
        NOTES_STORAGE_KEY, STICKY_STORAGE_KEY, TAGS_STORAGE_KEY, TODOS_STORAGE_KEY,
        TEMPLATES_STORAGE_KEY, CLIPBOARD_STORAGE_KEY,
        NOTIFICATIONS_STORAGE_KEY, REMINDERS_STORAGE_KEY, NOTEBOOKS_STORAGE_KEY,
        FLASH_STORAGE_KEY, DAILY_RECORD_KEY,
      ];
      allKeys.forEach((k) => localStorage.removeItem(getStorageKey(k, id)));
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success("工作区已删除");
      return true;
    },
    [activeWorkspaceId],
  );

  // 更新工作区
  const handleUpdateWorkspace = useCallback((id: string, updates: Partial<IWorkspace>) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  // 重排序工作区
  const handleReorderWorkspaces = useCallback((fromId: string, toId: string) => {
    setWorkspaces((prev) => {
      const result = [...prev];
      const fromIdx = result.findIndex((w) => w.id === fromId);
      const toIdx = result.findIndex((w) => w.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = result.splice(fromIdx, 1);
      result.splice(toIdx, 0, moved);
      return result.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  // 数据迁移
  const handleMigrateWorkspace = useCallback(
    (params: { sourceId: string; targetId: string; types: ("notes" | "notebooks" | "tags" | "all")[]; mode: "copy" | "move" }) => {
      const { sourceId, targetId, types, mode } = params;
      if (sourceId === targetId) {
        toast.error("源工作区和目标工作区不能相同");
        return false;
      }
      const doAll = types.includes("all");
      const doNotes = doAll || types.includes("notes");
      const doNotebooks = doAll || types.includes("notebooks");
      const doTags = doAll || types.includes("tags");

      const sourceNotes = loadJSON(getStorageKey(NOTES_STORAGE_KEY, sourceId), [] as INote[]);
      const sourceNotebooks = loadJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, sourceId), [] as INotebook[]);
      const sourceTags = loadJSON(getStorageKey(TAGS_STORAGE_KEY, sourceId), [] as ITag[]);
      const targetNotes = loadJSON(getStorageKey(NOTES_STORAGE_KEY, targetId), MOCK_NOTES);
      const targetNotebooks = loadJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, targetId), MOCK_NOTEBOOKS);
      const targetTags = loadJSON(getStorageKey(TAGS_STORAGE_KEY, targetId), MOCK_TAGS);

      const idPrefix = `mig_${Date.now()}_`;
      const notebookIdMap = new Map<string, string>();
      const tagIdMap = new Map<string, string>();
      let migratedNotes = 0, migratedNotebooks = 0, migratedTags = 0;

      const mergedNotebooks = [...targetNotebooks];
      if (doNotebooks) {
        sourceNotebooks.forEach((nb) => {
          const newId = `${idPrefix}nb_${nb.id}`;
          notebookIdMap.set(nb.id, newId);
          mergedNotebooks.push({ ...nb, id: newId, createdAt: Date.now() });
          migratedNotebooks++;
        });
      }

      const mergedTags = [...targetTags];
      if (doTags) {
        sourceTags.forEach((t) => {
          const newId = `${idPrefix}tag_${t.id}`;
          tagIdMap.set(t.id, newId);
          mergedTags.push({ ...t, id: newId });
          migratedTags++;
        });
      }

      const mergedNotes = [...targetNotes];
      if (doNotes) {
        sourceNotes.forEach((n) => {
          const newId = `${idPrefix}note_${n.id}`;
          const newNotebookId = notebookIdMap.get(n.notebookId) ?? n.notebookId;
          const newTags = n.tags.map((tid) => tagIdMap.get(tid) ?? tid);
          mergedNotes.push({ ...n, id: newId, notebookId: newNotebookId, tags: newTags, updatedAt: Date.now() });
          migratedNotes++;
        });
      }

      saveJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, targetId), mergedNotebooks);
      saveJSON(getStorageKey(TAGS_STORAGE_KEY, targetId), mergedTags);
      saveJSON(getStorageKey(NOTES_STORAGE_KEY, targetId), mergedNotes);

      if (mode === "move") {
        if (doAll) {
          [NOTES_STORAGE_KEY, NOTEBOOKS_STORAGE_KEY, TAGS_STORAGE_KEY].forEach((k) => localStorage.removeItem(getStorageKey(k, sourceId)));
        } else {
          if (doNotes) localStorage.removeItem(getStorageKey(NOTES_STORAGE_KEY, sourceId));
          if (doNotebooks) localStorage.removeItem(getStorageKey(NOTEBOOKS_STORAGE_KEY, sourceId));
          if (doTags) localStorage.removeItem(getStorageKey(TAGS_STORAGE_KEY, sourceId));
        }
      }

      toast.success(`迁移完成：${migratedNotes} 篇笔记 / ${migratedNotebooks} 个笔记本 / ${migratedTags} 个标签`);
      return { migratedNotes, migratedNotebooks, migratedTags };
    },
    [],
  );

  // 导出工作区
  const handleExportWorkspace = useCallback(
    (id: string) => {
      const ws = workspaces.find((w) => w.id === id);
      if (!ws) return null;
      const data = {
        version: 1, exportedAt: Date.now(), workspace: ws,
        notes: loadJSON(getStorageKey(NOTES_STORAGE_KEY, id), [] as INote[]),
        notebooks: loadJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, id), [] as INotebook[]),
        tags: loadJSON(getStorageKey(TAGS_STORAGE_KEY, id), [] as ITag[]),
        todos: loadJSON(getStorageKey(TODOS_STORAGE_KEY, id), [] as ITodo[]),
        templates: loadJSON(getStorageKey(TEMPLATES_STORAGE_KEY, id), [] as ITemplate[]),
        stickyNotes: loadJSON(getStorageKey(STICKY_STORAGE_KEY, id), [] as IStickyNote[]),
      };
      return JSON.stringify(data, null, 2);
    },
    [workspaces],
  );

  // 导入工作区
  const handleImportWorkspace = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr) as {
        workspace: IWorkspace; notes: INote[]; notebooks: INotebook[]; tags: ITag[];
        todos: ITodo[]; templates: ITemplate[]; stickyNotes: IStickyNote[];
      };
      if (!data.workspace || !Array.isArray(data.notes)) {
        throw new Error("无效的工作区数据格式");
      }
      const newId = `ws${Date.now()}`;
      const newWs: IWorkspace = {
        ...data.workspace, id: newId,
        name: `${data.workspace.name}（导入）`,
        createdAt: Date.now(), lastActivityAt: Date.now(),
      };
      const prefix = `imp_${Date.now()}_`;
      const remapId = (oldId: string, type: string) => `${prefix}${type}_${oldId}`;
      const nbMap = new Map<string, string>();
      const tagMap = new Map<string, string>();

      const newNotebooks = (data.notebooks ?? []).map((nb) => {
        const nid = remapId(nb.id, "nb"); nbMap.set(nb.id, nid);
        return { ...nb, id: nid, createdAt: Date.now() };
      });
      const newTags = (data.tags ?? []).map((t) => {
        const tid = remapId(t.id, "tag"); tagMap.set(t.id, tid);
        return { ...t, id: tid };
      });
      const newNotes = (data.notes ?? []).map((n) => ({
        ...n, id: remapId(n.id, "note"),
        notebookId: nbMap.get(n.notebookId) ?? n.notebookId,
        tags: n.tags.map((tid) => tagMap.get(tid) ?? tid),
        createdAt: Date.now(), updatedAt: Date.now(),
      }));

      setWorkspaces((prev) => [...prev, newWs]);
      saveJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, newId), newNotebooks);
      saveJSON(getStorageKey(TAGS_STORAGE_KEY, newId), newTags);
      saveJSON(getStorageKey(NOTES_STORAGE_KEY, newId), newNotes);
      if (data.todos) saveJSON(getStorageKey(TODOS_STORAGE_KEY, newId), data.todos);
      if (data.templates) saveJSON(getStorageKey(TEMPLATES_STORAGE_KEY, newId), data.templates);
      if (data.stickyNotes) saveJSON(getStorageKey(STICKY_STORAGE_KEY, newId), data.stickyNotes);

      toast.success(`已导入工作区「${newWs.name}」`);
      return newWs;
    } catch (err) {
      toast.error(`导入失败：${(err as Error).message}`);
      return null;
    }
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0],
    [workspaces, activeWorkspaceId],
  );

  const activeWorkspacePersonality = useMemo(
    () => WORKSPACE_PERSONALITY_MAP[activeWorkspaceId] ?? WORKSPACE_PERSONALITY_MAP.ws1,
    [activeWorkspaceId],
  );

  return {
    // 状态
    activeWorkspaceId, setActiveWorkspaceId,
    workspaces, setWorkspaces,
    // 计算值
    activeWorkspace,
    activeWorkspacePersonality,
    // 过渡动画状态
    transitionVisible, transitionWs,
    // 操作
    handleSwitchWorkspace,
    switchWithTransition,
    handleAddWorkspace,
    handleDeleteWorkspace,
    handleUpdateWorkspace,
    handleReorderWorkspaces,
    handleMigrateWorkspace,
    handleExportWorkspace,
    handleImportWorkspace,
  };
}
