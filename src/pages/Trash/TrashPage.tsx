import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Clock,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { INote } from '@/data/notes';
import { MOCK_NOTEBOOKS } from '@/data/notes';

interface WorkspaceContext {
  notes: INote[];
  batchRestore: (ids: string[]) => void;
  batchDelete: (ids: string[], permanent?: boolean) => void;
  emptyTrash: () => void;
}

function formatDate(ts: number) {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return '今天';
  if (diff < 2 * day) return '昨天';
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString();
}

export default function TrashPage() {
  const ctx = useOutletContext<WorkspaceContext>();
  const { notes, batchRestore, batchDelete, emptyTrash } = ctx;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const deletedNotes = useMemo(
    () => notes.filter((n) => n.isDeleted).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  const allSelected =
    deletedNotes.length > 0 && selectedIds.size === deletedNotes.length;

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedNotes.map((n) => n.id)));
    }
  }, [allSelected, deletedNotes]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleRestore = useCallback(
    (ids: string[]) => {
      batchRestore(ids);
      setSelectedIds(new Set());
      toast.success(`已恢复 ${ids.length} 篇笔记`);
    },
    [batchRestore],
  );

  const handleDeletePermanently = useCallback(
    (ids: string[]) => {
      batchDelete(ids, true);
      setSelectedIds(new Set());
      toast.success(`已永久删除 ${ids.length} 篇笔记`);
    },
    [batchDelete],
  );

  const handleEmptyTrash = useCallback(() => {
    emptyTrash();
    setSelectedIds(new Set());
    setShowEmptyConfirm(false);
    toast.success('回收站已清空');
  }, [emptyTrash]);

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* 顶部栏 */}
      <div className="shrink-0 h-14 border-b border-border/60 px-6 flex items-center justify-between bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Trash2 className="size-5 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">回收站</h1>
          </div>
          <Badge variant="secondary" className="ml-2">
            {deletedNotes.length} 篇
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                已选 {selectedIds.size} 项
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRestore(Array.from(selectedIds))}
              >
                <RotateCcw className="size-3.5 mr-1" />
                恢复
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeletePermanently(Array.from(selectedIds))}
              >
                <Trash2 className="size-3.5 mr-1" />
                彻底删除
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowEmptyConfirm(true)}
            disabled={deletedNotes.length === 0}
          >
            <Trash2 className="size-3.5 mr-1" />
            清空回收站
          </Button>
        </div>
      </div>

      {/* 全选栏 */}
      {deletedNotes.length > 0 && (
        <div className="shrink-0 px-6 py-2 border-b border-border/30 bg-muted/20 flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleToggleAll}
            aria-label="全选"
          />
          <span className="text-xs text-muted-foreground">
            {allSelected ? '取消全选' : '全选'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {deletedNotes.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <div className="size-20 mx-auto mb-4 rounded-xl bg-muted flex items-center justify-center">
                  <Trash2 className="size-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-medium mb-1">回收站是空的</h3>
                <p className="text-sm text-muted-foreground">
                  删除的笔记会在这里保留，随时可以恢复
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {deletedNotes.map((note, i) => {
                  const isSelected = selectedIds.has(note.id);
                  const nb = MOCK_NOTEBOOKS.find((n) => n.id === note.notebookId);
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                    >
                      <Card
                        className={`border-border/40 transition-all ${
                          isSelected ? 'border-primary/50 bg-primary/[0.02]' : ''
                        }`}
                      >
                        <CardContent className="p-4 flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(note.id)}
                            className="mt-0.5"
                            aria-label={`选择 ${note.title}`}
                          />
                          <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1 line-through decoration-muted-foreground/60">
                              {note.title}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {note.excerpt}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                删除于 {formatDate(note.updatedAt)}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <BookOpen className="size-3" />
                                {nb?.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleRestore([note.id])}
                            >
                              <RotateCcw className="size-3 mr-1" />
                              恢复
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDeletePermanently([note.id])}
                            >
                              <Trash2 className="size-3 mr-1" />
                              删除
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 清空确认 */}
      <AlertDialog open={showEmptyConfirm} onOpenChange={setShowEmptyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              清空回收站
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除回收站中的所有笔记，无法恢复。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
