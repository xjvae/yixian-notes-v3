// ============================================================
// LocalSearchOverlay — 双击 Ctrl 触发的本地搜索浮层
// 居中覆盖当前页面，输入即实时搜索本地文件/内容。
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FolderOpen, FileText, X, HardDrive, FolderUp, Maximize2, Copy, Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  localSearchFromBackend, openLocalFile, revealLocalFile, pickSearchFolder,
  type LocalFileHit,
} from '@/lib/backend';
import { writeTextToClipboard } from '@/lib/clipboard';
import { formatBytes } from '@/lib/format';

const ROOT_KEY = 'yixian_local_search_root';
const PAGE_LIMIT = 40;

export default function LocalSearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [root, setRoot] = useState<string>(() => {
    try { return localStorage.getItem(ROOT_KEY) || ''; } catch { return ''; }
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalFileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flashCopied = (key: string) => {
    setCopiedPath(key);
    window.setTimeout(() => setCopiedPath((k) => (k === key ? null : k)), 1100);
  };
  const onCopy = async (text: string, key: string) => {
    await writeTextToClipboard(text);
    flashCopied(key);
  };

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // ESC 关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // 实时搜索
  useEffect(() => {
    const q = query.trim();
    if (!q || !root) { setResults([]); return; }
    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await localSearchFromBackend(root, q, PAGE_LIMIT, {});
        if (!cancelled) setResults(hits ?? []);
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, root]);

  const pickRoot = async () => {
    try {
      const selected = await pickSearchFolder();
      if (!selected) return;
      localStorage.setItem(ROOT_KEY, selected);
      setRoot(selected);
      try { inputRef.current?.focus(); } catch { /* ignore */ }
    } catch { /* ignore */ }
  };

  const nameHits = useMemo(() => results.filter((r) => r.name_match), [results]);
  const contentHits = useMemo(() => results.filter((r) => r.content_match), [results]);

  const openFull = () => { navigate('/local-search'); onClose(); };

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-[min(680px,92vw)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 输入框 */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索本地文件与内容…"
            className="h-9 flex-1 border-0 bg-transparent text-base focus-visible:ring-0"
          />
          {searching && <span className="w-4 animate-pulse text-muted-foreground">·</span>}
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="关闭"><X className="size-4 text-muted-foreground" /></button>
        </div>

        {/* 根目录条 */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <HardDrive className="size-3.5 shrink-0" />
            <span className="truncate">{root || '未设置搜索目录'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!root && (
              <button onClick={pickRoot} className="flex items-center gap-1 hover:text-foreground">
                <FolderOpen className="size-3.5" /> 选择目录
              </button>
            )}
            <button onClick={openFull} className="flex items-center gap-1 hover:text-foreground">
              <Maximize2 className="size-3.5" /> 完整页
            </button>
          </div>
        </div>

        {/* 结果 */}
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="py-10 text-center text-sm text-muted-foreground">输入关键词开始搜索，或双击 Ctrl 关闭</p>
          ) : results.length === 0 && !searching ? (
            <p className="py-10 text-center text-sm text-muted-foreground">没有找到结果</p>
          ) : (
            <>
              {nameHits.map((h) => (
                <HitRow key={`n-${h.path}`} hit={h} query={query} copiedKey={copiedPath} onCopy={onCopy}
                  onOpen={() => void openLocalFile(h.path)} onReveal={() => void revealLocalFile(h.path)} />
              ))}
              {nameHits.length > 0 && contentHits.length > 0 && (
                <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground">━━ 内容命中 ━━</div>
              )}
              {contentHits.map((h) => (
                <HitRow key={`c-${h.path}`} hit={h} query={query} copiedKey={copiedPath} onCopy={onCopy}
                  onOpen={() => void openLocalFile(h.path)} onReveal={() => void revealLocalFile(h.path)} />
              ))}
            </>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center gap-3 border-t border-border/50 px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>Enter/点击打开</span>
          <span>·</span>
          <span>图标小按钮：在文件夹中显示</span>
          <span className="ml-auto">ESC 关闭</span>
        </div>
      </div>
    </div>
  );
}

function HitRow({ hit, query, copiedKey, onCopy, onOpen, onReveal }: {
  hit: LocalFileHit; query: string; copiedKey: string | null;
  onCopy: (text: string, key: string) => void; onOpen: () => void; onReveal: () => void;
}) {
  const snippets = hit.snippets && hit.snippets.length ? hit.snippets : (hit.snippet ? [hit.snippet] : []);
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/70"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium"><HighlightText text={hit.name} query={query} /></span>
          {hit.content_match && <span className="shrink-0 text-[10px] text-blue-500">内容</span>}
          {hit.content_match && !!hit.content_hits && (
            <span className="shrink-0 text-[10px] text-muted-foreground">×{hit.content_hits}</span>
          )}
        </div>
        {hit.content_match && snippets.slice(0, 1).map((s, i) => (
          <p key={i} className="line-clamp-1 text-xs text-muted-foreground"><HighlightText text={s} query={query} /></p>
        ))}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">{hit.rel_path} · {formatBytes(hit.size)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onCopy(hit.path, `path:${hit.path}`); }}
        className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        title="复制路径"
      >
        {copiedKey === `path:${hit.path}`
          ? <Check className="size-3.5 text-primary" />
          : <Copy className="size-3.5 text-muted-foreground" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onReveal(); }}
        className="shrink-0 rounded p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        title="在文件夹中显示"
      >
        <FolderUp className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

/** 从查询串中提取正向关键词（镜像 Rust 侧语法） */
function positiveTerms(query: string): string[] {
  const terms: string[] = [];
  for (const tok of query.trim().split(/\s+/)) {
    if (!tok || tok.startsWith('-') || tok.startsWith('ext:')) continue;
    terms.push(tok.toLowerCase());
  }
  return terms;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const terms = positiveTerms(query);
  const lower = text.toLowerCase();
  const idx = terms.map((t) => lower.indexOf(t)).filter((i) => i !== -1);
  if (!terms.length || !idx.length) return <>{text}</>;
  const s = Math.min(...idx);
  const t = terms.find((w) => lower.indexOf(w) === s)!;
  return (
    <>
      {text.slice(0, s)}
      <mark className="rounded bg-yellow-200/70 px-0.5 text-foreground">{text.slice(s, s + t.length)}</mark>
      {text.slice(s + t.length)}
    </>
  );
}