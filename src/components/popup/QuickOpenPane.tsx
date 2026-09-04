// 快速打开弹窗面板（自包含：跨对象搜索，选择后交由主窗口打开对应笔记/页面）
import { useCallback, useEffect, useRef, useState } from "react";
import * as React from "react";
import { Search, FileText, CheckSquare, StickyNote, CornerDownLeft } from "lucide-react";
import { crossSearchFromBackend, type CrossHit } from "@/lib/backend";

export default function QuickOpenPane() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CrossHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 防抖跨对象搜索
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await crossSearchFromBackend(q);
      if (!cancelled) setHits(res ?? []);
      setSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => setSelected(0), [hits]);

  const open = useCallback((hit: CrossHit) => {
    void (async () => {
      const { emit } = await import("@tauri-apps/api/event");
      const { invoke } = await import("@tauri-apps/api/core");
      // 唤起主窗口并导航到对应对象（由主应用监听 popup:open-target 事件）
      await invoke("show_main_window", {});
      const target =
        hit.source === "note" ? `note:${hit.object_id}` :
        hit.source === "todo" ? `todo:${hit.object_id}` :
        hit.source === "captured" ? `captured:${hit.object_id}` :
        hit.source === "tag" ? `tag:${hit.object_id}` : "";
      if (target) await emit("popup:open-target", { target });
      // 关闭弹窗
      await invoke("close_global_popup", {});
    })();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (s - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(hits[selected]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索笔记、待办、采集项、标签…"
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {searching && <span className="text-xs text-muted-foreground">…</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {!query.trim() ? (
          <div className="py-10 text-center text-xs text-muted-foreground">输入关键词开始搜索</div>
        ) : hits.length === 0 && !searching ? (
          <div className="py-10 text-center text-xs text-muted-foreground">无匹配结果</div>
        ) : (
          <div className="space-y-0.5">
            {hits.map((h, i) => (
              <button
                key={`${h.source}:${h.object_id}:${i}`}
                onClick={() => open(h)}
                onMouseEnter={() => setSelected(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${i === selected ? "bg-primary/10" : ""}`}
              >
                {IconFor(h.source)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{h.title}</span>
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">{LabelOf(h.source)}</span>
                  </div>
                  {h.snippet && <p className="line-clamp-1 text-[11px] text-muted-foreground">{h.snippet}</p>}
                </div>
                {i === selected && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground/60" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {hits.length > 0 && (
        <div className="flex items-center gap-3 border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span><kbd className="rounded bg-muted px-1">↑↓</kbd> 选择</span>
          <span><kbd className="rounded bg-muted px-1">↵</kbd> 打开</span>
        </div>
      )}
    </div>
  );
}

function IconFor(source: CrossHit["source"]) {
  switch (source) {
    case "note":
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
    case "todo":
      return <CheckSquare className="size-4 shrink-0 text-muted-foreground" />;
    case "captured":
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
    case "tag":
      return <StickyNote className="size-4 shrink-0 text-muted-foreground" />;
    default:
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  }
}

function LabelOf(x: CrossHit["source"]): string {
  switch (x) {
    case "note":
      return "笔记";
    case "todo":
      return "待办";
    case "captured":
      return "采集";
    case "tag":
      return "标签";
    default:
      return "";
  }
}