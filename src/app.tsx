import { Suspense, lazy, useEffect, useMemo, type ComponentType } from "react";
import { HashRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { PageSkeleton } from "@/components/SkeletonLoaders";
import { LayoutManager } from "@/components/layout/LayoutManager";
import FloatingStickies from "@/components/FloatingStickies";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

// 顶部仪表盘
const DashboardPage = lazy(() => import("@/pages/Dashboard/DashboardPage"));
// 笔记工作区
const NotesWorkspacePage = lazy(() => import("@/pages/NotesWorkspace/NotesWorkspacePage"));
const TagsPage = lazy(() => import("@/pages/Tags/TagsPage"));
const NotebooksPage = lazy(() => import("@/pages/Notebooks/NotebooksPage"));
const StickyWallPage = lazy(() => import("@/pages/StickyWall/StickyWallPage"));
// 规划执行
const CalendarPage = lazy(() => import("@/pages/Calendar/CalendarPage"));
const TodosPage = lazy(() => import("@/pages/Todos/TodosPage"));
const DailyReviewPage = lazy(() => import("@/pages/DailyReview/DailyReviewPage"));
const FourQuadrantPage = lazy(() => import("@/pages/FourQuadrant/FourQuadrantPage"));
const PomodoroPage = lazy(() => import("@/pages/Pomodoro/PomodoroPage"));
// 学习
const FlashcardsPage = lazy(() => import("@/pages/Flashcards/FlashcardsPage"));
// 工具箱
const ClipboardPage = lazy(() => import("@/pages/Clipboard/ClipboardPage"));
const TemplatesPage = lazy(() => import("@/pages/Templates/TemplatesPage"));
const SearchPage = lazy(() => import("@/pages/Search/SearchPage"));
// 本地文件系统搜索
const LocalSearchPage = lazy(() => import("@/pages/LocalSearch/LocalSearchPage"));
// 系统
const SettingsPage = lazy(() => import("@/pages/Settings/SettingsPage"));
const PrivacyPage = lazy(() => import("@/pages/Privacy/PrivacyPage"));
const GrammarPage = lazy(() => import("@/pages/Grammar/GrammarPage"));
const NotificationsPage = lazy(() => import("@/pages/Notifications/NotificationsPage"));
// 扩展/保留页（已接入路由，便于后续在导航中显露出入口）
const ImportExportPage = lazy(() => import("@/pages/ImportExport/ImportExportPage"));
const VaultPage = lazy(() => import("@/pages/Vault/VaultPage"));
const TrashPage = lazy(() => import("@/pages/Trash/TrashPage"));
const OcrPage = lazy(() => import("@/pages/Ocr/OcrPage"));
const RemindersPage = lazy(() => import("@/pages/Reminders/RemindersPage"));
// 网址导航
const WebsiteNaviPage = lazy(() => import("@/pages/WebsiteNavi/WebsiteNaviPage"));
// 闪念（独立页：剪贴板、闪念各自单独整页）
const FlashThoughtsPage = lazy(() => import("@/pages/FlashThoughts/FlashThoughtsPage"));
// AI 写作助手（战略：独立 AI 工作台，离线引擎即可用）
const AiView = lazy(() => import("@/views/AiView"));

// 侧边栏 / 头部导航引用的主要路由（path → 组件）
const MAIN_PAGES: Array<{ path: string; Comp: ComponentType }> = [
  { path: "/dashboard", Comp: DashboardPage },
  { path: "/notes", Comp: NotesWorkspacePage },
  { path: "/tags", Comp: TagsPage },
  { path: "/notebooks", Comp: NotebooksPage },
  { path: "/sticky-wall", Comp: StickyWallPage },
  { path: "/calendar", Comp: CalendarPage },
  { path: "/todos", Comp: TodosPage },
  { path: "/quadrant", Comp: FourQuadrantPage },
  { path: "/pomodoro", Comp: PomodoroPage },
  { path: "/daily-review", Comp: DailyReviewPage },
  { path: "/flashcards", Comp: FlashcardsPage },
  { path: "/clipboard", Comp: ClipboardPage },
  { path: "/flash", Comp: FlashThoughtsPage },
  { path: "/templates", Comp: TemplatesPage },
  { path: "/ai", Comp: AiView },
  { path: "/search", Comp: SearchPage },
  { path: "/local-search", Comp: LocalSearchPage },
  { path: "/settings", Comp: SettingsPage },
  { path: "/privacy", Comp: PrivacyPage },
  { path: "/grammar", Comp: GrammarPage },
  { path: "/notifications", Comp: NotificationsPage },
  // 扩展/保留页
  { path: "/import-export", Comp: ImportExportPage },
  { path: "/vault", Comp: VaultPage },
  { path: "/trash", Comp: TrashPage },
  { path: "/ocr", Comp: OcrPage },
  { path: "/reminders", Comp: RemindersPage },
  // 网址导航
  { path: "/websites", Comp: WebsiteNaviPage },
];

// 系统托盘事件桥接：托盘菜单「新建笔记 / 剪贴板 / 设置」→ 前端导航
function TrayBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    // 非 Tauri 环境不注册系统托盘事件（避免调用 event.listen 触发 IPC 报错）
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<string>("tray:open-page", (e) => {
        const route = String(e.payload ?? "");
        if (route.startsWith("/")) navigate(route);
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    }).catch(() => {
      // 静默降级：事件桥接不可用时忽略
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);
  return null;
}

// 全局弹出窗桥接：独立弹窗（快速打开）选中对象后，通知主窗口打开对应目标。
function PopupOpenBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<{ target?: string }>("popup:open-target", (e) => {
        const target = e.payload?.target ?? "";
        if (target.startsWith("note:")) {
          const id = target.slice("note:".length);
          navigate("/notes");
          // 通过全局 store 选中该笔记（LayoutManager 内部已订阅 activeNoteId）
          import("@/store/useStore").then(({ useStore }) => {
            useStore.getState().setActiveNoteId(id || null);
          });
        } else if (target.startsWith("todo:")) {
          navigate("/todos");
        } else if (target.startsWith("tag:")) {
          navigate("/tags");
        } else if (target.startsWith("captured:")) {
          navigate("/notes");
        }
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <TooltipProvider delayDuration={200}>
        <ConfirmDialogProvider>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* LayoutManager 作为布局路由，通过 <Outlet context> 提供工作区上下文 */}
              <Route element={<LayoutManager />}>
                <Route index element={<DashboardPage />} />
                {MAIN_PAGES.map(({ path, Comp }) => (
                  <Route key={path} path={path} element={<Comp />} />
                ))}
              </Route>
              <Route path="share/:code" element={<ShareLanding />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <TrayBridge />
          <PopupOpenBridge />
          <FloatingStickies />
          <Toaster />
        </ConfirmDialogProvider>
      </TooltipProvider>
    </HashRouter>
  );
}

// 分享落地页：`#/share/:code` 读取真实分享记录并展示
function ShareLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const record = useMemo(() => {
    try {
      const all = JSON.parse(localStorage.getItem("yixian_share_links") || "[]") as Array<{
        shortCode?: string;
        title?: string;
        url?: string;
        createdAt?: number;
        expiresAt?: number | null;
      }>;
      return all.find((r) => r.shortCode === code) || null;
    } catch {
      return null;
    }
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-accent/20 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-2xl">📌</span>
        </div>
        {record ? (
          <>
            <h1 className="text-xl font-bold mb-1">{record.title || "未命名分享"}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {record.expiresAt && record.expiresAt < Date.now()
                ? "此分享链接已过期"
                : "这是一个来自一闲笔记的分享内容"}
            </p>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              打开应用查看
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">分享不存在或已失效</h1>
            <p className="text-sm text-muted-foreground mb-6">该分享记录未找到。</p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </div>
  );
}