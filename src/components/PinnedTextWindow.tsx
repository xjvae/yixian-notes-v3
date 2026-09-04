// 文本贴图浮动窗口组件
//
// 参考图片贴图窗口(PinnedImageWindow)的交互模式，保持一致：
//   1. 拖拽: data-tauri-drag-region 实现 OS 原生拖拽
//   2. 透明度: 窗口级(setOpacity)，与便签一致
//   3. 置顶切换: always_on_top
//   4. 快捷键: Esc 关闭窗口
//   5. 双击标题栏最小化(仅显示标题栏)
//   6. 四角 resize: 隐形手柄
//   7. 位置持久化: 监听 onMoved/onResized，防崩保存到 localStorage
// 窗口 label 前缀: cliptext-{id}

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import { X, Minus, Pin, PinOff, Droplet, GripHorizontal, Type } from "lucide-react";

// 文本贴图窗口持久化状态(按 id 存储)
interface PinTextWindowState {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  alwaysOnTop: boolean;
}

const DEFAULT_STATE: PinTextWindowState = {
  x: 100,
  y: 100,
  w: 300,
  h: 200,
  opacity: 1.0,
  alwaysOnTop: true,
};

// 四角 resize 手柄配置
const RESIZE_HANDLES = [
  { direction: "NorthWest" as const, className: "top-0 left-0 cursor-nwse-resize", size: "w-6 h-6" },
  { direction: "NorthEast" as const, className: "top-0 right-0 cursor-nesw-resize", size: "w-4 h-4" },
  { direction: "SouthWest" as const, className: "bottom-0 left-0 cursor-nesw-resize", size: "w-6 h-6" },
  { direction: "SouthEast" as const, className: "bottom-0 right-0 cursor-nwse-resize", size: "w-4 h-4" },
];

function stateKey(id: string): string {
  return `cliptext_state_${id}`;
}

function loadState(id: string): PinTextWindowState | null {
  try {
    const raw = localStorage.getItem(stateKey(id));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function saveState(id: string, state: PinTextWindowState) {
  try {
    localStorage.setItem(stateKey(id), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export default function PinnedTextWindow() {
  const [text, setText] = useState<string>("");
  const [minimized, setMinimized] = useState(false);
  const [opacityPanelOpen, setOpacityPanelOpen] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const stateRef = useRef<PinTextWindowState>({ ...DEFAULT_STATE });
  const saveTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const win = getCurrentWindow();
  const label = win.label;
  const itemId = label.startsWith("cliptext-") ? label.slice("cliptext-".length) : label;

  // 加载文本内容 + 恢复持久化状态
  useEffect(() => {
    // 恢复上次窗口状态(位置/透明度/置顶)
    const saved = loadState(itemId);
    if (saved && typeof saved.opacity === "number") {
      stateRef.current = { ...DEFAULT_STATE, ...saved };
      setOpacity(saved.opacity);
      setAlwaysOnTop(saved.alwaysOnTop ?? true);
      if (saved.opacity < 1.0) {
        try {
          (getCurrentWindow() as unknown as { setOpacity?: (v: number) => Promise<void> }).setOpacity?.(saved.opacity);
        } catch {}
      }
      getCurrentWindow().setAlwaysOnTop(saved.alwaysOnTop ?? true).catch(() => {});
    }

    // 从 initialization_script 注入的全局变量获取文本内容
    const injected = (window as unknown as { __CLIPTEXT_CONTENT__?: unknown }).__CLIPTEXT_CONTENT__;
    if (typeof injected === "string" && injected) {
      setText(injected);
    } else {
      // 尝试从 URL 参数获取
      const params = new URLSearchParams(window.location.search);
      const textParam = params.get("text");
      if (textParam) {
        setText(decodeURIComponent(textParam));
      }
    }

    return () => {};
  }, [itemId]);

  // Esc 关闭窗口
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        getCurrentWindow().close().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 根据文本内容自动适配窗口高度：避免贴图后上下留白过多
  useEffect(() => {
    if (minimized) return;
    const timer = window.setTimeout(() => {
      const el = rootRef.current;
      if (!el) return;
      const targetH = Math.ceil(el.scrollHeight);
      const targetW = Math.ceil(el.scrollWidth);
      getCurrentWindow()
        .setSize(new PhysicalSize(targetW, Math.max(120, Math.min(targetH, 900))))
        .catch(() => {});
    }, 30);
    return () => clearTimeout(timer);
  }, [text, minimized]);

  // 持久化窗口位置(拖拽/resize 后调用)
  const persistPosition = useCallback(async () => {
    try {
      const w = getCurrentWindow();
      const pos = await w.outerPosition();
      const size = await w.outerSize();
      const scale = await w.scaleFactor();
      const next: PinTextWindowState = {
        ...stateRef.current,
        x: Math.round(pos.x / scale),
        y: Math.round(pos.y / scale),
        w: Math.round(size.width / scale),
        h: Math.round(size.height / scale),
      };
      stateRef.current = next;
      saveState(itemId, next);
    } catch {
      /* ignore */
    }
  }, [itemId]);

  // 监听窗口移动/缩放，防崩持久化
  useEffect(() => {
    const w = getCurrentWindow();
    let moveTimer: number | null = null;

    const persistDebounced = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => persistPosition(), 300);
    };

    let unlistenMoved: (() => void) | undefined;
    let unlistenResized: (() => void) | undefined;

    w.onMoved(() => persistDebounced()).then((fn) => (unlistenMoved = fn)).catch(() => {});
    w.onResized(() => persistDebounced()).then((fn) => (unlistenResized = fn)).catch(() => {});

    return () => {
      if (moveTimer) clearTimeout(moveTimer);
      unlistenMoved?.();
      unlistenResized?.();
    };
  }, [persistPosition]);

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    stateRef.current = { ...stateRef.current, opacity: value };
    try {
      (getCurrentWindow() as unknown as { setOpacity?: (v: number) => Promise<void> }).setOpacity?.(value);
    } catch {}
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveState(itemId, stateRef.current);
    }, 500);
  };

  const handleToggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    stateRef.current = { ...stateRef.current, alwaysOnTop: next };
    await getCurrentWindow().setAlwaysOnTop(next).catch(() => {});
    saveState(itemId, stateRef.current);
  };

  const handleClose = async () => {
    await getCurrentWindow().close();
  };

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col overflow-hidden"
      style={{ background: "var(--yx-card)", borderRadius: 8 }}
    >
      {/* 顶部拖拽手柄 + 操作按钮 */}
      <div
        data-tauri-drag-region
        onDoubleClick={() => setMinimized((m) => !m)}
        className="flex shrink-0 items-center justify-between px-2 py-1.5"
        style={{
          userSelect: "none",
          cursor: "move",
          background: "var(--yx-card)",
          borderBottom: minimized ? "none" : "1px solid var(--yx-border)",
        }}
      >
        {/* 左侧:拖拽手柄 + 标题 */}
        <div className="flex min-w-0 items-center gap-1" data-tauri-drag-region>
          <GripHorizontal
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--yx-muted-foreground)" }}
          />
          <Type
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--yx-muted-foreground)" }}
          />
          <span
            className="max-w-[120px] truncate text-[10px] font-medium"
            style={{ color: "var(--yx-muted-foreground)" }}
            title="文本贴图"
          >
            文本贴图
          </span>
        </div>
        {/* 中间:弹性填充 */}
        <div className="min-w-0 flex-1" data-tauri-drag-region />
        {/* 右侧:操作按钮 */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            title={minimized ? "展开" : "最小化"}
            onClick={() => setMinimized((m) => !m)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--yx-muted)]"
            style={{ color: "var(--yx-muted-foreground)" }}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            title="透明度"
            onClick={() => setOpacityPanelOpen((p) => !p)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--yx-muted)]"
            style={{ color: opacityPanelOpen ? "var(--yx-primary)" : "var(--yx-muted-foreground)" }}
          >
            <Droplet className="h-3.5 w-3.5" />
          </button>
          <button
            title={alwaysOnTop ? "取消置顶" : "始终置顶"}
            onClick={handleToggleAlwaysOnTop}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--yx-muted)]"
            style={{ color: alwaysOnTop ? "var(--yx-primary)" : "var(--yx-muted-foreground)" }}
          >
            {alwaysOnTop ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button
            title="关闭 (Esc)"
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-red-500/20"
            style={{ color: "var(--yx-muted-foreground)" }}
          >
            <X className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* 透明度面板 */}
      {opacityPanelOpen && !minimized && (
        <div
          className="absolute right-2 top-9 z-10 flex items-center gap-2 rounded-md p-2"
          style={{
            background: "var(--yx-card)",
            border: "1px solid var(--yx-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          <span className="text-[10px]" style={{ color: "var(--yx-muted-foreground)" }}>透明</span>
          <input
            type="range"
            min={0.3}
            max={1.0}
            step={0.1}
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="w-24"
          />
          <span
            className="w-8 text-[10px] font-medium"
            style={{ color: "var(--yx-muted-foreground)" }}
          >
            {Math.round(opacity * 100)}%
          </span>
        </div>
      )}

      {/* 文本内容(最小化时隐藏) */}
      {!minimized && (
        <div
          className="max-h-[70vh] overflow-auto p-2.5"
          style={{ background: "var(--yx-card)" }}
        >
          <pre
            className="whitespace-pre-wrap break-words font-sans text-sm"
            style={{ color: "var(--yx-foreground)", lineHeight: 1.6, margin: 0 }}
          >
            {text || "（空内容）"}
          </pre>
        </div>
      )}

      {/* 底部状态(最小化时隐藏) */}
      {!minimized && (
        <div
          className="flex shrink-0 items-center gap-1 px-3 py-1 text-[9px]"
          style={{
            color: "var(--yx-subtle-foreground)",
            background: "var(--yx-card)",
            borderTop: "1px solid var(--yx-border)",
          }}
        >
          <span>Esc 关闭</span>
          {alwaysOnTop && <span className="ml-auto opacity-60">置顶</span>}
        </div>
      )}

      {/* 四角隐形 resize 手柄 */}
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.direction}
          onMouseDown={(e) => {
            e.stopPropagation();
            getCurrentWindow()
              .startResizeDragging(handle.direction)
              .then(() => persistPosition())
              .catch(() => {});
          }}
          className={`absolute ${handle.size} opacity-0 ${handle.className}`}
        />
      ))}
    </div>
  );
}
