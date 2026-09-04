// ══════════════════════════════════════════════════════════════
// 四象限 · 钉在桌面的独立 OS 窗口（label: `quadrant-{workspaceId}`）
//
// 数据方案：与主窗共用同一份 localStorage（按工作区隔离），键为
//   `yixian_quadrant::ws::{workspaceId}`。
//   - 主窗 FourQuadrantPage 与独立窗读写同一份数据；
//   - 独立窗通过 storage 事件感知主窗/其他窗口的修改并实时刷新；
//   - 顶部栏为拖拽区(data-tauri-drag-region)，支持置顶/最小化/关闭。
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  TrendingUp,
  Check,
  Coffee,
  Plus,
  Trash2,
  GripHorizontal,
  MoveHorizontal,
} from "lucide-react";
import { wsKey, loadJSON } from "@/hooks/useLocalStorage";
import { useFloatingWindow } from "@/components/WindowChromeHook";
import { WindowControls } from "@/components/WindowControls";

type Quadrant = "q1" | "q2" | "q3" | "q4";

interface QuadTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  done: boolean;
  createdAt: number;
}

const QUADRANT_ORDER: Quadrant[] = ["q1", "q2", "q3", "q4"];

const QUADRANT_META: Record<
  Quadrant,
  { title: string; tag: string; color: string; border: string; bg: string; chip: string; icon: typeof Flame }
> = {
  q1: { title: "重要·紧急", tag: "立即做", color: "#DC2626", border: "#DC2626", bg: "#FEF2F2", chip: "#FEE2E2", icon: Flame },
  q2: { title: "重要·不急", tag: "做计划", color: "#059669", border: "#10B981", bg: "#ECFDF5", chip: "#D1FAE5", icon: TrendingUp },
  q3: { title: "紧急·不重要", tag: "快处理", color: "#D97706", border: "#F59E0B", bg: "#FFFBEB", chip: "#FEF3C7", icon: Check },
  q4: { title: "不重·不急", tag: "放松做", color: "#64748B", border: "#94A3B8", bg: "#F8FAFC", chip: "#E2E8F0", icon: Coffee },
};

export default function FloatingQuadrantWindow({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const storageKey = useMemo(() => wsKey("yixian_quadrant", workspaceId), [workspaceId]);

  const [tasks, setTasks] = useState<QuadTask[]>(() =>
    loadJSON<QuadTask[]>(storageKey, []),
  );
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
  });
  const [minimized, setMinimized] = useState(false);
  const [onTop, setOnTop] = useState(true);

  const { win, toggleAlwaysOnTop, close: closeWindow, APP_DRAG } = useFloatingWindow();

  const taskRef = useRef(tasks);
  useEffect(() => {
    taskRef.current = tasks;
  }, [tasks]);

  const readFromStorage = useCallback(() => {
    setTasks(loadJSON<QuadTask[]>(storageKey, []));
  }, [storageKey]);

  // 启动：仅应用初始置顶
  useEffect(() => {
    win.setAlwaysOnTop(true).catch(() => {});
  }, [win]);

  // 独立窗口：锁死 html/body 溢出，避免出现第二个页面级滚动条
  useEffect(() => {
    const el = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      elO: el.style.overflow, elH: el.style.height,
      bO: body.style.overflow, bH: body.style.height,
      rO: root ? root.style.overflow : "", rH: root ? root.style.height : "",
    };
    el.style.overflow = "hidden";
    el.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.margin = "0";
    if (root) { root.style.overflow = "hidden"; root.style.height = "100%"; }
    return () => {
      el.style.overflow = prev.elO; el.style.height = prev.elH;
      body.style.overflow = prev.bO; body.style.height = prev.bH; body.style.margin = "0";
      if (root) { root.style.overflow = prev.rO; root.style.height = prev.rH; }
    };
  }, []);

  // 跨窗同步：主窗/其他窗口修改存储后刷新
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) readFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, readFromStorage]);

  // 写回存储
  const persist = useCallback(
    (updates: QuadTask[]) => {
      localStorage.setItem(storageKey, JSON.stringify(updates));
    },
    [storageKey],
  );

  const updateTasks = useCallback(
    (updater: (prev: QuadTask[]) => QuadTask[]) => {
      setTasks((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const addTask = (q: Quadrant) => {
    const title = drafts[q].trim();
    if (!title) return;
    updateTasks((prev) => [
      { id: `qt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, quadrant: q, done: false, createdAt: Date.now() },
      ...prev,
    ]);
    setDrafts((d) => ({ ...d, [q]: "" }));
  };

  const toggleDone = useCallback(
    (id: string) =>
      updateTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    [updateTasks],
  );

  const removeTask = useCallback(
    (id: string) => updateTasks((prev) => prev.filter((t) => t.id !== id)),
    [updateTasks],
  );

  const moveTask = useCallback(
    (id: string, to: Quadrant) =>
      updateTasks((prev) => prev.map((t) => (t.id === id ? { ...t, quadrant: to } : t))),
    [updateTasks],
  );

  const moveIndex = useCallback(
    (id: string, dir: -1 | 1) => {
      const cur = taskRef.current.find((t) => t.id === id);
      if (!cur) return;
      const i = QUADRANT_ORDER.indexOf(cur.quadrant);
      const n = i + dir;
      if (n < 0 || n >= QUADRANT_ORDER.length) return;
      moveTask(id, QUADRANT_ORDER[n]);
    },
    [moveTask],
  );

  const byQuadrant = useMemo(() => {
    const m: Record<Quadrant, QuadTask[]> = { q1: [], q2: [], q3: [], q4: [] };
    tasks.forEach((t) => m[t.quadrant]?.push(t));
    return m;
  }, [tasks]);

  const toggleOnTop = async () => {
    const next = await toggleAlwaysOnTop();
    setOnTop(next);
  };

  const handleClose = () => {
    closeWindow();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ width: "100%", height: "100%" }}>
      {/* 顶部栏：左侧标题区为系统拖拽区，右侧 WindowControls 为普通可点击区域 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2.5 py-2.5">
        <div
          className="flex min-w-0 flex-1 items-center gap-2 select-none"
          style={APP_DRAG}
        >
          <GripHorizontal className="size-4 text-muted-foreground/60 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
              <span className="inline-block size-1.5 rounded-full bg-red-500" />
              <span>四象限规划</span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              钉在桌面 · {workspaceId || "当前工作区"}
            </div>
          </div>
        </div>
        <WindowControls
          onMinimize={() => setMinimized(true)}
          onTop={onTop}
          onToggleOnTop={toggleOnTop}
          onClose={handleClose}
        />
      </div>

      {/* 最小化：仅显示汇总条（计数行可拖动，按钮可点击） */}
      {minimized ? (
        <div
          key="min"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-4 text-center select-none"
          style={{ background: "rgba(0,0,0,0.03)", WebkitUserSelect: "none", userSelect: "none", touchAction: "none" }}
        >
          <div className="flex items-center gap-3" style={APP_DRAG}>
            {QUADRANT_ORDER.map((q) => {
              const n = byQuadrant[q].filter((t) => !t.done).length;
              return (
                <span key={q} className="flex items-center gap-1 text-sm font-semibold" style={{ color: QUADRANT_META[q].color }}>
                  <span className="inline-block size-2 rounded-full" style={{ background: QUADRANT_META[q].color }} />
                  {n}
                </span>
              );
            })}
          </div>
          <button
            className="rounded-md bg-primary/10 px-3 py-1 text-xs text-primary font-medium hover:bg-primary/20"
            onClick={() => setMinimized(false)}
          >
            展开四象限
          </button>
        </div>
      ) : (
        /* 四象限 2×2 网格 */
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5 p-2">
          {QUADRANT_ORDER.map((q) => {
            const meta = QUADRANT_META[q];
            const Icon = meta.icon;
            const list = byQuadrant[q];
            const openCnt = list.filter((t) => !t.done).length;
            return (
              <div
                key={q}
                className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
                style={{ borderColor: meta.border + "55", background: meta.bg }}
              >
                {/* 象限头 */}
                <div className="flex shrink-0 items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: `1px solid ${meta.border}22` }}>
                  <Icon className="size-3.5" style={{ color: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold leading-tight" style={{ color: meta.color }}>{meta.title}</div>
                    <div className="text-[9px] text-muted-foreground leading-tight">{meta.tag}</div>
                  </div>
                  <span className="rounded-full px-1.5 text-[9px] font-bold" style={{ background: meta.chip, color: meta.color }}>
                    {openCnt}
                  </span>
                </div>
                {/* 任务列表 */}
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 py-1">
                  {list.length === 0 && (
                    <div className="py-3 text-center text-[10px] text-muted-foreground/60">暂无任务</div>
                  )}
                  {list.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center gap-1.5 rounded-md bg-white/80 px-1.5 py-1"
                      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    >
                      <button
                        onClick={() => toggleDone(t.id)}
                        title="完成/取消"
                        className="flex size-3.5 shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: t.done ? "#10B981" : meta.color, background: t.done ? "#10B981" : "transparent" }}
                      >
                        {t.done && <Check className="size-2.5 text-white" />}
                      </button>
                      <span
                        className={`flex-1 truncate text-[11px] ${t.done ? "text-muted-foreground line-through" : ""}`}
                        title={t.title}
                      >
                        {t.title}
                      </span>
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => moveIndex(t.id, -1)} title="移到前一象限" className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                          <MoveHorizontal className="size-3" />
                        </button>
                        <button onClick={() => moveIndex(t.id, 1)} title="移到后一象限" className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                          <MoveHorizontal className="size-3 -scale-x-100" />
                        </button>
                        <button onClick={() => removeTask(t.id)} title="删除" className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* 添加 */}
                <div className="flex shrink-0 items-center gap-1 border-t border-black/5 bg-white/40 px-1.5 py-1">
                  <input
                    value={drafts[q]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addTask(q)}
                    placeholder="添加任务…"
                    className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => addTask(q)} title="添加" className="rounded p-0.5 text-muted-foreground hover:text-primary">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 四角隐形 resize 手柄 */}
      {(
        [
          { d: "NorthWest", c: "top-0 left-0 cursor-nwse-resize", s: "w-6 h-6" },
          { d: "NorthEast", c: "top-0 right-0 cursor-nesw-resize", s: "w-5 h-5" },
          { d: "SouthWest", c: "bottom-0 left-0 cursor-nesw-resize", s: "w-6 h-6" },
          { d: "SouthEast", c: "bottom-0 right-0 cursor-nwse-resize", s: "w-5 h-5" },
        ] as const
      ).map((h) => (
        <div
          key={h.d}
          onMouseDown={(e) => {
            e.stopPropagation();
            win
              .startResizeDragging(h.d)
              .then(() => {})
              .catch(() => {});
          }}
          className={`absolute ${h.s} opacity-0 ${h.c}`}
        />
      ))}
    </div>
  );
}