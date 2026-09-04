// 本地文件搜索弹窗面板（自包含，无 Router 依赖）
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { Search, FolderOpen, FileText, Loader2 } from "lucide-react";
import {
  localSearchFromBackend,
  openLocalFile,
  revealLocalFile,
  pickSearchFolder,
  type LocalFileHit,
} from "@/lib/backend";
import { writeTextToClipboard } from "@/lib/clipboard";
import { formatBytes } from "@/lib/format";

const ROOT_KEY = "yixian_local_search_root";

export default function LocalSearchPane() {
  const [root, setRoot] = useState<string>(() => {
    try {
      return localStorage.getItem(ROOT_KEY) || "";
    } catch {
      return "";
    }
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocalFileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(ROOT_KEY, root);
    } catch {
      /* ignore */
    }
  }, [root]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pickRoot = useCallback(async () => {
    setError(null);
    const selected = await pickSearchFolder();
    if (selected) {
      setRoot(selected);
      setResults([]);
    } else setError("未选择目录或不可用");
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q || !root) {
      setResults([]);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await localSearchFromBackend(root, q, 80, { mode: "all", maxDepth: 12 });
        if (!cancelled) setResults(hits ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, root]);

  const sorted = useMemo(
    () => [...results].sort((a, b) => b.modified - a.modified),
    [results],
  );
  const nameHits = useMemo(() => sorted.filter((r) => r.name_match), [sorted]);
  const contentHits = useMemo(() => sorted.filter((r) => r.content_match), [sorted]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索本地文件与内容…"
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {!root && (
          <button
            onClick={pickRoot}
            className="flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <FolderOpen className="size-3.5" /> 选择目录
          </button>
        )}
      </div>

      {error && <p className="px-3 pt-2 text-xs text-destructive">{error}</p>}
      {root && (
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-muted-foreground/70">
          <FolderOpen className="size-3" /> {root}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!root ? (
          <Empty text="先选择一个搜索目录" action={<button onClick={pickRoot} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">选择目录</button>} />
        ) : !query.trim() ? (
          <Empty text="输入关键词开始搜索" />
        ) : !searching && results.length === 0 ? (
          <Empty text="没有找到结果" />
        ) : (
          <div className="space-y-1">
            {searching && results.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">搜索中…</div>
            )}
            {nameHits.length > 0 && <Section label={`文件名命中 ${nameHits.length}`} hits={nameHits} query={query} />}
            {contentHits.length > 0 && <Section label={`内容命中 ${contentHits.length}`} hits={contentHits} query={query} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted"><Search className="size-5 text-muted-foreground" /></div>
      <p className="text-xs text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

function Section({ label, hits, query }: { label: string; hits: LocalFileHit[]; query: string }) {
  return (
    <div className="pt-1">
      <p className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1">
        {hits.slice(0, 50).map((h) => (
          <button
            key={h.path}
            onClick={() => void openLocalFile(h.path)}
            className="flex w-full items-start gap-2.5 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left hover:border-primary/30"
            title={h.path}
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{Hl({ text: h.name, query })}</p>
              {h.content_match && (
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{h.snippet || h.rel_path}</p>
              )}
              <p className="truncate text-[10px] text-muted-foreground/60">{h.rel_path} · {formatBytes(h.size)}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void writeTextToClipboard(h.path);
              }}
              className="shrink-0 rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
              title="复制路径"
            >
              <FileText className="size-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void revealLocalFile(h.path);
              }}
              className="shrink-0 rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
              title="在文件夹中显示"
            >
              <FolderOpen className="size-3.5" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

// 高亮命中词（简化：仅按文件名匹配词高亮）
function Hl({ text, query }: { text: string; query: string }) {
  const terms = useMemo(() => {
    return query
      .trim()
      .split(/\s+/)
      .filter((t) => t && !t.startsWith("-"))
      .slice(0, 3);
  }, [query]);
  if (!terms.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(terms[0]);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="rounded bg-yellow-200/70 text-foreground">{text.slice(idx, idx + terms[0].length)}</span>
      {text.slice(idx + terms[0].length)}
    </>
  );
}