import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderTree,
  Plus,
  LayoutGrid,
  List,
  FileText,
  Archive,
  Trash2,
  Pencil,
  ArchiveRestore,
  MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MOCK_NOTEBOOKS, type INote, type INotebook } from '@/data/notes';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface WorkspaceContext {
  notes: INote[];
  notebooks: INotebook[];
  setActiveFilter: (filter: string) => void;
}

export default function NotebooksPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { notes } = context;
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localNotebooks, setLocalNotebooks] = useState<INotebook[]>(MOCK_NOTEBOOKS);

  const activeNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);

  const getNoteCount = (nbId: string) =>
    activeNotes.filter((n) => n.notebookId === nbId).length;

  const activeNotebooks = useMemo(
    () => localNotebooks.filter((n) => !n.archived),
    [localNotebooks],
  );
  const archivedNotebooks = useMemo(
    () => localNotebooks.filter((n) => n.archived),
    [localNotebooks],
  );

  const handleNotebookClick = (id: string) => {
    navigate(`/`);
    setTimeout(() => {
      context.setActiveFilter(`nb:${id}`);
    }, 0);
  };

  const handleNewNotebook = () => {
    const colors = ['#3F7F5F', '#6B8AA8', '#C9A87C', '#B08C7A', '#A08BC7', '#D4A574'];
    const newNb: INotebook = {
      id: `nb${Date.now()}`,
      name: '新笔记本',
      icon: '📒',
      color: colors[Math.floor(Math.random() * colors.length)],
      description: '',
      createdAt: Date.now(),
      archived: false,
    };
    setLocalNotebooks((prev) => [newNb, ...prev]);
    toast.success('已创建新笔记本');
  };

  const handleArchive = (id: string) => {
    setLocalNotebooks((prev) =>
      prev.map((n) => (n.id === id ? { ...n, archived: !n.archived } : n)),
    );
    toast.success('已归档笔记本');
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '删除笔记本',
      description: '确定要删除该笔记本吗？此操作不可撤销。',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    setLocalNotebooks((prev) => prev.filter((n) => n.id !== id));
    toast.success('已删除笔记本');
  };

  const NotebookCard = ({ notebook, index }: { notebook: INotebook; index: number }) => {
    const count = getNoteCount(notebook.id);
    if (viewMode === 'list') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.03 }}
        >
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
            <div
              className="size-10 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${notebook.color}20` }}
            >
              {notebook.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{notebook.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {notebook.description || '暂无描述'}
              </div>
            </div>
            <Badge variant="secondary" className="text-xs font-normal shrink-0">
              {count} 篇
            </Badge>
            <div className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
              {format(new Date(notebook.createdAt), 'M月d日', { locale: zhCN })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => toast.info('重命名功能')}>
                  <Pencil className="size-3.5 mr-2" /> 重命名
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleArchive(notebook.id)}>
                  {notebook.archived ? (
                    <><ArchiveRestore className="size-3.5 mr-2" /> 恢复</>
                  ) : (
                    <><Archive className="size-3.5 mr-2" /> 归档</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(notebook.id)}
                >
                  <Trash2 className="size-3.5 mr-2" /> 删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.04 }}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="group cursor-pointer"
        onClick={() => handleNotebookClick(notebook.id)}
      >
        <Card className="border-border/50 overflow-hidden hover:border-primary/30 transition-all h-full">
          <div
            className="h-20 flex items-center justify-center text-4xl"
            style={{ backgroundColor: notebook.color + '25' }}
          >
            <span className="drop-shadow-sm">{notebook.icon}</span>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{notebook.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 h-8">
                  {notebook.description || '暂无描述'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 -mr-1 -mt-1 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                    <Pencil className="size-3.5 mr-2" /> 重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(notebook.id); }}>
                    <Archive className="size-3.5 mr-2" /> 归档
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(notebook.id); }}
                  >
                    <Trash2 className="size-3.5 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="size-3" />
                {count} 篇笔记
              </div>
              <div className="text-[11px] text-muted-foreground">
                {format(new Date(notebook.createdAt), 'M月d日', { locale: zhCN })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FolderTree className="size-5 text-primary" />
              笔记本管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeNotebooks.length} 个活跃笔记本 · {archivedNotebooks.length} 个已归档
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border/60 bg-background p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List className="size-4" />
              </button>
            </div>
            <Button onClick={handleNewNotebook}>
              <Plus className="size-4 mr-1" />
              新建笔记本
            </Button>
          </div>
        </motion.div>

        {/* 活跃笔记本 */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FolderTree className="size-4 text-primary" />
            我的笔记本
          </h2>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeNotebooks.map((nb, i) => (
                <NotebookCard key={nb.id} notebook={nb} index={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {activeNotebooks.map((nb, i) => (
                <NotebookCard key={nb.id} notebook={nb} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* 归档笔记本 */}
        {archivedNotebooks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Archive className="size-4" />
              已归档
            </h2>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
                {archivedNotebooks.map((nb, i) => (
                  <NotebookCard key={nb.id} notebook={nb} index={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 opacity-70">
                {archivedNotebooks.map((nb, i) => (
                  <NotebookCard key={nb.id} notebook={nb} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
