// 剪贴板弹窗面板（自包含：列出历史，点击复制）
import { useCallback, useEffect, useState } from "react";
import { Clipboard, Copy, Check, FileText } from "lucide-react";
import {
  getClipboardHistory,
  isClipboardListening,
  startClipboardListener,
} from "@/lib/clipboard";
import { listen } from "@tauri-apps/api/event";

interface HistoryEntry {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}

export default function ClipboardPane() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getClipboardHistory(60);
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setItems([]);
    }
  }, []);

  // 挂载时自动开启剪贴板监听（若未开启），并订阅变化事件实时刷新
  useEffect(() => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      void load();
      return;
    }
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const on = await isClipboardListening();
        if (!on) {
          await startClipboardListener();
        }
      } catch {
        /* 监听启动失败则仅展示已有历史 */
      }
      if (!cancelled) await load();
    })();
    listen("yx-clipboard-changed", () => {
      if (!cancelled) void load();
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  const copy = useCallback(async (item: HistoryEntry) => {
    try {
      const { writeTextToClipboard } = await import("@/lib/clipboard");
      await writeTextToClipboard(item.content);
      setCopied(item.id);
      window.setTimeout(() => setCopied((c) => (c === item.id ? null : c)), 1200);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Clipboard className="size-4" /> 剪贴板历史
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
        {items.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">暂无剪贴板历史</div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => void copy(item)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left hover:border-primary/30"
          >
            {item.content_type === "image" ? (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 whitespace-pre-wrap break-all text-[13px]">
                {item.content_type === "image" ? "[图片]" : item.content}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <span className="shrink-0">
              {copied === item.id ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4 text-muted-foreground/60" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}