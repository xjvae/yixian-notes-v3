// ============================================================
// LocalSearchPage — 本地文件系统搜索（文件名 + 文本内容）
//
// 通过 Rust 侧 local_search 命令在用户选择的根目录内实时搜索。
// 支持：选择/记忆根目录、模式切换(全部/仅文件名/仅内容)、
//       深度可配置、实时防抖搜索、命中高亮、总命中数、
//       按最近修改排序、加载更多、用系统默认程序打开、在资源管理器中显示。
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FolderOpen, FileText, Loader2, X, ArrowLeft, HardDrive,
  File, FolderUp, Settings2, ListX, Clock, Download, Copy, Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  localSearchFromBackend, openLocalFile, revealLocalFile, saveTextFile,
  pickSearchFolder, pickSaveFile,
  type LocalFileHit,
} from '@/lib/backend';
import { writeTextToClipboard } from '@/lib/clipboard';
import { formatBytes } from '@/lib/format';

const ROOT_KEY = 'yixian_local_search_root';
const MODE_KEY = 'yixian_local_search_mode';
const DEPTH_KEY = 'yixian_local_search_depth';
const PAGE_LIMIT = 60;

type SearchMode = 'all' | 'name' | 'content';

function formatWhen(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} 天前`;
  return new Date(ts).toLocaleDateString();
}

/** 从查询串中提取正向关键词（镜像 Rust 侧语法：排除 - 前缀、跳过 ext:） */
function positiveTerms(query: string): string[] {
  const terms: string[] = [];
  for (const tok of query.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok.startsWith('-')) continue;
    if (tok.startsWith('ext:')) continue;
    terms.push(tok.toLowerCase());
  }
  return terms;
}

/** 高亮所有正向关键词命中（多词 AND，全部标黄） */
function Highlight({ text, query }: { text: string; query: string }) {
  return useMemo(() => {
    const terms = positiveTerms(query);
    if (terms.length === 0) return <>{text}</>;
    const lower = text.toLowerCase();
    // 收集所有关键词命中区间，重叠加合并
    const ranges: { s: number; e: number }[] = [];
    for (const t of terms) {
      let s = 0;
      while (s <= lower.length) {
        const idx = lower.indexOf(t, s);
        if (idx === -1) break;
        const end = idx + t.length;
        if (ranges.length && idx <= ranges[ranges.length - 1].e) {
          ranges[ranges.length - 1].e = Math.max(ranges[ranges.length - 1].e, end);
        } else {
          ranges.push({ s: idx, e: end });
        }
        s = end;
      }
    }
    if (!ranges.length) return <>{text}</>;
    const out = [];
    let last = 0;
    for (const r of ranges) {
      if (last < r.s) out.push(text.slice(last, r.s));
      out.push(<mark key={r.s} className="rounded bg-yellow-200/70 px-0.5 text-foreground">{text.slice(r.s, r.e)}</mark>);
      last = r.e;
    }
    if (last < text.length) out.push(text.slice(last));
    return <>{out}</>;
  }, [text, query]);
}

export default function LocalSearchPage() {
  const navigate = useNavigate();
  const [root, setRoot] = useState<string>(
    () => { try { return localStorage.getItem(ROOT_KEY) || ''; } catch { return ''; } },
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalFileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<SearchMode>(() => {
    try { const m = localStorage.getItem(MODE_KEY); return (m === 'name' || m === 'content') ? m : 'all'; } catch { return 'all'; }
  });
  const [maxDepth, setMaxDepth] = useState<number>(() => {
    try { const d = Number(localStorage.getItem(DEPTH_KEY)); return (d >= 2 && d <= 32) ? d : 12; } catch { return 12; }
  });
  const [limit, setLimit] = useState(PAGE_LIMIT);
  const [recentFirst, setRecentFirst] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 记忆设置
  useEffect(() => { try { localStorage.setItem(ROOT_KEY, root); } catch { /* ignore */ } }, [root]);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ } }, [mode]);
  useEffect(() => { try { localStorage.setItem(DEPTH_KEY, String(maxDepth)); } catch { /* ignore */ } }, [maxDepth]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate(-1); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const pickRoot = useCallback(async () => {
    setPicking(true);
    setError(null);
    const selected = await pickSearchFolder();
    if (selected) { setRoot(selected); setResults([]); setLimit(PAGE_LIMIT); }
    else { setError('未选择目录或不可用（需桌面环境）'); }
    setPicking(false);
  }, []);

  // 实时搜索（防抖）
  useEffect(() => {
    const q = query.trim();
    if (!q || !root) { setResults([]); return; }
    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await localSearchFromBackend(root, q, limit, { mode, maxDepth });
        if (!cancelled) setResults(hits ?? []);
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, root, mode, maxDepth, limit]);

  const sorted = useMemo(() => {
    const arr = [...results];
    if (recentFirst) arr.sort((a, b) => b.modified - a.modified);
    else arr.sort((a, b) => a.rel_path.localeCompare(b.rel_path));
    return arr;
  }, [results, recentFirst]);

  const nameHits = useMemo(() => sorted.filter((r) => r.name_match), [sorted]);
  const contentHits = useMemo(() => sorted.filter((r) => r.content_match), [sorted]);
  const hasMore = results.length >= limit && limit < 1000;

  const onOpen = useCallback(async (p: string) => { await openLocalFile(p); }, []);
  const onReveal = useCallback((p: string) => { void revealLocalFile(p); }, []);

  const flashCopied = useCallback((key: string) => {
    setCopiedPath(key);
    window.setTimeout(() => setCopiedPath((k) => (k === key ? null : k)), 1200);
  }, []);

  const onCopyPath = useCallback(async (p: string) => {
    await writeTextToClipboard(p);
    flashCopied(`path:${p}`);
  }, [flashCopied]);

  const onCopySnippet = useCallback(async (s: string, p: string) => {
    await writeTextToClipboard(s);
    flashCopied(`snip:${p}`);
  }, [flashCopied]);

  const onExport = useCallback(async () => {
    if (!results.length) return;
    const lines: string[] = [`本地搜索结果 — 关键词: ${query.trim()}`, `总计: ${results.length}`, ''];
    const seen = new Set<string>();
    for (const r of results) {
      if (seen.has(r.path)) continue;
      seen.add(r.path);
      lines.push(`[${r.name_match ? '文件名' : ''}${r.name_match && r.content_match ? '+' : ''}${r.content_match ? '内容' : ''}] ${r.rel_path || r.path}`);
      if (r.content_match && r.snippet) lines.push(`    … ${r.snippet.replace(/\s+/g, ' ')}`);
    }
    const content = lines.join('\n');
    try {
      const p = await pickSaveFile(`local-search-${Date.now()}.txt`);
      if (p) await saveTextFile(p, content);
    } catch { setError('导出失败（需桌面环境）'); }
  }, [results, query]);

  const setModeAndReset = (m: SearchMode) => { setMode(m); setLimit(PAGE_LIMIT); };

  function modeBtn(v: SearchMode, label: string) {
    return (
      <button
        key={v}
        onClick={() => setModeAndReset(v)}
        className={`rounded-md px-2 py-0.5 font-medium transition-colors ${mode === v ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
      >
        {label}
      </button>
    );
  }

  const renderHit = (hit: LocalFileHit) => {
    const snippets = hit.snippets && hit.snippets.length ? hit.snippets : (hit.snippet ? [hit.snippet] : []);
    return (
      <div
        key={hit.path}
        onClick={() => void onOpen(hit.path)}
        className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-card p-3 hover:border-primary/30 hover:shadow-sm transition-all"
      >
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium"><Highlight text={hit.name} query={query} /></span>
            {hit.content_match && (
              <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px] border-blue-200 text-blue-600">内容</Badge>
            )}
            {hit.content_match && !!hit.content_hits && (
              <span className="shrink-0 text-[10px] text-muted-foreground/70">命中 {hit.content_hits} 次</span>
            )}
          </div>
          {hit.content_match && snippets.map((s, i) => (
            <p key={i} className="mt-0.5 line-clamp-1 text-xs text-muted-foreground"><Highlight text={s} query={query} /></p>
          ))}
          <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{hit.path}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <File className="size-3" /><span>{formatBytes(hit.size)}</span>
            <span>·</span><Clock className="size-3" /><span>{formatWhen(hit.modified)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); void onCopyPath(hit.path); }}
            className="rounded p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            title="复制路径"
          >
            {copiedPath === `path:${hit.path}`
              ? <Check className="size-4 text-primary" />
              : <Copy className="size-4 text-muted-foreground" />}
          </button>
          {hit.content_match && snippets[1] && (
            <button
              onClick={(e) => { e.stopPropagation(); void onCopySnippet(hit.snippet || snippets[0] || '', hit.path); }}
              className="rounded p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              title="复制片段"
            >
              {copiedPath === `snip:${hit.path}`
                ? <Check className="size-4 text-primary" />
                : <Copy className="size-4 text-muted-foreground" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onReveal(hit.path); }}
            className="rounded p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            title="在文件夹中显示"
          >
            <FolderUp className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* 顶部搜索栏 */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索本地文件与内容…（双击 Ctrl 打开）"
              className="h-12 bg-muted/40 pl-12 pr-24 text-base"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>}
            {!searching && query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted" aria-label="清除">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* 工具栏 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft className="size-4" /> 返回</Button>
            <Button variant="outline" size="sm" onClick={pickRoot} disabled={picking}>
              <FolderOpen className="size-4" />{picking ? '选择中…' : root ? '更换目录' : '选择目录'}
            </Button>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="size-3.5 shrink-0" />
              <span className="truncate">{root || '未设置搜索目录'}</span>
            </div>

            {query && results.length > 0 && !searching && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <ListX className="size-3.5" /> 命中 {results.length}
              </span>
            )}
            {query && results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onExport} aria-label="导出结果">
                <Download className="size-4" /> 导出
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowSettings((s) => !s)} aria-label="搜索设置">
              <Settings2 className="size-4" /> 设置
            </Button>
          </div>

          {/* 设置展开 */}
          {showSettings && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/40 bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">范围</span>
                <div className="flex gap-1">{modeBtn('all', '全部')}{modeBtn('name', '仅文件名')}{modeBtn('content', '仅内容')}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">深度</span>
                <select
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
                >
                  <option value={4}>浅层(4)</option>
                  <option value={8}>中层(8)</option>
                  <option value={12}>默认(12)</option>
                  <option value={20}>较深(20)</option>
                  <option value={32}>最深(32)</option>
                </select>
              </div>
              <button onClick={() => setRecentFirst((v) => !v)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Clock className="size-3.5" /> {recentFirst ? '最近修改优先' : '按路径排序'}
              </button>
            </div>
          )}

          {/* 搜索语法提示条 */}
          {query.trim() && (
            <div className="mt-2 rounded-md border border-dashed border-border/50 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="mr-2 font-medium">搜索语法</span>
              <span className="mr-3">多词空格 = 同时满足（AND）</span>
              <span className="mr-3"><code className="rounded bg-muted px-1">-词</code> 排除</span>
              <span><code className="rounded bg-muted px-1">ext:x</code> 限定类型（如 ext:md / ext:.txt）</span>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>

      {/* 结果区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          {!root ? (
            <Empty icon={<FolderOpen />} title="选择搜索目录" desc="先选择一个根目录，即可搜索其中的文件与内容"
              action={<Button onClick={pickRoot} disabled={picking}><FolderOpen className="size-4" /> 选择目录</Button>} />
          ) : !query.trim() ? (
            <Empty icon={<Search />} title="输入关键词开始搜索" desc="按文件名或文本内容搜索所选目录" />
          ) : results.length === 0 && !searching ? (
            <Empty icon={<ListX />} title="没有找到结果" desc="试试其他关键词，或更换根目录 / 调整深度" />
          ) : (
            <>
              {searching && results.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">搜索中…</div>}
              {nameHits.length > 0 && (
                <section>
                  <SectionTitle icon={<ListX className="size-4 text-primary" />} title="文件名命中" count={nameHits.length} />
                  <div className="space-y-2">{nameHits.slice(0, limit).map(renderHit)}</div>
                </section>
              )}
              {contentHits.length > 0 && (
                <section>
                  <SectionTitle icon={<FileText className="size-4 text-primary" />} title="内容命中" count={contentHits.length} />
                  <div className="space-y-2">{contentHits.slice(0, limit).map(renderHit)}</div>
                </section>
              )}
              {hasMore && (
                <div className="py-2 text-center">
                  <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_LIMIT)}>
                    <ListX className="size-4" /> 加载更多
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-xl bg-muted">{icon}</div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {icon}
      <span className="text-sm font-medium">{title}</span>
      <Badge variant="secondary" className="text-[10px]">{count}</Badge>
    </div>
  );
}