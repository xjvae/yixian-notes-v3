import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  FolderOpen,
  Tag,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  StickyNote,
  Settings,
  Clock,
  Search,
} from 'lucide-react';
import { INote, INotebook, ITag, IWorkspace } from '@/data/notes';
import { format } from 'date-fns';
// 本地版本：移除 logger 依赖

interface QuickOpenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: INote[];
  notebooks: INotebook[];
  tags: ITag[];
  workspace: IWorkspace;
  onSelectNote: (id: string) => void;
  recentNoteIds: string[];
  onNoteVisited: (id: string) => void;
}

interface SearchResult {
  id: string;
  type: 'note' | 'notebook' | 'tag' | 'page';
  title: string;
  subtitle?: string;
  icon: typeof FileText;
  path?: string;
  timestamp?: number;
}

export default function QuickOpen({
  open,
  onOpenChange,
  notes,
  notebooks,
  tags,
  workspace,
  onSelectNote,
  recentNoteIds,
  onNoteVisited,
}: QuickOpenProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 页面快捷项
  const pageItems: SearchResult[] = useMemo(
    () => [
      { id: 'page-dashboard', type: 'page', title: '统计仪表盘', icon: LayoutDashboard, path: '/dashboard' },
      { id: 'page-calendar', type: 'page', title: '日历', icon: Calendar, path: '/calendar' },
      { id: 'page-todos', type: 'page', title: '待办清单', icon: CheckSquare, path: '/todos' },
      { id: 'page-sticky', type: 'page', title: '便签墙', icon: StickyNote, path: '/sticky-wall' },
      { id: 'page-settings', type: 'page', title: '设置', icon: Settings, path: '/settings' },
    ],
    [],
  );

  // 最近访问
  const recentItems = useMemo<SearchResult[]>(() => {
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    return recentNoteIds
      .map((id) => noteMap.get(id))
      .filter((n): n is INote => !!n && !n.isDeleted)
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        type: 'note' as const,
        title: n.title,
        subtitle: format(n.updatedAt, 'MM-dd HH:mm'),
        icon: FileText,
        timestamp: n.updatedAt,
      }));
  }, [recentNoteIds, notes]);

  // 搜索结果
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { notes: [], notebooks: [], tags: [], pages: [] };

    const matchedNotes: SearchResult[] = notes
      .filter((n) => !n.isDeleted)
      .filter((n) => {
        const haystack = `${n.title} ${n.excerpt} ${n.tags
          .map((t) => tags.find((tg) => tg.id === t)?.name ?? '')
          .join(' ')}`.toLowerCase();
        // 简易模糊匹配：每个字符按顺序出现
        let idx = 0;
        for (const ch of q) {
          idx = haystack.indexOf(ch, idx);
          if (idx === -1) return false;
          idx++;
        }
        return true;
      })
      .slice(0, 15)
      .map((n) => ({
        id: n.id,
        type: 'note' as const,
        title: n.title,
        subtitle: n.excerpt.slice(0, 30),
        icon: FileText,
        timestamp: n.updatedAt,
      }));

    const matchedNotebooks: SearchResult[] = notebooks
      .filter((nb) => nb.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((nb) => ({
        id: nb.id,
        type: 'notebook' as const,
        title: nb.name,
        icon: FolderOpen,
      }));

    const matchedTags: SearchResult[] = tags
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        type: 'tag' as const,
        title: `#${t.name}`,
        icon: Tag,
      }));

    const matchedPages: SearchResult[] = pageItems.filter((p) =>
      p.title.toLowerCase().includes(q),
    );

    return {
      notes: matchedNotes,
      notebooks: matchedNotebooks,
      tags: matchedTags,
      pages: matchedPages,
    };
  }, [query, notes, notebooks, tags, pageItems]);

  const hasSearch = query.trim().length > 0;

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.type === 'note') {
        onNoteVisited(item.id);
        onSelectNote(item.id);
        navigate('/notes');
      } else if (item.type === 'notebook') {
        navigate('/notes');
        // 通过 state 传递筛选条件给工作区
        console.log('QuickOpen select notebook:', item.id);
      } else if (item.type === 'tag') {
        navigate('/tags');
      } else if (item.type === 'page' && item.path) {
        navigate(item.path);
      }
      onOpenChange(false);
    },
    [navigate, onSelectNote, onNoteVisited, onOpenChange],
  );

  // 打开时聚焦输入框并清空
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="hidden">
          <DialogTitle>快速打开</DialogTitle>
          <DialogDescription>搜索笔记、笔记本、标签和页面</DialogDescription>
        </DialogHeader>
        <Command className="rounded-lg border-0" filter={() => 1}>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <CommandInput
              ref={inputRef}
              placeholder="搜索笔记、笔记本、标签、页面..."
              value={query}
              onValueChange={setQuery}
              className="h-12 border-0 focus:ring-0 text-sm"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              <span className="text-xs">⌘</span>P
            </kbd>
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              没有找到相关结果
            </CommandEmpty>

            {!hasSearch && recentItems.length > 0 && (
              <CommandGroup heading="最近访问">
                {recentItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`recent-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="size-3" />
                      {item.subtitle}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!hasSearch && (
              <>
                <CommandSeparator />
                <CommandGroup heading="快速跳转">
                  {pageItems.slice(0, 6).map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm">{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {hasSearch && results.notes.length > 0 && (
              <CommandGroup heading={`笔记 · ${results.notes.length}`}>
                {results.notes.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`note-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasSearch && results.notebooks.length > 0 && (
              <CommandGroup heading={`笔记本 · ${results.notebooks.length}`}>
                {results.notebooks.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`nb-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-primary/70" />
                    <span className="text-sm">{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasSearch && results.tags.length > 0 && (
              <CommandGroup heading={`标签 · ${results.tags.length}`}>
                {results.tags.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`tag-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-primary/70" />
                    <span className="text-sm">{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasSearch && results.pages.length > 0 && (
              <CommandGroup heading={`页面 · ${results.pages.length}`}>
                {results.pages.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 text-[10px]">↑↓</kbd>
                导航
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 text-[10px]">↵</kbd>
                打开
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 text-[10px]">esc</kbd>
                关闭
              </span>
            </div>
            <span className="text-muted-foreground/70">{workspace.name}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
