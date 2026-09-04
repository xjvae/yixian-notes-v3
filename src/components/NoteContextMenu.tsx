import { useCallback, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Edit3,
  Trash2,
  FolderOpen,
  Copy,
  Tag,
  Star,
  Pin,
  Share2,
  Download,
  Check,
} from 'lucide-react';
import { INote, INotebook, MOCK_NOTEBOOKS } from '@/data/notes';
import { toast } from 'sonner';
import { exportAndDownload } from '@/lib/noteExport';

interface NoteContextMenuProps {
  note: INote;
  children: React.ReactNode;
  onRename?: (id: string) => void;
  onRenameConfirm?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, notebookId: string) => void;
  onDuplicate?: (id: string) => void;
  onAddTag?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onShare?: (id: string) => void;
  onExport?: (id: string) => void;
}

export default function NoteContextMenu({
  note,
  children,
  onRename,
  onRenameConfirm,
  onDelete,
  onMove,
  onDuplicate,
  onAddTag,
  onToggleFavorite,
  onTogglePin,
  onShare,
  onExport,
  notebooks = MOCK_NOTEBOOKS,
}: NoteContextMenuProps & { notebooks?: INotebook[] }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);

  const openRenameDialog = useCallback(() => {
    setRenameValue(note.title);
    setRenameOpen(true);
  }, [note.title]);

  const confirmRename = useCallback(() => {
    const trimmed = renameValue.trim();
    setRenameOpen(false);
    if (!trimmed || trimmed === note.title) return;
    if (onRenameConfirm) {
      onRenameConfirm(note.id, trimmed);
    } else if (onRename) {
      onRename(note.id);
    } else {
      toast.message('请在打开编辑器后重命名');
    }
  }, [renameValue, note.id, note.title, onRename, onRenameConfirm]);

  const handleRename = useCallback(() => {
    openRenameDialog();
  }, [openRenameDialog]);

  const handleDelete = useCallback(() => {
    onDelete?.(note.id);
  }, [note.id, onDelete]);

  const handleMove = useCallback(() => {
    setMoveOpen(true);
  }, []);

  const handleMoveConfirm = useCallback(
    (notebookId: string) => {
      setMoveOpen(false);
      onMove?.(note.id, notebookId);
      toast.success('已移动笔记');
    },
    [note.id, onMove],
  );

  const handleDuplicate = useCallback(() => {
    onDuplicate?.(note.id);
    toast.success('已复制笔记');
  }, [note.id, onDuplicate]);

  const handleAddTag = useCallback(() => {
    onAddTag?.(note.id);
  }, [note.id, onAddTag]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(note.id);
  }, [note.id, onToggleFavorite]);

  const handleTogglePin = useCallback(() => {
    onTogglePin?.(note.id);
    toast.success(note.isPinned ? '已取消置顶' : '已置顶');
  }, [note.id, note.isPinned, onTogglePin]);

  const handleShare = useCallback(() => {
    onShare?.(note.id);
    // 生成一个可分享的占位链接并复制到剪贴板
    const link = `yixian://note/${note.id}`;
    void navigator.clipboard
      ?.writeText(link)
      .then(() => toast.success('分享链接已复制'))
      .catch(() => toast.success('分享链接已生成'));
  }, [note.id, onShare]);

  const handleExport = useCallback(() => {
    onExport?.(note.id);
    // 真实导出：下载单篇 .md
    exportAndDownload(note, {
      format: 'markdown',
      includeFrontmatter: true,
      includeTags: true,
      includeCreatedAt: true,
      includeUpdatedAt: true,
    });
    toast.success('已导出 Markdown');
  }, [note.id, onExport, note]);

  return (
    <>
      <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuLabel className="text-xs text-muted-foreground px-2 py-1.5 font-normal truncate">
          {note.title}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRename} className="text-xs cursor-pointer">
          <Edit3 className="size-3.5 mr-2" />
          重命名
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate} className="text-xs cursor-pointer">
          <Copy className="size-3.5 mr-2" />
          复制笔记
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleMove} className="text-xs cursor-pointer">
          <FolderOpen className="size-3.5 mr-2" />
          移动到...
        </ContextMenuItem>
        <ContextMenuItem onClick={handleAddTag} className="text-xs cursor-pointer">
          <Tag className="size-3.5 mr-2" />
          添加标签
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleToggleFavorite}
          className="text-xs cursor-pointer"
        >
          <Star className="size-3.5 mr-2" />
          {note.isFavorite ? '取消收藏' : '添加收藏'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleTogglePin} className="text-xs cursor-pointer">
          <Pin className="size-3.5 mr-2" />
          {note.isPinned ? '取消置顶' : '置顶'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleShare} className="text-xs cursor-pointer">
          <Share2 className="size-3.5 mr-2" />
          分享
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExport} className="text-xs cursor-pointer">
          <Download className="size-3.5 mr-2" />
          导出
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="size-3.5 mr-2" />
          {note.isDeleted ? '永久删除' : '移至回收站'}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

      {/* 重命名对话框（替代原生 window.prompt） */}
      <Dialog open={renameOpen} onOpenChange={(open) => !open && setRenameOpen(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>重命名笔记</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="输入新标题..."
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
              autoFocus
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>
              <Check className="size-3.5 mr-1" />
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动到笔记本对话框 */}
      <Dialog open={moveOpen} onOpenChange={(open) => !open && setMoveOpen(false)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>移动到笔记本</DialogTitle>
          </DialogHeader>
          <div className="py-1 max-h-[50vh] overflow-y-auto">
            <div className="space-y-0.5">
              {notebooks.map((nb) => (
                <button
                  key={nb.id}
                  type="button"
                  onClick={() => handleMoveConfirm(nb.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: nb.color }}
                  />
                  <span className="truncate">{nb.name}</span>
                  {note.notebookId === nb.id && (
                    <span className="ml-auto text-[10px] text-muted-foreground">当前</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
