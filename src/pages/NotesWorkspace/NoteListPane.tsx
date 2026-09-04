import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  SortAsc,
  Filter,
  Star,
  Trash2,
  Clock,
  Tag,
  CheckSquare,
  Square,
  FolderOpen,
  X,
  ListChecks,
  Pin,
  Download,
  GripVertical,
  ArrowUpDown,
  Image as ImageIcon,
  Lock,
  EyeOff,
} from 'lucide-react';
import { getWeatherIcon, getMoodIcon } from '@/lib/noteMeta';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { INote, ITag, INotebook, MOCK_NOTEBOOKS } from '@/data/notes';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { NoteListSkeleton } from '@/components/SkeletonLoaders';
import NoteContextMenu from '@/components/NoteContextMenu';
import { useVirtualList } from '@/hooks/useVirtualList';
import { exportAndDownload, type ExportFormat } from '@/lib/noteExport';
import { stripHtmlToText } from '@/lib/text';

interface NoteListPaneProps {
  notes: INote[];
  activeNoteId: string;
  onSelect: (id: string) => void;
  onNewNote: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  filter: string;
  tags: ITag[];
  batchUpdate: (ids: string[], updates: Partial<INote>) => void;
  batchUpdateMeta: (ids: string[], updates: Partial<INote>) => void;
  batchDelete: (ids: string[]) => void;
  batchRestore?: (ids: string[]) => void;
  isLoading?: boolean;
  onTogglePin?: (id: string) => void;
  onDuplicateNote?: (id: string) => void;
  /** 自定义排序模式下拖拽重排后的顺序回调 */
  onReorder?: (orderedIds: string[]) => void;
  notebooks?: INotebook[];
}

function getTagMap(tags: ITag[]): Record<string, ITag> {
  const map: Record<string, ITag> = {};
  tags.forEach((t) => {
    map[t.id] = t;
  });
  return map;
}

function filterNotes(
  notes: INote[],
  filter: string,
  keyword: string,
  tags: ITag[],
  notebooks?: INotebook[],
): INote[] {
  let result = notes;

  if (filter === 'trash') {
    result = result.filter((n) => n.isDeleted);
  } else {
    result = result.filter((n) => !n.isDeleted);
    if (filter === 'all') {
      // 全部
    } else if (filter === 'favorite') {
      result = result.filter((n) => n.isFavorite);
    } else if (filter.startsWith('nb:')) {
      const nbId = filter.slice(3);
      result = result.filter((n) => n.notebookId === nbId);
    } else if (filter.startsWith('tag:')) {
      const tagId = filter.slice(4);
      result = result.filter((n) => n.tags.includes(tagId));
    } else if (filter === 'tags') {
      result = result.filter((n) => n.tags.length > 0);
    }
  }

  if (keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    const tagNameOf = (id: string) => tags.find((t) => t.id === id)?.name.toLowerCase() ?? '';
    const notebookNameOf = (id: string) =>
      notebooks?.find((nb) => nb.id === id)?.name.toLowerCase() ?? '';
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) ||
        n.excerpt.toLowerCase().includes(kw) ||
        n.tags.some((tid) => tagNameOf(tid).includes(kw)) ||
        notebookNameOf(n.notebookId).includes(kw),
    );
  }

  return result;
}

function sortNotes(notes: INote[], sortBy: string, sortDir: 'asc' | 'desc' = 'desc'): INote[] {
  const signed = (dir: number) => (sortDir === 'asc' ? dir : -dir);
  const sorted = [...notes];
  // 置顶笔记始终排在普通笔记之前
  const pinned = sorted.filter((n) => n.isPinned);
  const unpinned = sorted.filter((n) => !n.isPinned);

  const byUpdated = (list: INote[]) => list.sort((a, b) => signed(b.updatedAt - a.updatedAt));
  const byCreated = (list: INote[]) => list.sort((a, b) => signed(b.createdAt - a.createdAt));
  const byTitle = (list: INote[]) =>
    list.sort((a, b) => signed(a.title.localeCompare(b.title, 'zh')));
  const byManual = (list: INote[]) => list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (sortBy === 'manual') {
    return [...byManual(pinned), ...byManual(unpinned)];
  }
  if (sortBy === 'created') {
    return [...byCreated(pinned), ...byCreated(unpinned)];
  }
  if (sortBy === 'title') {
    return [...byTitle(pinned), ...byTitle(unpinned)];
  }
  return [...byUpdated(pinned), ...byUpdated(unpinned)];
}

interface ExtraFilter {
  tagIds: string[];
  notebookId?: string;
  /** 最近更新窗口天数 */
  dateWindow?: '7' | '30' | '90';
}

const emptyExtraFilter: ExtraFilter = { tagIds: [] };

function countActiveFilters(f: ExtraFilter): number {
  let n = f.tagIds.length;
  if (f.notebookId) n++;
  if (f.dateWindow) n++;
  return n;
}

function applyExtraFilter(notes: INote[], f: ExtraFilter): INote[] {
  let result = notes;
  if (f.tagIds.length > 0) {
    result = result.filter((n) => f.tagIds.some((tid) => n.tags.includes(tid)));
  }
  if (f.notebookId) {
    result = result.filter((n) => n.notebookId === f.notebookId);
  }
  if (f.dateWindow) {
    const from = Date.now() - Number(f.dateWindow) * 86400000;
    result = result.filter((n) => (n.updatedAt ?? 0) >= from);
  }
  return result;
}

/**
 * 列表主组件
 * 支持：多选、排序、拖拽自定义排序、虚拟滚动
 */
function getFilterLabel(filter: string, tags: ITag[]): string {
  if (filter === 'all') return '全部笔记';
  if (filter === 'favorite') return '收藏';
  if (filter === 'trash') return '回收站';
  if (filter === 'tags') return '标签';
  if (filter.startsWith('nb:')) {
    const nb = MOCK_NOTEBOOKS.find((n) => n.id === filter.slice(3));
    return nb?.name ?? '笔记本';
  }
  if (filter.startsWith('tag:')) {
    const tag = tags.find((t) => t.id === filter.slice(4));
    return tag ? `#${tag.name}` : '标签';
  }
  return '笔记';
}

/** 将文本中命中的关键字部分用高亮包裹 */
function highlightText(text: string, keyword: string) {
  const kw = keyword?.trim();
  if (!kw) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(kw)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === kw.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-primary/20 text-foreground px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NoteCard = memo(function NoteCard({
  note,
  tagMap,
  isActive,
  isSelected,
  multiSelectMode,
  onClick,
  onToggleFavorite,
  onToggleSelect,
  onTogglePin,
  onMove,
  notebooks,
  onDelete,
  onDuplicate,
  onRenameConfirm,
  highlightKeyword,
  density,
  index,
  enableAnimation,
  draggable,
  dragOver,
  isDragging,
  onDragStart,
}: {
  note: INote;
  tagMap: Record<string, ITag>;
  isActive: boolean;
  isSelected: boolean;
  multiSelectMode: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  onToggleSelect: () => void;
  onTogglePin?: () => void;
  onMove?: (id: string, notebookId: string) => void;
  notebooks?: INotebook[];
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRenameConfirm?: (id: string, newTitle: string) => void;
  highlightKeyword?: string;
  density?: 'comfortable' | 'compact';
  index: number;
  enableAnimation: boolean;
  draggable?: boolean;
  dragOver?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
}) {
  const dateStr = format(note.updatedAt, 'MM-dd HH:mm');
  const wordCount = stripHtmlToText(note.content).replace(/\s/g, '').length || 0;
  const imageCount = (note.content.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
  const padded = density === 'compact';

  const cardContent = (
    <motion.div
      data-drag-card={draggable ? index : undefined}
      initial={enableAnimation ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={enableAnimation ? { duration: 0.25, delay: Math.min(index * 0.03, 1.2), ease: 'easeOut' } : { duration: 0 }}
      whileHover={draggable ? { y: 0, scale: 1 } : { y: -1, scale: 1.005 }}
      onClick={multiSelectMode ? onToggleSelect : onClick}
      className={cn(
        'w-full text-left rounded-xl border transition-all group relative cursor-pointer',
        padded ? 'p-2.5' : 'p-4',
        isActive && !multiSelectMode
          ? 'bg-primary/5 border-primary/20 shadow-sm'
          : isSelected
            ? 'bg-primary/[0.07] border-primary/30'
            : dragOver
              ? 'border-primary/60 shadow-sm ring-1 ring-primary/20 scale-[1.02]'
              : 'bg-card border-border/50 hover:border-border hover:shadow-sm',
        isDragging && 'opacity-50 scale-[0.98] border-primary/40',
        note.isPinned && !isActive && !isSelected && !dragOver && 'border-primary/30',
      )}
    >
      {note.isPinned && (
        <span className="absolute -top-px -right-px rounded-tl rounded-br bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground flex items-center gap-0.5">
          <Pin className="size-2.5" />
          置顶
        </span>
      )}
      <div className="flex items-start gap-2.5">
        {multiSelectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="shrink-0 mt-0.5"
          >
            {isSelected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
          </button>
        )}
        {draggable && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragStart?.();
            }}
            className="shrink-0 mt-0.5 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground transition-colors touch-none"
            aria-label="拖拽排序"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              className={cn(
                'font-medium text-sm leading-snug line-clamp-1 flex-1 flex items-center gap-1.5',
                isActive ? 'text-foreground' : 'text-foreground',
              )}
            >
              {note.isPinned && (
                <Pin className="size-3 text-primary shrink-0" fill="currentColor" />
              )}
              {highlightKeyword ? highlightText(note.title, highlightKeyword) : note.title}
              {note.encrypted && (
                <Lock className="size-3 text-warning shrink-0" fill="currentColor" aria-label="已加密" />
              )}
              {note.isPrivate && (
                <EyeOff className="size-3 text-[#B45309] shrink-0" aria-label="已标记私密" />
              )}
              {getWeatherIcon(note.weather) && (
                <span className="shrink-0 text-xs" title={`天气 ${note.weather}`}>{getWeatherIcon(note.weather)}</span>
              )}
              {getMoodIcon(note.mood) && (
                <span className="shrink-0 text-xs" title={`心情 ${note.mood}`}>{getMoodIcon(note.mood)}</span>
              )}
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite();
                    }}
                    className={cn(
                      'shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all hover:scale-110',
                      note.isFavorite ? 'opacity-100' : '',
                    )}
                    aria-label={note.isFavorite ? '取消收藏' : '收藏'}
                  >
                    <Star
                      className={cn(
                        'size-3.5 transition-all',
                        note.isFavorite
                          ? 'fill-warning text-warning'
                          : 'text-muted-foreground hover:text-warning',
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {note.isFavorite ? '取消收藏' : '收藏'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <p className={cn(
            'text-xs text-muted-foreground leading-relaxed mb-2.5',
            padded ? 'line-clamp-1' : 'line-clamp-2',
          )}>
            {highlightKeyword ? highlightText(note.excerpt, highlightKeyword) : note.excerpt}
          </p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {note.tags.slice(0, 2).map((tagId) => {
                const tag = tagMap[tagId];
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] font-normal hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
              {note.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{note.tags.length - 2}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-2">
              {(imageCount > 0 || wordCount > 0) && (
                <span className="flex items-center gap-1">
                  {imageCount > 0 && (
                    <span className="inline-flex items-center gap-0.5" title={`${imageCount} 张图片`}>
                      <ImageIcon className="size-3" />
                      {imageCount}
                    </span>
                  )}
                  {wordCount > 0 && (
                    <span className="inline-flex items-center gap-0.5" title={`约 ${wordCount} 字`}>
                      {wordCount} 字
                    </span>
                  )}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {dateStr}
              </span>
            </span>
          </div>
        </div>
      </div>

      {isActive && !multiSelectMode && (
        <motion.div
          layoutId="note-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r bg-primary"
        />
      )}
    </motion.div>
  );

  // 多选模式下不包右键菜单，避免冲突
  if (multiSelectMode) return cardContent;

  return (
    <NoteContextMenu
      note={note}
      onDelete={onDelete}
      onToggleFavorite={onToggleFavorite}
      onTogglePin={onTogglePin}
      onMove={onMove}
      notebooks={notebooks}
      onDuplicate={onDuplicate}
      onRenameConfirm={onRenameConfirm}
    >
      {cardContent}
    </NoteContextMenu>
  );
});

export default function NoteListPane({
  notes,
  activeNoteId,
  onSelect,
  onNewNote,
  onToggleFavorite,
  onDelete,
  filter,
  tags,
  batchUpdate,
  batchUpdateMeta,
  batchDelete,
  isLoading = false,
  onTogglePin,
  onDuplicateNote,
  onReorder,
  notebooks = MOCK_NOTEBOOKS,
}: NoteListPaneProps) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showBatchTags, setShowBatchTags] = useState(false);
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [extraFilter, setExtraFilter] = useState<ExtraFilter>(emptyExtraFilter);
  const [showFilter, setShowFilter] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const lastClickIndexRef = useRef<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 搜索防抖：停止输入 250ms 后再过滤，避免大列表逐键过滤卡顿
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(t);
  }, [keyword]);

  const filtered = useMemo(
    () => applyExtraFilter(filterNotes(notes, filter, debouncedKeyword, tags, notebooks), extraFilter),
    [notes, filter, debouncedKeyword, tags, notebooks, extraFilter],
  );

  const activeFilterCount = countActiveFilters(extraFilter);

  const sorted = useMemo(() => sortNotes(filtered, sortBy, sortDir), [filtered, sortBy, sortDir]);

  // 性能优化：大列表时禁用逐卡动画，限制最大 stagger delay
  const enableAnimation = sorted.length <= 50;
  const tagMap = useMemo(() => getTagMap(tags), [tags]);

  // 虚拟滚动：笔记卡片高度约 88px + 间距 8px
  const { virtualItems, totalHeight, onScroll, isVirtualized } = useVirtualList({
    itemCount: sorted.length,
    estimatedItemHeight: 96,
    overscan: 5,
    threshold: 50,
    scrollContainerRef: listContainerRef,
  });

  const filterLabel = useMemo(() => getFilterLabel(filter, tags), [filter, tags]);

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

  const handleToggleFavorite = useCallback(
    (id: string) => {
      onToggleFavorite(id);
    },
    [onToggleFavorite],
  );

  const handleToggleSelect = useCallback((id: string, index?: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (typeof index === 'number') {
        lastClickIndexRef.current = index;
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((n) => n.id)));
    }
  }, [allSelected, sorted]);

  const handleExitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Esc 退出多选；Ctrl+A 全选
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && multiSelectMode) {
        e.preventDefault();
        handleExitMultiSelect();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [multiSelectMode, handleExitMultiSelect]);

  const handleBatchFavorite = useCallback(() => {
    const ids = Array.from(selectedIds);
    const anyFav = ids.some((id) => notes.find((n) => n.id === id)?.isFavorite);
    batchUpdateMeta(ids, { isFavorite: !anyFav });
    toast.success(anyFav ? '已取消批量收藏' : '已批量收藏');
  }, [selectedIds, notes, batchUpdateMeta]);

  const handleBatchDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    batchDelete(ids);
    toast.success(`已将 ${ids.length} 篇笔记移至回收站`);
    handleExitMultiSelect();
  }, [selectedIds, batchDelete, handleExitMultiSelect]);

  const handleBatchMove = useCallback(
    (nbId: string) => {
      const ids = Array.from(selectedIds);
      batchUpdateMeta(ids, { notebookId: nbId });
      toast.success(`已移动 ${ids.length} 篇笔记`);
      setShowBatchMove(false);
    },
    [selectedIds, batchUpdateMeta],
  );

  const handleBatchExport = useCallback((format: ExportFormat = 'markdown') => {
    const ids = Array.from(selectedIds);
    const toExport = notes.filter((n) => ids.includes(n.id));
    const fmtLabel = format === 'markdown' ? 'Markdown' : format === 'html' ? 'HTML' : format === 'pdf' ? 'PDF' : 'TXT';
    toExport.forEach((note) => {
      exportAndDownload(note, {
        format,
        includeFrontmatter: true,
        includeTags: true,
        includeCreatedAt: true,
        includeUpdatedAt: true,
      });
    });
    toast.success(`已导出 ${toExport.length} 篇笔记 (${fmtLabel})`);
    handleExitMultiSelect();
  }, [selectedIds, notes, handleExitMultiSelect]);

  const handleBatchAddTag = useCallback(
    (tagId: string) => {
      const ids = Array.from(selectedIds);
      const updated = notes
        .filter((n) => ids.includes(n.id))
        .map((n) => ({
          ...n,
          tags: n.tags.includes(tagId) ? n.tags : [...n.tags, tagId],
        }));
      // 逐个更新（不刷新 updatedAt）
      updated.forEach((n) => {
        batchUpdateMeta([n.id], { tags: n.tags });
      });
      toast.success('已批量添加标签');
      setShowBatchTags(false);
    },
    [selectedIds, notes, batchUpdateMeta],
  );

  // 单条笔记移动到笔记本
  const handleMoveNote = useCallback(
    (id: string, nbId: string) => {
      batchUpdateMeta([id], { notebookId: nbId });
      toast.success('已移动笔记');
    },
    [batchUpdateMeta],
  );

  // 手动排序模式下的拖拽排序（基于 Pointer 事件，不依赖原生 draggable，兼容 Tauri WebView）
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  dragOverIndexRef.current = dragOverIndex;

  // 永久挂载一次 window 级指针监听；仅在拖拽进行中（draggingRef 非空）生效
  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const container = listContainerRef.current;
      if (!container || draggingRef.current === null) return;
      const cards = Array.from(
        container.querySelectorAll<HTMLElement>('[data-drag-card]'),
      );
      if (cards.length === 0) return;
      let hover = draggingRef.current;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          hover = i;
          break;
        }
      }
      if (hover > cards.length - 1) hover = cards.length - 1;
      dragOverIndexRef.current = hover;
      setDragOverIndex(hover);
    }
    function handleUp(e: PointerEvent) {
      e.preventDefault?.();
      const dragIndex = draggingRef.current;
      const hoverIndex = dragOverIndexRef.current;
      draggingRef.current = null;
      setDraggingIndex(null);
      setDragOverIndex(null);
      if (dragIndex === null || dragIndex < 0 || dragIndex >= sorted.length) return;
      if (
        hoverIndex !== null &&
        hoverIndex >= 0 &&
        hoverIndex !== dragIndex &&
        hoverIndex < sorted.length
      ) {
        const next = [...sorted];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(hoverIndex, 0, moved);
        onReorder?.(next.map((n) => n.id));
      }
    }
    function handleCancel() {
      draggingRef.current = null;
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [sorted, onReorder]);

  const handleDragStart = useCallback(
    (index: number) => {
      if (sortBy !== 'manual') return;
      draggingRef.current = index;
      dragOverIndexRef.current = index;
      setDraggingIndex(index);
      setDragOverIndex(index);
    },
    [sortBy],
  );

  return (
    <div className="flex flex-col h-full w-full border-r border-border/60 bg-muted/20">
      {/* 顶部栏 */}
      <div className="shrink-0 p-3 space-y-3 border-b border-border/60 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {multiSelectMode ? (
              <span className="flex items-center gap-1.5">
                <ListChecks className="size-4 text-primary" />
                多选模式
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                  {selectedIds.size} / {sorted.length}
                </Badge>
              </span>
            ) : (
              <>
                {filterLabel}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                  {sorted.length}
                </Badge>
              </>
            )}
          </h2>
          {multiSelectMode ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1 text-xs"
              onClick={handleExitMultiSelect}
            >
              <X className="size-3.5" />
              取消
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => setMultiSelectMode(true)}
              >
                <CheckSquare className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="default"
                className="h-7 px-2.5 gap-1 text-xs"
                onClick={onNewNote}
              >
                <Plus className="size-3.5" />
                新建
              </Button>
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索笔记..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        {multiSelectMode ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2 gap-1 text-xs flex-1"
              onClick={handleToggleAll}
            >
              {allSelected ? '取消全选' : '全选'}
            </Button>
            <Popover open={showBatchMove} onOpenChange={setShowBatchMove}>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs flex-1"
                  disabled={selectedIds.size === 0}
                >
                  <FolderOpen className="size-3.5" />
                  移动
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="text-xs text-muted-foreground mb-2 px-1">移动到笔记本</div>
                <div className="space-y-0.5">
                  {notebooks.map((nb) => (
                    <button
                      key={nb.id}
                      type="button"
                      onClick={() => handleBatchMove(nb.id)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: nb.color }}
                      />
                      {nb.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={showBatchTags} onOpenChange={setShowBatchTags}>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs flex-1"
                  disabled={selectedIds.size === 0}
                >
                  <Tag className="size-3.5" />
                  标签
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="text-xs text-muted-foreground mb-2 px-1">批量添加标签</div>
                <div className="space-y-0.5">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleBatchAddTag(tag.id)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
             <Button
               variant="secondary"
               size="sm"
               className="h-7 px-2 gap-1 text-xs flex-1"
               onClick={handleBatchFavorite}
               disabled={selectedIds.size === 0}
             >
               <Star className="size-3.5" />
               收藏
             </Button>
             <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs flex-1"
                      disabled={selectedIds.size === 0}
                    >
                      <Download className="size-3.5" />
                      导出
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1.5" align="start">
                    {(
                      [
                        ['markdown', 'Markdown (.md)'],
                        ['html', 'HTML (.html)'],
                        ['txt', '纯文本 (.txt)'],
                        ['pdf', 'PDF (打印)'],
                      ] as const
                    ).map(([fmt, label]) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleBatchExport(fmt)}
                        className="w-full text-left h-8 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
             <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 gap-1 text-xs flex-1"
              onClick={() => setShowBatchDelete(true)}
              disabled={selectedIds.size === 0}
            >
              <Trash2 className="size-3.5" />
              删除
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 text-xs px-2.5">
                  <SortAsc className="size-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">最近更新</SelectItem>
                  <SelectItem value="created">创建时间</SelectItem>
                  <SelectItem value="title">标题排序</SelectItem>
                  <SelectItem value="manual">手动排序</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sortBy !== 'manual' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      aria-label={sortDir === 'asc' ? '当前升序，点击降序' : '当前降序，点击升序'}
                    >
                      <ArrowUpDown
                        className={cn(
                          'size-3.5 transition-transform',
                          sortDir === 'asc' && 'rotate-180',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {sortDir === 'asc' ? '升序' : '降序'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDensity((d) => (d === 'comfortable' ? 'compact' : 'comfortable'))}
                    aria-label={density === 'compact' ? '切换为舒适布局' : '切换为紧凑布局'}
                  >
                    <ListChecks className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {density === 'compact' ? '紧凑布局' : '舒适布局'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Popover open={showFilter} onOpenChange={setShowFilter}>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(
                    'h-7 px-2 gap-1 text-xs',
                    activeFilterCount > 0 && 'border-primary/40 text-primary',
                  )}
                >
                  <Filter className="size-3.5" />
                  筛选
                  {activeFilterCount > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">高级筛选</span>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground"
                        onClick={() => setExtraFilter(emptyExtraFilter)}
                      >
                        清除
                      </Button>
                    )}
                  </div>

                  {/* 笔记本 */}
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1.5">笔记本</div>
                    <Select
                      value={extraFilter.notebookId ?? 'all'}
                      onValueChange={(v) =>
                        setExtraFilter((f) => ({
                          ...f,
                          notebookId: v === 'all' ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部笔记本</SelectItem>
                        {notebooks.map((nb) => (
                          <SelectItem key={nb.id} value={nb.id}>
                            {nb.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 更新时间 */}
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1.5">最近更新</div>
                    <Select
                      value={extraFilter.dateWindow ?? 'none'}
                      onValueChange={(v) =>
                        setExtraFilter((f) => ({
                          ...f,
                          dateWindow: v === 'none' ? undefined : (v as '7' | '30' | '90'),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不限</SelectItem>
                        <SelectItem value="7">近 7 天</SelectItem>
                        <SelectItem value="30">近 30 天</SelectItem>
                        <SelectItem value="90">近 90 天</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 标签 */}
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1.5">标签</div>
                    {tags.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">暂无标签</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => {
                          const active = extraFilter.tagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                setExtraFilter((f) => ({
                                  ...f,
                                  tagIds: active
                                    ? f.tagIds.filter((id) => id !== tag.id)
                                    : [...f.tagIds, tag.id],
                                }))
                              }
                              className={cn(
                                'h-6 px-2 rounded-full text-[11px] border transition-colors flex items-center gap-1',
                                active
                                  ? 'border-primary text-primary bg-primary/10'
                                  : 'border-border/60 text-muted-foreground hover:border-border',
                              )}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
        {!multiSelectMode && sortBy === 'manual' && (
          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
            <GripVertical className="size-3" />
            拖动卡片左侧把手自定义排序，刷新/重启后保留
          </p>
        )}
      </div>

      {/* 笔记列表 */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-2.5"
        onScroll={onScroll}
      >
        {isLoading ? (
          <NoteListSkeleton count={5} />
        ) : sorted.length === 0 ? (
          <EmptyState
            type={filter === 'trash' ? 'trash' : filter === 'favorite' ? 'favorite' : keyword.trim() ? 'search' : 'notes'}
            onAction={
              filter === 'trash' || keyword.trim() || filter === 'favorite'
                ? undefined
                : onNewNote
            }
            className="py-16"
          />
        ) : isVirtualized ? (
          /* 虚拟滚动模式：仅渲染可视区项目 */
          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map((vItem) => {
              const note = sorted[vItem.index];
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
                  className="space-y-2"
                >
                  <NoteCard
                    note={note}
                    tagMap={tagMap}
                    isActive={note.id === activeNoteId}
                    isSelected={selectedIds.has(note.id)}
                    multiSelectMode={multiSelectMode}
                    onClick={() => onSelect(note.id)}
                    onToggleFavorite={() => handleToggleFavorite(note.id)}
                    onToggleSelect={() => handleToggleSelect(note.id, vItem.index)}
                    onTogglePin={onTogglePin ? () => onTogglePin(note.id) : undefined}
                    onMove={(id, nbId) => handleMoveNote(id, nbId)}
                    notebooks={notebooks}
                    onDelete={() => onDelete(note.id)}
                    onDuplicate={onDuplicateNote ? () => onDuplicateNote(note.id) : undefined}
                    onRenameConfirm={(id, newTitle) => batchUpdate([id], { title: newTitle })}
                    highlightKeyword={debouncedKeyword}
                    density={density}
                    index={vItem.index}
                    enableAnimation={false}
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* 普通模式：列表未超过阈值，直接渲染 */
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sorted.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  tagMap={tagMap}
                  isActive={note.id === activeNoteId}
                  isSelected={selectedIds.has(note.id)}
                  multiSelectMode={multiSelectMode}
                  onClick={() => onSelect(note.id)}
                  onToggleFavorite={() => handleToggleFavorite(note.id)}
                  onToggleSelect={() => handleToggleSelect(note.id, i)}
                  onTogglePin={onTogglePin ? () => onTogglePin(note.id) : undefined}
                  onMove={(id, nbId) => handleMoveNote(id, nbId)}
                  notebooks={notebooks}
                  onDelete={() => onDelete(note.id)}
                  onDuplicate={onDuplicateNote ? () => onDuplicateNote(note.id) : undefined}
                  onRenameConfirm={(id, newTitle) => batchUpdate([id], { title: newTitle })}
                  highlightKeyword={debouncedKeyword}
                  density={density}
                  index={i}
                  enableAnimation={enableAnimation}
                  draggable={!multiSelectMode && sortBy === 'manual'}
                  dragOver={dragOverIndex === i}
                  isDragging={draggingIndex === i}
                  onDragStart={() => handleDragStart(i)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AlertDialog open={showBatchDelete} onOpenChange={setShowBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将选中的 {selectedIds.size} 篇笔记移至回收站吗？可在回收站中恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
