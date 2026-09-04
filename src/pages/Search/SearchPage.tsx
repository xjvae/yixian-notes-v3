import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  StickyNote,
  Tag,
  X,
  Clock,
  BookOpen,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { INote, ITag } from '@/data/notes';
import type { IFloatingNote } from '@/data/floating-notes';
import { stickyHexByKey } from '@/data/floating-notes';
import { MOCK_NOTEBOOKS } from '@/data/notes';
import { useVirtualList } from '@/hooks/useVirtualList';
import { SearchResultActions, type WorkspaceActions } from '@/components/actions/SearchResultActions';
import { crossSearchFromBackend, type CrossHit } from '@/lib/backend';
import { ListChecks, Inbox } from 'lucide-react';
import { aggregateLocalCrossSearch } from '@/lib/crossSearchLocal';

interface WorkspaceContext extends WorkspaceActions {
  notes: INote[];
  stickyNotes: IFloatingNote[];
  tags: ITag[];
  todos: Array<{ id: string; title: string; description?: string }>;
  clipboard: Array<{ id: string; content: string; createdAt?: number }>;
  setActiveNoteId: (id: string) => void;
  setActiveFilter: (f: string) => void;
}

type SearchType = 'all' | 'note' | 'sticky' | 'tag';


export default function SearchPage() {
  const ctx = useOutletContext<WorkspaceContext>();
  const { notes, stickyNotes, tags, todos, clipboard, setActiveNoteId, setActiveFilter } = ctx;
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const [timeRange, setTimeRange] = useState('all');
  const [notebookFilter, setNotebookFilter] = useState('all');

  // 跨对象搜索：本地聚合 + Tauri 后端 cross_search 并入
  const [crossHits, setCrossHits] = useState<CrossHit[]>([]);
  useEffect(() => {
    if (!query.trim()) { setCrossHits([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // 本地聚合（两端通用，保证在浏览器开发也能命中待办/采集）
      const local = aggregateLocalCrossSearch(query, { todos, clipboard });
      // Tauri 后端搜索（仅桌面可用）
      let server: CrossHit[] = [];
      try {
        const rows = await crossSearchFromBackend(query);
        if (rows) server = rows;
      } catch {
        server = [];
      }
      if (!cancelled) setCrossHits([...server, ...local]);
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  // ESC 退出搜索，返回上一页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteListScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredNotes = useMemo(() => {
    let result = notes.filter((n) => !n.isDeleted);

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => {
            const tag = tags.find((tg) => tg.id === t);
            return tag?.name.toLowerCase().includes(q);
          }),
      );
    }

    if (timeRange !== 'all') {
      const now = Date.now();
      const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
      result = result.filter((n) => now - n.updatedAt < days * 86400000);
    }

    if (notebookFilter !== 'all') {
      result = result.filter((n) => n.notebookId === notebookFilter);
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [query, notes, tags, timeRange, notebookFilter]);

  // 虚拟滚动：搜索结果笔记列表（独立滚动容器）
  const { virtualItems, totalHeight, onScroll, isVirtualized } = useVirtualList({
    itemCount: filteredNotes.length,
    estimatedItemHeight: 100,
    overscan: 5,
    threshold: 50,
    scrollContainerRef: noteListScrollRef,
  });

  const filteredStickies = useMemo(() => {
    if (!query.trim() && type !== 'sticky') return stickyNotes;
    const q = query.toLowerCase();
    return stickyNotes.filter((s) => s.content.toLowerCase().includes(q));
  }, [query, stickyNotes, type]);

  const filteredTags = useMemo(() => {
    if (!query.trim()) return tags;
    const q = query.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, tags]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setActiveNoteId(id);
      setActiveFilter('all');
      navigate('/notes');
    },
    [navigate, setActiveNoteId, setActiveFilter],
  );

  const handleSelectTag = useCallback(
    (tagId: string) => {
      setActiveFilter(`tag:${tagId}`);
      navigate('/notes');
    },
    [navigate, setActiveFilter],
  );

  const resultCount =
    type === 'all'
      ? filteredNotes.length + filteredStickies.length + filteredTags.length + crossHits.length
      : type === 'note'
        ? filteredNotes.length
        : type === 'sticky'
          ? filteredStickies.length
          : filteredTags.length;

  // 跨对象结果只展示待办 / 资源 / 采集（笔记 / 便签 / 标签另有各自区块）
  const objectHits = useMemo(() => crossHits.filter((h) => h.source !== 'note'), [crossHits]);

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200/60 text-foreground rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* 顶部搜索栏 */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记、便签、标签... (Ctrl+K)"
              className="pl-12 pr-28 h-12 text-base bg-muted/40 border-border/50 focus-visible:ring-1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm" className="h-8 gap-1">
                    <Filter className="size-3.5" />
                    筛选
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">筛选条件</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">时间范围</Label>
                      <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部时间</SelectItem>
                          <SelectItem value="day">最近 1 天</SelectItem>
                          <SelectItem value="week">最近 7 天</SelectItem>
                          <SelectItem value="month">最近 30 天</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">笔记本范围</Label>
                      <Select value={notebookFilter} onValueChange={setNotebookFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部笔记本</SelectItem>
                          {MOCK_NOTEBOOKS.map((nb) => (
                            <SelectItem key={nb.id} value={nb.id}>
                              {nb.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">搜索范围</Label>
                      <div className="space-y-2">
                        {[
                          { label: '搜索标题', checked: true },
                          { label: '搜索正文', checked: true },
                          { label: '搜索标签', checked: true },
                        ].map((opt) => (
                          <div key={opt.label} className="flex items-center gap-2">
                            <Checkbox id={opt.label} defaultChecked={opt.checked} />
                            <label htmlFor={opt.label} className="text-sm">
                              {opt.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setTimeRange('all');
                        setNotebookFilter('all');
                      }}
                    >
                      重置筛选
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded hover:bg-muted"
                  aria-label="清除"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 结果区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* 结果统计 */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {query ? (
                <>
                  找到 <span className="font-medium text-foreground">{resultCount}</span> 条结果
                  {query && (
                    <>
                      {' '}关于「<span className="font-medium text-foreground">{query}</span>」
                    </>
                  )}
                </>
              ) : (
                '输入关键词开始搜索'
              )}
            </div>
            <Tabs value={type} onValueChange={(v) => setType(v as SearchType)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7 px-3">
                  全部
                </TabsTrigger>
                <TabsTrigger value="note" className="text-xs h-7 px-3">
                  笔记
                </TabsTrigger>
                <TabsTrigger value="sticky" className="text-xs h-7 px-3">
                  便签
                </TabsTrigger>
                <TabsTrigger value="tag" className="text-xs h-7 px-3">
                  标签
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <AnimatePresence mode="wait">
            {!query ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <div className="size-16 mx-auto mb-4 rounded-xl bg-muted flex items-center justify-center">
                  <Search className="size-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-base font-medium mb-1">全局搜索</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  搜索你的笔记、便签和标签
                </p>
                <div className="max-w-sm mx-auto space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">快捷筛选</div>
                  {['#工作', '灵感', '@重要', '本周'].map((s) => (
                    <Button
                      key={s}
                      variant="secondary"
                      size="sm"
                      className="mr-2 mb-2"
                      onClick={() => setQuery(s.replace(/[#@]/g, ''))}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </motion.div>
            ) : resultCount === 0 ? (
              <motion.div
                key="no-result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <div className="size-16 mx-auto mb-4 rounded-xl bg-muted flex items-center justify-center">
                  <FileText className="size-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-medium mb-1">没有找到结果</h3>
                <p className="text-sm text-muted-foreground">
                  试试其他关键词或调整筛选条件
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 笔记结果 */}
                {(type === 'all' || type === 'note') && filteredNotes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="size-4 text-primary" />
                      <span className="text-sm font-medium">笔记</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {filteredNotes.length}
                      </Badge>
                    </div>
                    {isVirtualized ? (
                      /* 虚拟滚动模式：独立滚动容器 */
                      <div
                        ref={noteListScrollRef}
                        className="space-y-2 overflow-y-auto"
                        style={{ maxHeight: 500 }}
                        onScroll={onScroll}
                      >
                        <div style={{ height: totalHeight, position: 'relative' }}>
                          {virtualItems.map((vItem) => {
                            const note = filteredNotes[vItem.index];
                            if (!note) return null;
                            return (
                              <div
                                key={note.id}
                                style={{
                                  position: 'absolute',
                                  top: vItem.offsetTop,
                                  left: 0,
                                  right: 0,
                                }}
                              >
                                <Card
                                  className="border-border/40 hover:border-primary/30 cursor-pointer transition-all hover:shadow-sm"
                                  onClick={() => handleSelectNote(note.id)}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                      <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm mb-1">
                                          {highlight(note.title)}
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-2">
                                          {highlight(note.excerpt)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {formatDate(note.updatedAt)}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <BookOpen className="size-3" />
                                            {MOCK_NOTEBOOKS.find(
                                              (n) => n.id === note.notebookId,
                                            )?.name}
                                          </span>
                                          {note.tags.slice(0, 2).map((t) => {
                                            const tag = tags.find((tg) => tg.id === t);
                                            if (!tag) return null;
                                            return (
                                              <span
                                                key={t}
                                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                style={{
                                                  backgroundColor: tag.color + '20',
                                                  color: tag.color,
                                                }}
                                              >
                                                #{tag.name}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <SearchResultActions note={note} ctx={ctx} />
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* 普通模式 */
                      <div className="space-y-2">
                        {filteredNotes.slice(0, 20).map((note, i) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.02 }}
                          >
                            <Card
                              className="border-border/40 hover:border-primary/30 cursor-pointer transition-all hover:shadow-sm"
                              onClick={() => handleSelectNote(note.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm mb-1">
                                      {highlight(note.title)}
                                    </div>
                                    <div className="text-xs text-muted-foreground line-clamp-2">
                                      {highlight(note.excerpt)}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="size-3" />
                                        {formatDate(note.updatedAt)}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <BookOpen className="size-3" />
                                        {MOCK_NOTEBOOKS.find(
                                          (n) => n.id === note.notebookId,
                                        )?.name}
                                      </span>
                                      {note.tags.slice(0, 2).map((t) => {
                                        const tag = tags.find((tg) => tg.id === t);
                                        if (!tag) return null;
                                        return (
                                          <span
                                            key={t}
                                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                                            style={{
                                              backgroundColor: tag.color + '20',
                                              color: tag.color,
                                            }}
                                          >
                                            #{tag.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <SearchResultActions note={note} ctx={ctx} />
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 便签结果 */}
                {(type === 'all' || type === 'sticky') && filteredStickies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote className="size-4 text-primary" />
                      <span className="text-sm font-medium">便签</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {filteredStickies.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {filteredStickies.slice(0, 6).map((s, i) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="rounded-lg p-3 text-sm cursor-pointer hover:shadow-md transition-shadow"
                          style={{ backgroundColor: stickyHexByKey(s.color) }}
                          onClick={() => navigate('/sticky-wall')}
                        >
                          <div className="line-clamp-4 text-foreground/80 text-xs leading-relaxed">
                            {highlight(s.content)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 标签结果 */}
                {(type === 'all' || type === 'tag') && filteredTags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="size-4 text-primary" />
                      <span className="text-sm font-medium">标签</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {filteredTags.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag, i) => (
                        <motion.button
                          key={tag.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleSelectTag(tag.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border hover:shadow-md transition-shadow"
                          style={{
                            borderColor: tag.color + '40',
                            color: tag.color,
                          }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {highlight(tag.name)}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 跨对象结果：待办 / 资源 / 采集（阶段2 统一搜索） */}
                {type === 'all' && objectHits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 mt-2">
                      <Inbox className="size-4 text-primary" />
                      <span className="text-sm font-medium">待办 / 资源 / 采集</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {objectHits.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {objectHits.slice(0, 12).map((hit, i) => (
                        <motion.div
                          key={`${hit.source}-${hit.object_id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.02 }}
                        >
                          <Card className="border-border/40 hover:border-primary/30 transition-all hover:shadow-sm">
                            <CardContent className="p-3 flex items-start gap-3">
                              {hit.source === 'todo' && <ListChecks className="size-4 text-emerald-500 mt-0.5 shrink-0" />}
                              {hit.source === 'captured' && <Inbox className="size-4 text-violet-500 mt-0.5 shrink-0" />}
                              {hit.source === 'tag' && <Tag className="size-4 text-primary mt-0.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{highlight(hit.title)}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {hit.source === 'todo' ? '待办' : hit.source === 'tag' ? '标签' : '采集'}
                                  </span>
                                </div>
                                {hit.snippet && (
                                  <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                    {highlight(hit.snippet)}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function formatDate(ts: number) {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return '今天';
  if (diff < 2 * day) return '昨天';
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString();
}
