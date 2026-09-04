// LayoutManager — 主入口组件，组合所有 hooks 和 UI 结构
import { Outlet, useLocation } from "react-router-dom";
import { Suspense, lazy, useCallback, useMemo, useEffect, useState, useRef } from "react";
import { PageSkeleton } from "@/components/SkeletonLoaders";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Header from "@/components/Header";
import { useStickyNotes } from "@/hooks/useStickyNotes";
const FloatingStickyManager = lazy(() => import("@/components/FloatingStickyManager"));
import { readUnifiedStickies } from "@/lib/floating-sticky";
import { useNoteOperations } from "@/hooks/useNoteOperations";
import { useWorkspaceStorage } from "@/hooks/useWorkspaceStorage";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useAppFeatures } from "@/hooks/useAppFeatures";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { requestNotificationPermission } from "@/hooks/useReminders";
import { genId } from "@/lib/id";
import { readGlobalShortcuts, applyGlobalShortcuts } from "@/lib/globalShortcuts";

const WorkspaceQuickSwitcher = lazy(() => import("@/components/WorkspaceQuickSwitcher"));
const WorkspaceTransition = lazy(() => import("@/components/WorkspaceTransition"));
const QuickOpen = lazy(() => import("@/components/QuickOpen"));

import OnboardingWizard from "@/components/Onboarding/OnboardingWizard";
import type { INote } from "@/data/notes";
import { getStorageKey, getWorkspaceFeatures, NOTES_STORAGE_KEY, NOTEBOOKS_STORAGE_KEY, TAGS_STORAGE_KEY, TODOS_STORAGE_KEY, DAILY_RECORD_KEY } from "@/hooks/useWorkspaceStorage";
import type { ITodo, ITag, IDailyRecord, IReminder } from "@/data/notes";
import { loadJSON } from "@/hooks/useLocalStorage";

export function LayoutManager() {
  // === 组合所有 Hooks ===
  const workspace = useWorkspaceStorage();
  const {
    activeWorkspaceId, workspaces, activeWorkspace, activeWorkspacePersonality,
    transitionVisible, transitionWs,
    switchWithTransition, handleAddWorkspace, handleDeleteWorkspace,
    handleUpdateWorkspace, handleReorderWorkspaces, handleMigrateWorkspace,
    handleExportWorkspace, handleImportWorkspace, handleSwitchWorkspace,
  } = workspace;

  // 加载每日记录（工作区隔离）
  const [wsDailyRecord, setWsDailyRecord] = useState<IDailyRecord[]>(() =>
    loadJSON(getStorageKey(DAILY_RECORD_KEY, activeWorkspaceId), [] as IDailyRecord[]),
  );

  const noteOps = useNoteOperations(activeWorkspaceId);
  const onboarding = useOnboarding(workspaces);
  const theme = useThemeSettings(activeWorkspaceId);
  const features = useAppFeatures(activeWorkspaceId);

  // 路由切换时把共享的滚动容器（window）恢复到顶部，
  // 避免「统计仪表盘滚到底部 → 进入笔记页仍停在底部」的问题。
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // 提醒统一真源：store.reminders（后端持久化），作为全部提醒类 UI 的唯一数据源。
  const storeReminders = useStore((s) => s.reminders);
  // 映射为 context 弱化形状（IReminder），供 RemindersPage 之外的消费方读取
  const contextReminders = useMemo<IReminder[]>(
    () =>
      storeReminders.map((r) => ({
        id: r.id,
        targetId: r.noteId ?? r.id,
        targetType: (r.noteId ? "note" : "todo") as IReminder["targetType"],
        title: r.title,
        time: new Date(r.remindAt).getTime(),
        repeat: (r.repeat ?? "none") as IReminder["repeat"],
        isRead: r.isCompleted,
        createdAt: new Date(r.createdAt).getTime(),
      })),
    [storeReminders],
  );

  // 统一便签 store（便签墙 + 浮动便签共用；首次装载时迁移两套旧数据）
  const stickyStore = useStickyNotes(activeWorkspaceId);

  // 快速打开面板
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // 键盘快捷键：Ctrl+P 快速打开，Ctrl+Shift+W 工作区切换，Ctrl+N 新建笔记，Ctrl+S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "p") {
          e.preventDefault();
          setQuickOpenOpen(true);
        } else if (k === "n") {
          e.preventDefault();
          noteOps.handleNewNote();
        } else if (k === "s") {
          // 笔记为自动保存，Ctrl+S 视为保存意图并跳转到当前编辑器；无副作用
          e.preventDefault();
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        setSwitcherOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [noteOps]);

  // 应用持久化的全局快捷键（覆盖默认），使其在重启后保持用户配置
  useEffect(() => {
    const apply = async () => {
      if (!("__TAURI_INTERNALS__" in window)) return;
      try {
        await applyGlobalShortcuts(readGlobalShortcuts());
      } catch {
        /* 可忽略：非 Tauri 或后端暂不可用 */
      }
    };
    void apply();
  }, []);

  // D1：应用启动时从后端 SQLite 加载全部提醒，填充为提醒的唯一内存数据源
  useEffect(() => {
    void useStore.getState().fetchReminders();
  }, []);

  // 同步工作区主题包到 settings
  useEffect(() => {
    const targetWs = workspaces.find((w) => w.id === activeWorkspaceId);
    const wsThemePack = targetWs?.themePack;
    if (wsThemePack && wsThemePack !== theme.settings.themePack) {
      theme.setSettings((prev) => ({ ...prev, themePack: wsThemePack }));
    }
  }, [activeWorkspaceId, workspaces, theme.settings.themePack, theme.setSettings]);

  // 切换工作区时更新 noteOps 数据
  useEffect(() => {
    const wid = activeWorkspaceId;
    const newNotes = loadJSON(getStorageKey(NOTES_STORAGE_KEY, wid), [] as INote[]);
    noteOps.setNotes(newNotes);
    noteOps.setTags(loadJSON(getStorageKey(TAGS_STORAGE_KEY, wid), []));
    noteOps.setTodos(loadJSON(getStorageKey("yixian_todos", wid), []));
    noteOps.setTemplates(loadJSON(getStorageKey("yixian_templates", wid), []));
    noteOps.setClipboard(loadJSON(getStorageKey("yixian_clipboard", wid), []));
    noteOps.setStickyNotes(loadJSON(getStorageKey("yixian_sticky_notes", wid), []));
    noteOps.setNotebooks(loadJSON(getStorageKey(NOTEBOOKS_STORAGE_KEY, wid), []));
    noteOps.setActiveNoteId(newNotes.find((n) => !n.isDeleted)?.id ?? "n1");
    noteOps.setActiveFilter("all");

    // 更新每日记录
    setWsDailyRecord(loadJSON(getStorageKey(DAILY_RECORD_KEY, wid), [] as IDailyRecord[]));

    // 更新启用的功能
    const recommended = getWorkspaceFeatures(wid);
    onboarding.setEnabledFeatures(new Set(recommended));
  }, [activeWorkspaceId]);

  // 引导完成处理
  const handleOnboardingComplete = useCallback(
    (config: { workspaceId?: string; enabledFeatures: string[]; themePack: string; themeMode: "light" | "dark" | "system"; fontSize: "small" | "medium" | "large"; liteMode?: boolean }) => {
      if (config.workspaceId && config.workspaceId !== activeWorkspaceId) {
        handleSwitchWorkspace(config.workspaceId);
      }
      onboarding.setEnabledFeatures(new Set(config.enabledFeatures));
      const wantLite = config.liteMode === true;
      theme.setSettings((prev) => ({
        ...prev,
        themePack: config.themePack,
        theme: config.themeMode,
        fontSize: config.fontSize,
        liteMode: wantLite,
      }));
      localStorage.setItem("yixian_onboarded", "true");

      // 用户选择精简模式：立即创建一张浮动便签，进入后即可随手记录
      if (wantLite) {
        stickyStore.createSticky({ floating: true });
      }

      onboarding.setShowOnboarding(false);
    },
    [activeWorkspaceId, handleSwitchWorkspace, onboarding, theme, stickyStore],
  );

  // 创建工作区（引导内）
  const handleCreateWorkspaceFromOnboarding = useCallback(
    (data: { name: string; description: string; themeKey: string; template: string }) => {
      const newId = handleAddWorkspace(
        {
          name: data.name,
          description: data.description,
          icon: "📝",
          color: "#3F7F5F",
          themeKey: data.themeKey || "bamboo",
          archived: false,
        },
        data.template as any,
      );
      return newId.id;
    },
    [handleAddWorkspace],
  );

  // ═══ 精简模式：只显示系统托盘 + 浮动便签 ═══
  // 用 ref 记录最近一次同步到后端（或来自托盘）的 liteMode 值，
  // 避免「前端改状态 → 调后端 → 后端广播 → 前端再改」的循环回环。
  const liteSyncedRef = useRef<boolean | null | undefined>(null);

  // 前端侧（设置页/引导/快捷键）改动 liteMode → 通知后端隐藏/显示主窗口
  useEffect(() => {
    if (liteSyncedRef.current === theme.settings.liteMode) return;
    liteSyncedRef.current = theme.settings.liteMode;
    // 仅在 Tauri 环境调后端；浏览器预览无需隐藏
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("set_lite_mode_cmd", { enabled: theme.settings.liteMode }))
        .catch(() => {});
    }
  }, [theme.settings.liteMode]);

  // 托盘菜单「进入/退出精简模式」→ 后端广播事件，前端回写状态
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<boolean>("yx:lite-mode-changed", (e) => {
        const enabled = Boolean(e.payload);
        // 记录来自后端（托盘）的值，避免再回环
        liteSyncedRef.current = enabled;
        theme.setSettings((prev) => (prev.liteMode === enabled ? prev : { ...prev, liteMode: enabled }));
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [theme]);

  // 进入精简模式但没有浮动便签时，自动补一张，确保精简模式立即可用
  useEffect(() => {
    if (theme.settings.liteMode) {
      const hasFloating = stickyStore.stickyNotes.some((s) => !s.deleted && s.floating);
      if (!hasFloating) {
        stickyStore.createSticky({ floating: true });
      }
    }
  }, [theme.settings.liteMode, stickyStore]);

  // 快捷键 Ctrl+Shift+L：切换精简模式
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        theme.setSettings((prev) => ({ ...prev, liteMode: !prev.liteMode }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [theme]);

  // 计算工作区统计
  const workspaceStats = useMemo(() => {
    const getStats = (wid: string) => {
      if (wid === activeWorkspaceId) {
        return {
          noteCount: noteOps.notes.filter((n) => !n.isDeleted).length,
          stickyCount: stickyStore.stickyNotes.filter((s) => !s.deleted).length,
          todoCount: noteOps.todos.length,
          tagCount: noteOps.tags.length,
          todoCompleted: noteOps.todos.filter((t) => t.status === "completed").length,
        };
      }
      const wsNotes = loadJSON(getStorageKey(NOTES_STORAGE_KEY, wid), [] as INote[]);
      const wsSticky = readUnifiedStickies(wid).filter((s) => !s.deleted).length;
      const wsTodos = loadJSON(getStorageKey(TODOS_STORAGE_KEY, wid), [] as ITodo[]);
      const wsTags = loadJSON(getStorageKey(TAGS_STORAGE_KEY, wid), [] as ITag[]);
      return {
        noteCount: wsNotes.filter((n: INote) => !n.isDeleted).length,
        stickyCount: wsSticky,
        todoCount: wsTodos.length,
        tagCount: wsTags.length,
        todoCompleted: wsTodos.filter((t: ITodo) => t.status === "completed").length,
      };
    };
    const map = new Map<string, ReturnType<typeof getStats>>();
    workspaces.forEach((w) => map.set(w.id, getStats(w.id)));
    return map;
  }, [workspaces, activeWorkspaceId, noteOps.notes, stickyStore.stickyNotes, noteOps.todos, noteOps.tags]);

  // 统一提醒单一真实源（useStore）：搜索/采集“一键设提醒”写入主提醒列表（RemindersPage 读取）
  const handleAddStoreReminder = useCallback(
    (r: {
      targetType: "note" | "todo";
      targetId: string;
      title: string;
      time: number;
      repeat?: string;
    }) => {
      const reminder = {
        id: genId("rm", 7),
        title: r.title,
        description: "",
        remindAt: new Date(r.time).toISOString(),
        noteId: r.targetType === "note" ? r.targetId : undefined,
        repeat: r.repeat ?? "none",
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      useStore.getState().addReminder(reminder);
      requestNotificationPermission();
      // 计划域后端落库已由 reminderSlice.addReminder 负责（同步写入 SQLite reminders 表）
    },
    [],
  );

  // 构建 context value（Outlet 传递给子路由）
  const contextValue = useMemo(
    () => ({
      // 笔记相关
      notes: noteOps.notes,
      stickyNotes: stickyStore.stickyNotes,
      // 统一便签 store（便签墙 / 浮动便签共用，含全部 CRUD 与浮动开关）
      stickyStore,
      settings: theme.settings,
      tags: noteOps.tags,
      todos: noteOps.todos,
      templates: noteOps.templates,
      clipboard: noteOps.clipboard,
      privacy: theme.privacy,
      notebooks: noteOps.notebooks,
      flashThoughts: features.flashThoughts,
      dailyRecord: wsDailyRecord,
      activeNoteId: noteOps.activeNoteId,
      activeNote: noteOps.activeNote,
      activeFilter: noteOps.activeFilter,
      setActiveNoteId: noteOps.handleNoteSelect,
      setActiveFilter: noteOps.handleFilterChange,
      updateNote: noteOps.handleNoteUpdate,
      newNote: noteOps.handleNewNote,
      addNote: noteOps.handleNewNote,
      encryptNote: noteOps.handleNoteEncrypt,
      decryptNote: noteOps.handleNoteDecrypt,
      setNoteLocked: noteOps.handleSetNoteLocked,
      importNotes: noteOps.handleImportNotes,
      batchUpdate: noteOps.handleBatchUpdate,
      batchUpdateMeta: noteOps.handleBatchUpdateMeta,
      batchDelete: noteOps.handleBatchDelete,
      batchRestore: noteOps.handleBatchRestore,
      reorderNotes: noteOps.handleReorderNotes,
      emptyTrash: noteOps.handleEmptyTrash,
      addTag: noteOps.handleAddTag,
      updateTag: noteOps.handleUpdateTag,
      deleteTag: noteOps.handleDeleteTag,
      mergeTags: noteOps.handleMergeTags,
      stickyCreate: () => stickyStore.createSticky(),
      stickyUpdate: stickyStore.updateSticky,
      stickyDelete: (id: string) => stickyStore.deleteSticky(id),
      todoCreate: noteOps.handleTodoCreate,
      todoUpdate: noteOps.handleTodoUpdate,
      todoToggle: noteOps.handleTodoToggle,
      todoDelete: noteOps.handleTodoDelete,
      templateCreate: noteOps.handleTemplateCreate,
      templateUpdate: noteOps.handleTemplateUpdate,
      templateDelete: noteOps.handleTemplateDelete,
      clipboardPin: noteOps.handleClipboardPin,
      clipboardDelete: noteOps.handleClipboardDelete,
      clipboardClear: noteOps.handleClipboardClear,
      clipboardAdd: noteOps.handleClipboardAdd,
      clipboardIncrement: noteOps.handleClipboardIncrement,
      addFlashThought: features.handleAddFlashThought,
      updateFlashThought: features.handleUpdateFlashThought,
      deleteFlashThought: features.handleDeleteFlashThought,
      clearFlashThoughts: features.handleClearFlashThoughts,
      notifications: features.notifications,
      reminders: contextReminders,
      markNotificationRead: features.handleMarkNotificationRead,
      clearNotifications: features.handleClearNotifications,
      markAllNotificationsRead: features.handleMarkAllNotificationsRead,
      deleteNotification: features.handleDeleteNotification,
      notificationSettings: theme.notificationSettings,
      setNotificationSettings: theme.setNotificationSettings,
      addReminder: handleAddStoreReminder,
      setSettings: theme.setSettings,
      setPrivacy: theme.setPrivacy,
      // 精简模式开关（仅切换状态，实际显隐由 useThemeSettings + 精简模式 effect 驱动）
      setLiteMode: (v: boolean) => theme.setSettings((prev) => ({ ...prev, liteMode: v })),
      noteCounts: noteOps.noteCounts,
      // 学习卡片
      flashcards: features.flashcards,
      addFlashcard: features.handleAddFlashcard,
      updateFlashcard: features.handleUpdateFlashcard,
      reviewFlashcard: features.handleReviewFlashcard,
      deleteFlashcard: features.handleDeleteFlashcard,
      // 工作区
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      activeWorkspacePersonality,
      switchWorkspace: handleSwitchWorkspace,
      addWorkspace: handleAddWorkspace,
      updateWorkspace: handleUpdateWorkspace,
      deleteWorkspace: handleDeleteWorkspace,
      reorderWorkspaces: handleReorderWorkspaces,
      migrateWorkspace: handleMigrateWorkspace,
      exportWorkspace: handleExportWorkspace,
      importWorkspace: handleImportWorkspace,
      workspaceStats,
      workspaceThemes: [],
      workspaceTemplates: [],
      switchWithTransition,
      openOnboarding: () => onboarding.setShowOnboarding(true),
      enabledFeatures: onboarding.enabledFeatures,
      setEnabledFeatures: onboarding.setEnabledFeatures,
    }),
    [
      noteOps.notes, stickyStore, theme.settings, noteOps.tags, noteOps.todos,
      noteOps.templates, noteOps.clipboard, theme.privacy,
      noteOps.notebooks,
      features.flashThoughts,
      wsDailyRecord, noteOps.activeNoteId, noteOps.activeNote, noteOps.activeFilter,
      noteOps.handleNoteSelect, noteOps.handleFilterChange, noteOps.handleNoteUpdate,
      noteOps.handleNewNote, noteOps.handleBatchUpdate, noteOps.handleBatchDelete,
      noteOps.handleNoteEncrypt, noteOps.handleNoteDecrypt, noteOps.handleSetNoteLocked,
      noteOps.handleBatchRestore, noteOps.handleReorderNotes, noteOps.handleEmptyTrash, noteOps.handleAddTag,
      noteOps.handleUpdateTag, noteOps.handleDeleteTag, noteOps.handleMergeTags,
      noteOps.handleTodoCreate, noteOps.handleTodoUpdate, noteOps.handleTodoToggle,
      noteOps.handleTodoDelete, noteOps.handleTemplateCreate, noteOps.handleTemplateUpdate,
      noteOps.handleTemplateDelete, noteOps.handleClipboardPin, noteOps.handleClipboardDelete,
      noteOps.handleClipboardClear, noteOps.handleClipboardAdd, noteOps.handleClipboardIncrement,
      features.handleAddFlashThought, features.handleUpdateFlashThought,
      features.handleDeleteFlashThought, features.handleClearFlashThoughts,
      features.notifications, contextReminders, features.handleMarkNotificationRead,
      features.handleClearNotifications, features.handleMarkAllNotificationsRead,
      theme.notificationSettings, theme.setNotificationSettings,
      handleAddStoreReminder,
      theme.setSettings, theme.setPrivacy, noteOps.noteCounts,
      features.flashcards, features.handleAddFlashcard,
      features.handleUpdateFlashcard, features.handleReviewFlashcard, features.handleDeleteFlashcard,
      workspaces, activeWorkspaceId, activeWorkspace, activeWorkspacePersonality,
      handleSwitchWorkspace, handleAddWorkspace, handleUpdateWorkspace, handleDeleteWorkspace,
      handleReorderWorkspaces, handleMigrateWorkspace, handleExportWorkspace, handleImportWorkspace,
      workspaceStats, switchWithTransition, onboarding.enabledFeatures, onboarding.setEnabledFeatures,
      onboarding.setShowOnboarding,
    ],
  );

  return (
    <>
      <AnimatePresence mode="wait">
        {onboarding.showOnboarding ? (
          <motion.div
            key="onboarding-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="contents"
          >
            <OnboardingWizard
              open
              onOpenChange={(open) => {
                if (!open) {
                  localStorage.setItem("yixian_onboarded", "true");
                  onboarding.setShowOnboarding(false);
                }
              }}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              currentTheme={theme.settings.themePack || "bamboo"}
              currentMode={theme.settings.theme as "light" | "dark" | "system"}
              currentFontSize={theme.settings.fontSize}
              onComplete={handleOnboardingComplete}
              onCreateWorkspace={handleCreateWorkspaceFromOnboarding}
              fullScreen
            />
          </motion.div>
        ) : (
          <motion.div
            key="main-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="contents"
          >
            <SidebarProvider>
              <AppSidebar
                activeFilter={noteOps.activeFilter}
                onFilterChange={noteOps.handleFilterChange}
                noteCounts={noteOps.noteCounts}
                onNewNote={noteOps.handleNewNote}
                stickyCount={stickyStore.stickyNotes.filter((s) => !s.deleted).length}
                todoCount={noteOps.todoCount}
                favoriteCount={noteOps.favoriteCount}
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                workspaceSlogan={activeWorkspacePersonality?.slogan}
                onSwitchWorkspace={switchWithTransition}
                floatingStickyCount={stickyStore.stickyNotes.filter((s) => s.floating && !s.deleted).length}
                onCreateFloating={() => stickyStore.createSticky({ floating: true })}
                enabledFeatures={onboarding.enabledFeatures}
              />
              <SidebarInset className="flex flex-col min-w-0 flex-1 overflow-x-hidden bg-background">
                <Header
                  notifications={features.notifications}
                  onMarkAllRead={features.handleMarkAllNotificationsRead}
                  onMarkRead={features.handleMarkNotificationRead}
                  settings={theme.settings}
                  setSettings={theme.setSettings}
                />
                <main className="flex-1 w-full overflow-hidden px-6 py-4">
                  <Suspense fallback={<PageSkeleton />}>
                    <Outlet context={contextValue} />
                  </Suspense>
                </main>
              </SidebarInset>

              <Suspense fallback={null}>
                <WorkspaceQuickSwitcher
                  open={switcherOpen}
                  onClose={() => setSwitcherOpen(false)}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  workspaceStats={workspaceStats}
                  onSwitch={switchWithTransition}
                />
                <WorkspaceTransition
                  visible={transitionVisible}
                  workspaceName={transitionWs.name}
                  workspaceColor={transitionWs.color}
                  workspaceIcon={transitionWs.icon}
                  workspaceSlogan={transitionWs.slogan}
                  fromColor={activeWorkspace?.color}
                />
                <QuickOpen
                  open={quickOpenOpen}
                  onOpenChange={setQuickOpenOpen}
                  notes={noteOps.notes.filter((n) => !n.isDeleted)}
                  notebooks={noteOps.notebooks}
                  tags={noteOps.tags}
                  workspace={activeWorkspace}
                  recentNoteIds={[]}
                  onSelectNote={(id) => {
                    noteOps.setActiveNoteId(id);
                    noteOps.setActiveFilter("all");
                    setQuickOpenOpen(false);
                  }}
                  onNoteVisited={() => {}}
                />
                {/* 统一便签浮动窗口协调器：为 unified store 中 floating=true 的便签创建/关闭 Tauri 独立窗口 */}
                <FloatingStickyManager
                  stickies={stickyStore.stickyNotes}
                  workspaceId={activeWorkspaceId}
                />
              </Suspense>
            </SidebarProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
