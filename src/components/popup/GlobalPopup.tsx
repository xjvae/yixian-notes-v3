// ══════════════════════════════════════════════════════════════
// GlobalPopup — 全局弹窗宿主（独立无边框置顶小窗）
// 由 popup 入口加载。根据 `popup:action` 事件或初次注入的 action 分发。
// 弹窗不依赖 React Router，全部通过后端命令工作，因此可脱离主窗口独立运行。
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { X, GripHorizontal } from "lucide-react";
import LocalSearchPane from "./LocalSearchPane";
import NewNotePane from "./NewNotePane";
import QuickOpenPane from "./QuickOpenPane";
import ClipboardPane from "./ClipboardPane";

export type PopupAction = "local-search" | "new-note" | "quick-open" | "clipboard";

export default function GlobalPopup() {
  const [action, setAction] = useState<PopupAction>("local-search");

  // 首次：从后端读取当前 action（避免创建窗口时事件尚未就绪而丢失初始化）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const a = (await invoke<string>("get_global_popup_action")) ?? "";
        if (!cancelled && isAction(a)) setAction(a as PopupAction);
      } catch {
        /* 非 Tauri 环境：保留默认 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 监听后端切换 action
  useEffect(() => {
    let un: (() => void) | undefined;
    let cancelled = false;
    listen<string>("popup:action", (e) => {
      const a = String(e.payload ?? "");
      if (isAction(a) && !cancelled) setAction(a as PopupAction);
    }).then((fn) => {
      if (cancelled) fn();
      else un = fn;
    });
    return () => {
      cancelled = true;
      un?.();
    };
  }, []);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePopup = () => {
    void closePopupNow();
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl">
      <TitleBar action={action} onClose={closePopup} />
      <div className="min-h-0 flex-1">
        {action === "local-search" && <LocalSearchPane />}
        {action === "new-note" && <NewNotePane />}
        {action === "quick-open" && <QuickOpenPane />}
        {action === "clipboard" && <ClipboardPane />}
      </div>
    </div>
  );
}

async function closePopupNow() {
  const inc = await getInvokeFn();
  if (inc) {
    inc("close_global_popup", {}).catch(() => getCurrentWindow().close());
  } else {
    getCurrentWindow().close();
  }
}

function isAction(v: string): boolean {
  return v === "local-search" || v === "new-note" || v === "quick-open" || v === "clipboard";
}

const TITLES: Record<PopupAction, string> = {
  "local-search": "本地文件搜索",
  "new-note": "快捷新建笔记",
  "quick-open": "快速打开",
  clipboard: "剪贴板",
};

function TitleBar({ action, onClose }: { action: PopupAction; onClose: () => void }) {
  return (
    <div
      data-tauri-drag-region
      className="flex shrink-0 select-none items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-2"
    >
      <GripHorizontal className="size-4 text-muted-foreground/50" />
      <span data-tauri-drag-region className="flex-1 text-xs font-medium text-muted-foreground">
        {TITLES[action]}
      </span>
      <button
        onClick={onClose}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="关闭"
        title="关闭 (Esc)"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// 轻量 invoke 封装：Tauri 环境下 close 走后端，否则直接关窗（预览兜底）
async function getInvokeFn() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke as <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  } catch {
    return null;
  }
}