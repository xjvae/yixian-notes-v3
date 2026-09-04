// ══════════════════════════════════════════════════════════════
// 便签墙 — 基于统一 StickyNote store（与浮动便签共用一份数据）
//   - 使用 LayoutManager context 的 stickyStore（useStickyNotes）
//   - 网格展示全部便签（排除 deleted），可编辑标题/正文/待办勾选、
//     改主题/纸张、置顶、折叠、私密、删除、复制、切换 todo/text、
//     浮动到桌面（FloatingStickyManager 建独立窗口）与收回
//   - 支持新建、搜索、筛选（状态/类型/主题）、排序、统计面板、
//     批量主题、全部浮起/全部收回
// ══════════════════════════════════════════════════════════════
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useOutletContext } from "react-router-dom";
import {
  StickyNote,
  Plus,
  Pin,
  Lock,
  LockOpen,
  ExternalLink,
  Search,
  Copy,
  AlignLeft,
  ListTodo,
  Eye,
  EyeOff,
  MoreHorizontal,
  CheckCheck,
  BarChart3,
  Filter,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  X,
  KeyRound,
  RotateCw,
  Grid3x3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StickyNote as StickyType } from "@/shared/types";
import { STICKY_THEMES, STICKY_PAPERS, getPaperStyle, themeColor, themeTape } from "@/lib/floating-sticky";
import { decryptSecContent } from "@/lib/sticky-sec";
import type { StickySecContent } from "@/lib/sticky-sec";
import type { useStickyNotes } from "@/hooks/useStickyNotes";

/** 便签墙需要的 Layout context 字段（其余字段由其他页面消费，此处不声明） */
interface WallContext {
  stickyStore: ReturnType<typeof useStickyNotes>;
}

const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 150;

/** 计算完成进度 */
function getProgress(st: StickyType): { done: number; total: number } {
  const total = st.items.length;
  const done = st.items.filter((i) => i.startsWith("[x] ")).length;
  return { done, total };
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 文本图标（小 svg，展开/切换类型等场景直接使用） */
function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StickyWallPage() {
  const { stickyStore } = useOutletContext<WallContext>();

  const {
    stickyNotes,
    createSticky,
    duplicateSticky,
    updateSticky,
    deleteSticky,
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
    updateEncryptedContent,
  } = stickyStore;
  const activeStickies = useMemo(() => stickyNotes.filter((s) => !s.deleted), [stickyNotes]);
  const floatingCount = activeStickies.filter((s) => s.floating).length;
  const pinnedCount = activeStickies.filter((s) => s.pinned).length;

  // ── 卡片局部面板 ──
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [paperFor, setPaperFor] = useState<string | null>(null);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  // ── 顶栏 ──
  const [searchQuery, setSearchQuery] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [batchPaletteOpen, setBatchPaletteOpen] = useState(false);
  // ── 筛选/排序 ──
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "todo" | "text">("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  // ── 便签墙布局：grid=网格分类 / free=自由钉放（可拖动任意位置与角度） ──
  const [freeMode, setFreeMode] = useState(false);
  const dragRef = useRef<{
    id: string;
    sx: number;
    sy: number;
    x: number;
    y: number;
    el: HTMLElement;
  } | null>(null);
  const rotRef = useRef<{
    id: string;
    sx: number;
    sy: number;
    cx: number;
    cy: number;
    base: number;
    el: HTMLElement;
  } | null>(null);
  // ── 独立加密弹层 ──
  const [secTarget, setSecTarget] = useState<{ id: string; mode: "encrypt" | "decrypt" } | null>(null);
  const [secPw, setSecPw] = useState("");
  const [secErr, setSecErr] = useState<string | null>(null);
  // 内存中已解密的便签明文（仅会话内显示，不写回存储；持有口令以便修改后同口令重加密）
  const [revealed, setRevealed] = useState<Record<string, { content: StickySecContent; pw: string }>>({});

  const submitSec = async () => {
    if (!secTarget) return;
    setSecErr(null);
    if (secTarget.mode === "encrypt") {
      const ok = await encryptNote(secTarget.id, secPw);
      if (ok) {
        setSecTarget(null);
        setSecPw("");
      } else setSecErr("加密失败，请重试");
    } else {
      // “查看”：解密到内存，不写回存储（保持加密态）
      const st = stickyNotes.find((s) => s.id === secTarget.id);
      if (!st || !st.enc_data) {
        setSecErr("数据不存在");
        return;
      }
      const sec = await decryptSecContent(secPw, st.enc_data as string);
      if (!sec) {
        setSecErr("口令错误或数据损坏");
        return;
      }
      setRevealed((p) => ({ ...p, [secTarget.id]: { content: sec, pw: secPw } }));
      setSecTarget(null);
      setSecPw("");
    }
  };

  // 编辑已解密的加密便签：本地即时更新 + 延时以同一个口令重加密写回（存储始终为密文）
  const revTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const updateRevealedContent = (id: string, next: StickySecContent) => {
    setRevealed((p) => (p[id] ? { ...p, [id]: { ...p[id], content: next } } : p));
    if (revTimer.current[id]) clearTimeout(revTimer.current[id]);
    revTimer.current[id] = setTimeout(() => {
      const r = revealed[id];
      if (r) updateEncryptedContent(id, r.pw, next);
    }, 600);
  };

  // 统计数据
  const stats = useMemo(() => {
    const total = activeStickies.length;
    const todoItems = activeStickies.filter((s) => (s.content_type ?? "todo") === "todo");
    const allItems = todoItems.flatMap((s) => s.items);
    const doneItems = allItems.filter((i) => i.startsWith("[x] "));
    const textCount = activeStickies.filter((s) => s.content_type === "text").length;
    const privateCount = activeStickies.filter((s) => s.private).length;
    const completionRate =
      allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0;
    return {
      total,
      todoCount: todoItems.length,
      textCount,
      pinned: pinnedCount,
      floating: floatingCount,
      private: privateCount,
      totalItems: allItems.length,
      doneItems: doneItems.length,
      completionRate,
    };
  }, [activeStickies, pinnedCount, floatingCount]);

  // 搜索 + 筛选 + 排序
  const visibleStickies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeStickies
      .filter((s) => {
        if (q) {
          const inTitle = s.title.toLowerCase().includes(q);
          const inItems = s.items.some((i) =>
            (i.replace(/^\[[x ]\] /, "") as string).toLowerCase().includes(q),
          );
          const inBody = (s.body ?? "").toLowerCase().includes(q);
          if (!inTitle && !inItems && !inBody) return false;
        }
        if (typeFilter !== "all" && (s.content_type ?? "todo") !== typeFilter) return false;
        if (themeFilter !== "all" && s.theme !== themeFilter) return false;
        if (statusFilter !== "all" && (s.content_type ?? "todo") === "todo") {
          const total = s.items.length;
          const done = s.items.filter((i) => i.startsWith("[x] ")).length;
          if (statusFilter === "pending" && total > 0 && done === total) return false;
          if (statusFilter === "completed" && (total === 0 || done < total)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (sortBy === "title") return (a.title || "").localeCompare(b.title || "", "zh");
        return b.updated_at - a.updated_at;
      });
  }, [activeStickies, searchQuery, statusFilter, typeFilter, themeFilter, sortBy]);

  const handleCreate = (contentType: "todo" | "text") => {
    createSticky({ content_type: contentType });
    setCreateMenuOpen(false);
  };

  const handleClearCompleted = () => {
    let cleared = 0;
    activeStickies.forEach((s) => {
      if ((s.content_type ?? "todo") !== "todo") return;
      const remaining = s.items.filter((i) => !i.startsWith("[x] "));
      if (remaining.length !== s.items.length) {
        cleared += s.items.length - remaining.length;
        updateSticky(s.id, { items: remaining.length === 0 ? [""] : remaining });
      }
    });
    if (cleared === 0) window.alert("没有已完成的条目");
  };

  const hasFilters =
    statusFilter !== "all" || typeFilter !== "all" || themeFilter !== "all" || sortBy !== "date";

  // ── 自由钉放：未放置便签的自动排布占位点 ──
  const freeFallback = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    // 依据当前筛选/排序后的顺序生成交错排布，避免重叠
    visibleStickies.forEach((s, i) => {
      map[s.id] = {
        x: 32 + (i % 5) * 250,
        y: 56 + Math.floor(i / 5) * 190 + (i % 3) * 18,
      };
    });
    return map;
  }, [visibleStickies]);

  // 自由钉放：画布尺寸随已放置便签自动扩展，避免被裁剪/找不到
  const freeExtent = useMemo(() => {
    let w = 1200;
    let h = 880;
    visibleStickies.forEach((s) => {
      const x = s.wallX ?? freeFallback[s.id]?.x ?? 0;
      const y = s.wallY ?? freeFallback[s.id]?.y ?? 0;
      w = Math.max(w, x + 280);
      h = Math.max(h, y + 240);
    });
    return { w, h };
  }, [visibleStickies, freeFallback]);

  // ── 自由钉放：移动（在便签卡片空白处按住拖动）──
  const handleFreeMoveStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-nondrag]")) return;
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    // 拖动中视觉强调（不触发重渲染，避免拖拽卡顿）
    el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
    dragRef.current = {
      id: el.dataset.id ?? "",
      sx: e.clientX,
      sy: e.clientY,
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
      el,
    };
  };
  const handleFreeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.max(0, Math.round(d.x + (e.clientX - d.sx)));
    const ny = Math.max(0, Math.round(d.y + (e.clientY - d.sy)));
    d.el.style.left = `${nx}px`;
    d.el.style.top = `${ny}px`;
  };

  // ── 自由钉放：任意角度旋转（右上角旋转手柄，围绕卡片中心）──
  const parseRot = (s: string | undefined): number => {
    const n = parseFloat(s ?? "");
    return Number.isFinite(n) ? n : 0;
  };
  const handleRotateStart = (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget.closest(".free-card-rot") as HTMLElement | null;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
    const r = el.getBoundingClientRect();
    rotRef.current = {
      id: el.dataset.id ?? "",
      sx: e.clientX,
      sy: e.clientY,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      base: parseRot(el.dataset.rot),
      el,
    };
  };
  const handleCardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (rotRef.current) {
      const r = rotRef.current;
      const now = (Math.atan2(e.clientY - r.cy, e.clientX - r.cx) * 180) / Math.PI;
      const start = (Math.atan2(r.sy - r.cy, r.sx - r.cx) * 180) / Math.PI;
      r.el.style.transform = `rotate(${normalizeDeg(r.base + (now - start))}deg)`;
      return;
    }
    handleFreeMove(e);
  };
  const handleCardUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (rotRef.current) {
      const r = rotRef.current;
      const now = (Math.atan2(e.clientY - r.cy, e.clientX - r.cx) * 180) / Math.PI;
      const start = (Math.atan2(r.sy - r.cy, r.sx - r.cx) * 180) / Math.PI;
      updateSticky(r.id, { wallRotation: Math.round(normalizeDeg(r.base + (now - start))) });
      r.el.style.boxShadow = "";
      rotRef.current = null;
      return;
    }
    if (dragRef.current) {
      const d = dragRef.current;
      updateSticky(d.id, {
        wallX: Math.max(0, Math.round(d.x + (e.clientX - d.sx))),
        wallY: Math.max(0, Math.round(d.y + (e.clientY - d.sy))),
      });
      d.el.style.boxShadow = "";
      dragRef.current = null;
    }
  };
  const normalizeDeg = (d: number) => ((d % 360) + 360) % 360;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header
        className="flex shrink-0 items-center justify-between px-8"
        style={{ height: 56, borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            便签墙
          </h1>
          <span className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            · 共 {activeStickies.length} 张
            {floatingCount > 0 && `（${floatingCount} 张浮动中）`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 统计面板 */}
          <button
            title="统计面板"
            onClick={() => setShowStats((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            style={{
              color: showStats ? "var(--primary)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          {/* 布局切换：网格 / 自由钉放 */}
          <button
            title={freeMode ? "自由钉放模式（拖动摆放、任意角度）" : "网格模式"}
            onClick={() => setFreeMode((v) => !v)}
            className="flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-muted"
            style={{
              color: freeMode ? "var(--primary)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {freeMode ? <RotateCw className="h-3.5 w-3.5" /> : <Grid3x3 className="h-3.5 w-3.5" />}
            {freeMode ? "自由钉放" : "网格"}
          </button>
          {/* 批量操作 */}
          {activeStickies.length > 0 && (
            <>
              <button
                title="筛选与排序"
                onClick={() => setShowFilters((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                style={{
                  color: showFilters || hasFilters ? "var(--primary)" : "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                <Filter className="h-4 w-4" />
              </button>
              {/* 批量主题色 */}
              <div className="relative">
                <button
                  title="批量主题色"
                  onClick={() => setBatchPaletteOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                  style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                >
                  <PaletteIcon />
                </button>
                {batchPaletteOpen && (
                  <div
                    className="absolute right-0 top-10 z-20 flex gap-1 rounded-md p-1.5 shadow-lg"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    {STICKY_THEMES.map((t) => (
                      <button
                        key={t.id}
                        title={t.label}
                        onClick={() => {
                          setAllThemes(t.id);
                          setBatchPaletteOpen(false);
                        }}
                        className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                        style={{ background: t.color }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* 清除已完成 */}
              <button
                title="清除所有已完成待办"
                onClick={handleClearCompleted}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <button
                title="全部浮起"
                onClick={() => setAllFloating(true)}
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-muted"
                style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                <Eye className="h-3.5 w-3.5" /> 全部浮起
              </button>
              {floatingCount > 0 && (
                <button
                  title="全部收回"
                  onClick={() => setAllFloating(false)}
                  className="flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-muted"
                  style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                >
                  <EyeOff className="h-3.5 w-3.5" /> 全部收回
                </button>
              )}
            </>
          )}
          {/* 搜索 */}
          <div
            className="flex items-center gap-1.5 rounded-md px-2.5"
            style={{
              height: 32,
              width: 180,
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索便签…"
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: "var(--foreground)" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* 新建便签 */}
          <div className="relative">
            <Button size="sm" onClick={() => setCreateMenuOpen((v) => !v)}>
              <Plus className="h-4 w-4" /> 新建便签
            </Button>
            {createMenuOpen && (
              <div
                className="absolute right-0 top-10 z-20 flex w-44 flex-col gap-0.5 rounded-md p-1.5 shadow-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => handleCreate("todo")}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                  style={{ color: "var(--foreground)" }}
                >
                  <ListTodo className="h-3.5 w-3.5" /> 待办清单
                </button>
                <button
                  onClick={() => handleCreate("text")}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                  style={{ color: "var(--foreground)" }}
                >
                  <TextIcon /> 纯文本
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 统计面板 */}
      {showStats && activeStickies.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-6 px-8 py-3"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <span className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              总数 <b style={{ color: "var(--foreground)" }}>{stats.total}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              待办 <b style={{ color: "var(--foreground)" }}>{stats.todoCount}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlignLeft className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              文本 <b style={{ color: "var(--foreground)" }}>{stats.textCount}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              置顶 <b style={{ color: "var(--foreground)" }}>{stats.pinned}</b>
            </span>
          </div>
          {stats.totalItems > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                完成率{" "}
                <b
                  style={{
                    color: stats.completionRate === 100 ? "#16A34A" : "var(--foreground)",
                  }}
                >
                  {stats.completionRate}%
                </b>
                <span className="ml-1">
                  ({stats.doneItems}/{stats.totalItems})
                </span>
              </span>
              <div
                className="h-1.5 w-20 overflow-hidden rounded-full"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${stats.completionRate}%`,
                    background: stats.completionRate === 100 ? "#16A34A" : "var(--primary)",
                  }}
                />
              </div>
            </div>
          )}
          {floatingCount > 0 && (
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                浮动 <b style={{ color: "var(--foreground)" }}>{stats.floating}</b>
              </span>
            </div>
          )}
          {stats.private > 0 && (
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                私密 <b style={{ color: "var(--foreground)" }}>{stats.private}</b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 筛选与排序工具栏 */}
      {showFilters && activeStickies.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-4 px-8 py-2"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              状态
            </span>
            {(["all", "pending", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="rounded px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  background: statusFilter === f ? "var(--primary)" : "transparent",
                  color: statusFilter === f ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {f === "all" ? "全部" : f === "pending" ? "未完成" : "已完成"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              类型
            </span>
            {(["all", "todo", "text"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className="rounded px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  background: typeFilter === f ? "var(--primary)" : "transparent",
                  color: typeFilter === f ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {f === "all" ? "全部" : f === "todo" ? "待办" : "文本"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              主题
            </span>
            {["all", ...STICKY_THEMES.map((t) => t.id)].map((f) => (
              <button
                key={f}
                onClick={() => setThemeFilter(f)}
                className="rounded px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  background: themeFilter === f ? "var(--primary)" : "transparent",
                  color: themeFilter === f ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {f === "all" ? "全部" : f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <ArrowDownUp className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              排序
            </span>
            {(["date", "title"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="rounded px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  background: sortBy === s ? "var(--primary)" : "transparent",
                  color: sortBy === s ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {s === "date" ? "时间" : "标题"}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
                setThemeFilter("all");
                setSortBy("date");
              }}
              className="ml-auto text-[10px] underline"
              style={{ color: "var(--muted-foreground)" }}
            >
              重置筛选
            </button>
          )}
        </div>
      )}

      {/* 便签网格 / 自由钉放 */}
      <div
        className={
          freeMode
            ? "min-h-0 flex-1 overflow-auto"
            : "min-h-0 flex-1 overflow-y-auto p-6"
        }
      >
        {activeStickies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-xl bg-muted">
              <StickyNote className="size-8 text-muted-foreground/50" />
            </div>
            <h3 className="mb-1 text-base font-medium">还没有便签</h3>
            <p className="mb-4 text-sm text-muted-foreground">点击右上角新建便签快速记录灵感</p>
            <Button size="sm" onClick={() => handleCreate("todo")}>
              <Plus className="size-4 mr-1" /> 新建便签
            </Button>
          </div>
        ) : visibleStickies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-16 items-center justify-center rounded-xl bg-muted">
              <Search className="size-8 text-muted-foreground/50" />
            </div>
            <h3 className="mb-1 text-base font-medium">未找到匹配的便签</h3>
            <p className="text-sm text-muted-foreground">试试调整筛选或搜索条件</p>
          </div>
        ) : freeMode ? (
          /* ── 自由钉放模式：便签可自由摆放、任意角度旋转 ── */
          <div className="relative overflow-hidden" style={{ width: freeExtent.w, height: freeExtent.h }}>
            {/* 软木板纹理背景 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 20%, rgba(139,90,43,0.06), transparent 45%), radial-gradient(circle at 75% 85%, rgba(139,90,43,0.05), transparent 45%), radial-gradient(rgba(60,40,15,0.06) 1px, transparent 1.5px)",
                backgroundSize: "100% 100%, 100% 100%, 22px 22px",
              }}
            />
            {visibleStickies.map((st) => {
              const { done, total } = getProgress(st);
              const allDone = total > 0 && done === total;
              const isText = (st.content_type ?? "todo") === "text";
              const tc = themeColor(st.theme);
              const rot = normalizeDeg(st.wallRotation ?? 0);
              const fb = freeFallback[st.id];
              const masked = !!st.private;
              return (
                <div
                  key={st.id}
                  data-id={st.id}
                  data-rot={rot}
                  className="free-card-rot group absolute z-10 flex cursor-grab flex-col active:cursor-grabbing"
                  style={{
                    left: st.wallX ?? fb.x,
                    top: st.wallY ?? fb.y,
                    width: 192,
                    height: st.collapsed ? "auto" : 164,
                    background: tc,
                    borderRadius: 10,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
                    outline: "1px solid rgba(0,0,0,0.08)",
                    boxSizing: "border-box",
                    transform: `rotate(${rot}deg)`,
                    willChange: "transform",
                    touchAction: "none",
                    userSelect: "none",
                  }}
                  onPointerDown={handleFreeMoveStart}
                  onPointerMove={handleCardMove}
                  onPointerUp={handleCardUp}
                  onPointerCancel={handleCardUp}
                >
                  {/* 纸张纹理（底层） */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ ...getPaperStyle(st.paper, tc), opacity: 0.45 }}
                  />
                  {/* 顶部胶带 */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-2 left-1/2 z-10 h-6 w-14 -translate-x-1/2 rounded-sm"
                    style={{ background: themeTape(st.theme), boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
                  />
                  {/* 图钉（左上角装饰） */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -left-1 -top-1 z-20"
                    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.28))" }}
                  >
                    <Pin className="h-4 w-4 rotate-45 text-red-500" />
                  </div>
                  {/* 删除（悬停显示） */}
                  <button
                    data-nondrag
                    title="删除便签"
                    onClick={() => {
                      if (window.confirm("确定删除这张便签？")) deleteSticky(st.id);
                    }}
                    className="absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
                    style={{ color: "rgba(0,0,0,0.5)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {/* 右下角旋转手柄（任意角度） */}
                  <div
                    data-nondrag
                    title="旋转（任意角度）"
                    onPointerDown={handleRotateStart}
                    className="absolute -bottom-2 -right-2 z-30 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full transition-transform hover:scale-110"
                    style={{ background: "#fff", color: "rgba(0,0,0,0.55)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
                  >
                    <RotateCw className="h-3 w-3" />
                  </div>
                  {/* 标题 */}
                  <input
                    data-nondrag
                    value={st.title}
                    disabled={!!st.locked}
                    onChange={(e) => updateSticky(st.id, { title: e.target.value })}
                    placeholder={isText ? "文本便签" : "便签标题"}
                    className="z-10 mx-2.5 mt-2 mb-0.5 bg-transparent text-xs font-semibold outline-none disabled:cursor-not-allowed"
                    style={{ color: "rgba(0,0,0,0.8)" }}
                  />
                  {/* 内容 */}
                  <div
                    className="z-10 mx-2.5 flex min-h-0 flex-1 flex-col overflow-hidden"
                    style={masked ? { filter: "blur(4px)" } : undefined}
                  >
                    {isText ? (
                      <div
                        className="text-[11px] leading-snug"
                        style={{
                          color: "rgba(0,0,0,0.7)",
                          whiteSpace: "pre-wrap",
                          overflow: "hidden",
                          maxHeight: "4.6em",
                        }}
                      >
                        {(st.body ?? "").trim() || "（空）"}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 overflow-hidden">
                        {st.items.slice(0, 5).map((item, idx) => {
                          const ok = item.startsWith("[x] ");
                          const text = item.replace(/^\[x\] /, "").replace(/^\[ \] /, "");
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input
                                data-nondrag
                                type="checkbox"
                                checked={ok}
                                disabled={!!st.locked}
                                onChange={(e) => setItemDone(st.id, idx, e.target.checked)}
                                className="h-3 w-3 shrink-0"
                              />
                              <span
                                className="min-w-0 flex-1 truncate text-[11px]"
                                style={{
                                  color: ok ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.78)",
                                  textDecoration: ok ? "line-through" : "none",
                                }}
                              >
                                {text || "…"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* 底部：进度 + 时间 */}
                  <div
                    className="z-10 flex shrink-0 items-center justify-between px-2.5 py-1.5 text-[10px]"
                    style={{ color: "rgba(0,0,0,0.45)" }}
                  >
                    <span>
                      {isText ? "文本" : total > 0 ? (allDone ? "✓ 已完成" : `${done}/${total}`) : "无待办"}
                    </span>
                    <span>
                      {st.private && "🔒 "}
                      {fmtTime(st.updated_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* 底部操作提示 */}
            <div className="pointer-events-none absolute inset-x-3 bottom-2 text-[10px]" style={{ color: "rgba(0,0,0,0.4)" }}>
              按住便签空白处可拖动摆放 · 右下角手柄可旋转任意角度 · 悬停卡片右上角可删除
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleStickies.map((st) => {
              const { done, total } = getProgress(st);
              const allDone = total > 0 && done === total;
              const isText = (st.content_type ?? "todo") === "text";
              const tc = themeColor(st.theme);
              return (
                <div
                  key={st.id}
                  className="group relative flex flex-col rounded-lg shadow-sm transition-shadow hover:shadow-md"
                  style={{
                    width: "100%",
                    background: tc,
                    height: st.collapsed ? undefined : (st.height ?? DEFAULT_HEIGHT),
                    minHeight: MIN_HEIGHT,
                    resize: st.collapsed ? "none" : "vertical",
                    overflow: "hidden",
                    outline: "1px solid rgba(0,0,0,0.08)",
                    outlineOffset: -2,
                  }}
                >
                  {/* 顶部胶带 */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-2 left-1/2 z-20 h-3 w-16 -translate-x-1/2 rounded-sm"
                    style={{ background: themeTape(st.theme), boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
                  />
                  {/* 纸张纹理（底层） */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ ...getPaperStyle(st.paper, tc), opacity: 0.5 }}
                  />

                  {/* 顶栏操作 */}
                  <div className="relative z-30 flex shrink-0 items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <button
                        title={st.pinned ? "取消置顶" : "置顶"}
                        onClick={() => updateSticky(st.id, { pinned: !st.pinned })}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: st.pinned ? "#B45309" : "rgba(0,0,0,0.5)" }}
                      >
                        <Pin className={`h-3.5 w-3.5 ${st.pinned ? "fill-current" : ""}`} />
                      </button>
                      <button
                        title="主题色"
                        onClick={() => {
                          setPaletteFor(paletteFor === st.id ? null : st.id);
                          setPaperFor(null);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: "rgba(0,0,0,0.5)" }}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20"
                          style={{ background: tc }}
                        />
                      </button>
                      <button
                        title="纸张模板"
                        onClick={() => {
                          setPaperFor(paperFor === st.id ? null : st.id);
                          setPaletteFor(null);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: "rgba(0,0,0,0.5)" }}
                      >
                        <TextIcon />
                      </button>
                      <button
                        title={st.collapsed ? "展开" : "折叠"}
                        onClick={() => updateSticky(st.id, { collapsed: !st.collapsed })}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: "rgba(0,0,0,0.5)" }}
                      >
                        {st.collapsed ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="relative flex items-center gap-0.5">
                      <button
                        title="删除"
                        onClick={() => {
                          if (window.confirm("确定删除这张便签？")) deleteSticky(st.id);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: "rgba(0,0,0,0.5)" }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="更多"
                        onClick={() => setMoreFor(moreFor === st.id ? null : st.id)}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/10"
                        style={{ color: moreFor === st.id ? "var(--primary)" : "rgba(0,0,0,0.5)" }}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {moreFor === st.id && (
                        <div
                          className="absolute right-0 top-full z-30 mt-0.5 flex min-w-[150px] flex-col rounded-md p-1 shadow-lg"
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                        >
                          <button
                            disabled={st.locked}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
                            style={{ color: "var(--foreground)" }}
                            onClick={() => {
                              if (!st.locked) switchContentType(st.id, isText ? "todo" : "text");
                              setMoreFor(null);
                            }}
                          >
                            {isText ? <ListTodo className="h-3.5 w-3.5" /> : <AlignLeft className="h-3.5 w-3.5" />}
                            切换内容
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                            style={{ color: st.private ? "#B45309" : "var(--foreground)" }}
                            onClick={() => {
                              updateSticky(st.id, { private: !st.private });
                              setMoreFor(null);
                            }}
                          >
                            {st.private ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            私密
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                            style={{ color: st.locked ? "#B45309" : "var(--foreground)" }}
                            onClick={() => {
                              setLocked(st.id, !st.locked);
                              setMoreFor(null);
                            }}
                          >
                            {st.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                            锁定
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                            style={{ color: st.encrypted ? "#B45309" : "var(--foreground)" }}
                            onClick={() => {
                              setSecTarget({ id: st.id, mode: st.encrypted ? "decrypt" : "encrypt" });
                              setMoreFor(null);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {st.encrypted ? "解除加密" : "独立加密"}
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                            style={{ color: st.floating ? "#B45309" : "var(--foreground)" }}
                            onClick={() => {
                              toggleFloating(st.id, !st.floating);
                              setMoreFor(null);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {st.floating ? "收回到便签墙" : "浮动到桌面"}
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                            style={{ color: "var(--foreground)" }}
                            onClick={() => {
                              duplicateSticky(st);
                              setMoreFor(null);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            复制便签
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 主题色板 */}
                  {paletteFor === st.id && (
                    <div
                      className="absolute left-2 top-9 z-30 flex gap-1 rounded-md p-1.5 shadow-lg"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      {STICKY_THEMES.map((t) => (
                        <button
                          key={t.id}
                          title={t.label}
                          onClick={() => {
                            updateSticky(st.id, { theme: t.id });
                            setPaletteFor(null);
                          }}
                          className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                          style={{
                            background: t.color,
                            outline: st.theme === t.id ? "2px solid #555" : "none",
                            outlineOffset: 1,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {/* 纸张选择面板 */}
                  {paperFor === st.id && (
                    <div
                      className="absolute left-2 top-9 z-30 w-40 rounded-md bg-foreground/5 p-1.5 shadow-lg"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      {STICKY_PAPERS.map((p) => (
                        <button
                          key={p.id}
                          title={p.desc}
                          onClick={() => {
                            updateSticky(st.id, { paper: p.id });
                            setPaperFor(null);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
                          style={{
                            color: "var(--foreground)",
                            fontWeight: (st.paper ?? "blank") === p.id ? 600 : 400,
                          }}
                        >
                          <span
                            className="h-4 w-4 rounded-sm border"
                            style={{ ...getPaperStyle(p.id, tc), borderColor: "rgba(0,0,0,0.1)" }}
                          />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 已独立加密且本会话未解开：覆盖，需输入口令查看（仅内存，不写回存储） */}
                  {st.encrypted && !revealed[st.id] && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSecTarget({ id: st.id, mode: "decrypt" })}
                      onKeyDown={(e) => e.key === "Enter" && setSecTarget({ id: st.id, mode: "decrypt" })}
                      className="relative z-20 mx-2 my-1 flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed p-4 text-center"
                      style={{ background: "rgba(255,255,255,0.6)", borderColor: "rgba(0,0,0,0.12)" }}
                      title="点击输入口令查看"
                    >
                      <KeyRound className="h-5 w-5" style={{ color: "rgba(0,0,0,0.5)" }} />
                      <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.55)" }}>
                        已独立加密 · 点击输入口令查看
                      </span>
                    </div>
                  )}

                  {/* 已在本会话解开：明文可编辑（每次修改用同一口令重新加密写回，存储始终为密文） */}
                  {st.encrypted && revealed[st.id] && (
                    <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3">
                      <input
                        value={revealed[st.id].content.title}
                        onChange={(e) =>
                          updateRevealedContent(st.id, { ...revealed[st.id].content, title: e.target.value })
                        }
                        placeholder="便签标题"
                        className="mb-1 bg-transparent text-sm font-semibold outline-none"
                        style={{ color: "rgba(0,0,0,0.85)" }}
                      />
                      {revealed[st.id].content.content_type === "text" ? (
                        <textarea
                          value={revealed[st.id].content.body}
                          onChange={(e) =>
                            updateRevealedContent(st.id, { ...revealed[st.id].content, body: e.target.value })
                          }
                          placeholder="开始输入…"
                          className="flex-1 resize-none bg-transparent text-[13px] outline-none"
                          style={{ color: "rgba(0,0,0,0.8)" }}
                        />
                      ) : (
                        <ul className="mt-0.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                          {revealed[st.id].content.items.map((it, idx) => {
                            const txt = it.replace(/^\[x\] /, "").replace(/^\[ \] /, "");
                            const itDone = it.startsWith("[x] ");
                            return (
                              <li key={idx} className="flex items-start gap-1">
                                <input
                                  type="checkbox"
                                  checked={itDone}
                                  onChange={(e) => {
                                    const next = [...revealed[st.id].content.items];
                                    next[idx] = `${e.target.checked ? "[x] " : "[ ] "}${txt}`;
                                    updateRevealedContent(st.id, { ...revealed[st.id].content, items: next });
                                  }}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                />
                                <input
                                  value={txt}
                                  onChange={(e) => {
                                    const next = [...revealed[st.id].content.items];
                                    next[idx] = `${itDone ? "[x] " : "[ ] "}${e.target.value}`;
                                    updateRevealedContent(st.id, { ...revealed[st.id].content, items: next });
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                                  style={{ color: itDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)", textDecoration: itDone ? "line-through" : "none" }}
                                />
                                <button
                                  onClick={() =>
                                    updateRevealedContent(st.id, {
                                      ...revealed[st.id].content,
                                      items: revealed[st.id].content.items.filter((_, i) => i !== idx),
                                    })
                                  }
                                  className="text-[11px] opacity-50 hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </li>
                            );
                          })}
                          <li className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                updateRevealedContent(st.id, {
                                  ...revealed[st.id].content,
                                  items: [...revealed[st.id].content.items, "[ ] "],
                                })
                              }
                              className="text-[11px] opacity-50 hover:opacity-100"
                            >
                              + 添加
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  )}

                  {!st.encrypted && (
                  <>
                  {/* 标题（可编辑；锁定只读） */}
                  {st.locked ? (
                    <div className="relative z-10 mx-3 mb-1 text-sm font-semibold" style={{ color: "rgba(0,0,0,0.85)" }}>
                      {st.title}
                    </div>
                  ) : (
                  <input
                    value={st.title}
                    onChange={(e) => updateSticky(st.id, { title: e.target.value })}
                    placeholder={isText ? "文本便签" : "便签标题"}
                    className="relative z-10 mx-3 mb-1 bg-transparent text-sm font-semibold outline-none"
                    style={{ color: "rgba(0,0,0,0.85)" }}
                  />
                  )}

                  {/* 内容区域（锁定=只读） */}
                  {!st.collapsed && (
                    <div
                      className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-3"
                      style={
                        st.locked
                          ? { pointerEvents: "none", opacity: 0.85 }
                          : st.private
                            ? { filter: "blur(4px)", pointerEvents: "none" }
                            : undefined
                      }
                    >
                      {isText ? (
                        <textarea
                          value={st.body ?? ""}
                          onChange={(e) => updateSticky(st.id, { body: e.target.value })}
                          placeholder="在此输入文本内容…"
                          className="min-h-0 flex-1 resize-none bg-transparent text-sm outline-none"
                          style={{ color: "rgba(0,0,0,0.8)" }}
                        />
                      ) : (
                        <div className="flex min-h-0 flex-1 flex-col gap-1">
                          {st.items.map((item, idx) => {
                            const itemDone = item.startsWith("[x] ");
                            return (
                              <div key={idx} className="flex items-start gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={itemDone}
                                  onChange={(e) => setItemDone(st.id, idx, e.target.checked)}
                                  className="mt-1"
                                />
                                <textarea
                                  value={item.replace(/^\[x\] /, "").replace(/^\[ \] /, "")}
                                  onChange={(e) => updateItem(st.id, idx, e.target.value)}
                                  onInput={(e) => {
                                    const t = e.target as HTMLTextAreaElement;
                                    t.style.height = "auto";
                                    t.style.height = t.scrollHeight + "px";
                                  }}
                                  placeholder="待办内容…"
                                  rows={1}
                                  className="flex-1 resize-none bg-transparent text-sm outline-none"
                                  style={{
                                    color: itemDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)",
                                    textDecoration: itemDone ? "line-through" : "none",
                                    minHeight: "1.5rem",
                                    lineHeight: "1.5",
                                    overflow: "hidden",
                                    wordBreak: "break-word",
                                  }}
                                />
                                <button
                                  onClick={() => removeItem(st.id, idx)}
                                  className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
                                  style={{ color: "rgba(0,0,0,0.4)" }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => addItem(st.id)}
                            className="mt-1 flex items-center gap-1 text-xs opacity-60 transition-opacity hover:opacity-100"
                            style={{ color: "rgba(0,0,0,0.6)" }}
                          >
                            <Plus className="h-3 w-3" /> 添加条目
                        </button>
                      </div>
                    )}
                    </div>
                  )}
                  </>
                  )}

                  {/* 底部进度 + 时间 */}
                  {!st.collapsed && (
                    <div
                      className="relative z-10 flex shrink-0 items-center justify-between px-3 py-1.5 text-[10px]"
                      style={{ color: "rgba(0,0,0,0.45)", borderTop: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      <span>
                        {isText ? (
                          "文本"
                        ) : total > 0 ? (
                          <>
                            <span style={{ color: allDone ? "#16A34A" : "rgba(0,0,0,0.6)" }}>
                              {done}/{total}
                            </span>
                            {allDone && (
                              <span style={{ color: "#16A34A", fontWeight: 600 }} className="ml-1">
                                已完成
                              </span>
                            )}
                          </>
                        ) : (
                          "无待办"
                        )}
                      </span>
                      <span>{fmtTime(st.updated_at)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 独立加密口令弹层 */}
      {secTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-72 rounded-lg bg-white p-4 shadow-xl">
            <div className="mb-2 text-sm font-semibold text-gray-800">
              {secTarget.mode === "encrypt" ? "设置独立加密口令" : "输入口令解除加密"}
            </div>
            <input
              type="password"
              autoFocus
              value={secPw}
              onChange={(e) => {
                setSecPw(e.target.value);
                setSecErr(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submitSec()}
              placeholder={secTarget.mode === "encrypt" ? "仅本便签使用，请牢记" : "口令"}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none"
            />
            {secErr && <div className="mt-1 text-xs text-red-600">{secErr}</div>}
            <div className="mt-3 flex justify-end gap-1.5">
              <button
                onClick={() => setSecTarget(null)}
                className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-black/5"
              >
                取消
              </button>
              <button
                onClick={submitSec}
                className="rounded bg-neutral-800 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 调色板图标（批量主题用） */
function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="1.2" fill="currentColor" />
      <circle cx="14" cy="8" r="1.2" fill="currentColor" />
      <circle cx="17" cy="13" r="1.2" fill="currentColor" />
      <path d="M12 15c-1.5 0-2 1.5-1 2.5S13 20 12 21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}