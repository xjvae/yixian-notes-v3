import { useState, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Merge,
  X,
  Check,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { INote, ITag } from '@/data/notes';
import { cn } from '@/lib/utils';
import { useVirtualList } from '@/hooks/useVirtualList';
import { PageHeader, StatCard } from '@/components/shared';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface WorkspaceContext {
  notes: INote[];
  tags: ITag[];
  addTag: (tag: ITag) => void;
  updateTag: (id: string, updates: Partial<ITag>) => void;
  deleteTag: (id: string) => void;
  mergeTags: (fromId: string, toId: string) => void;
}

const TAG_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

function TagCloudItem({
  tag,
  count,
  size,
  onClick,
}: {
  tag: ITag;
  count: number;
  size: 'sm' | 'md' | 'lg';
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border transition-shadow hover:shadow-md',
        size === 'lg' ? 'text-base font-medium' : size === 'md' ? 'text-sm' : 'text-xs',
      )}
      style={{
        borderColor: tag.color + '40',
        color: tag.color,
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
      <span className="text-muted-foreground ml-0.5">{count}</span>
    </motion.button>
  );
}

export default function TagsPage() {
  const ctx = useOutletContext<WorkspaceContext>();
  const { notes, tags, addTag, updateTag, deleteTag, mergeTags } = ctx;
  const { confirm } = useConfirm();
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTag, setEditingTag] = useState<ITag | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeTo, setMergeTo] = useState('');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const tagListScrollRef = useRef<HTMLDivElement>(null);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => {
      if (!n.isDeleted) {
        n.tags.forEach((t) => {
          counts[t] = (counts[t] ?? 0) + 1;
        });
      }
    });
    return counts;
  }, [notes]);

  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => (tagCounts[b.id] ?? 0) - (tagCounts[a.id] ?? 0));
  }, [tags, tagCounts]);

  // 虚拟滚动：标签列表（每个标签行高约 52px）
  const { virtualItems, totalHeight, onScroll, isVirtualized } = useVirtualList({
    itemCount: sortedTags.length,
    estimatedItemHeight: 52,
    overscan: 5,
    threshold: 50,
    scrollContainerRef: tagListScrollRef,
  });

  const activeTagNotes = useMemo(() => {
    if (!activeTagId) return [];
    return notes.filter((n) => !n.isDeleted && n.tags.includes(activeTagId));
  }, [activeTagId, notes]);

  const activeTag = useMemo(
    () => tags.find((t) => t.id === activeTagId),
    [tags, activeTagId],
  );

  const handleCreate = useCallback(() => {
    if (!newName.trim()) {
      toast.error('请输入标签名');
      return;
    }
    if (tags.some((t) => t.name === newName.trim())) {
      toast.error('标签已存在');
      return;
    }
    const newTag: ITag = {
      id: `t${Date.now()}`,
      name: newName.trim(),
      color: newColor,
    };
    addTag(newTag);
    setNewName('');
    setNewColor(TAG_COLORS[0]);
    setShowCreate(false);
    toast.success('标签已创建');
  }, [newName, newColor, tags, addTag]);

  const handleSaveEdit = useCallback(() => {
    if (!editingTag || !newName.trim()) return;
    updateTag(editingTag.id, { name: newName.trim(), color: newColor });
    setEditingTag(null);
    setNewName('');
    toast.success('标签已更新');
  }, [editingTag, newName, newColor, updateTag]);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: '删除标签',
        description: '确定要删除该标签吗？此操作不可撤销。',
        confirmText: '删除',
        danger: true,
      });
      if (!ok) return;
      deleteTag(id);
      if (activeTagId === id) setActiveTagId(null);
      toast.success('标签已删除');
    },
    [confirm, deleteTag, activeTagId],
  );

  const handleMerge = useCallback(() => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      toast.error('请选择两个不同的标签');
      return;
    }
    mergeTags(mergeFrom, mergeTo);
    setShowMergeDialog(false);
    setMergeFrom('');
    setMergeTo('');
    toast.success('标签已合并');
  }, [mergeFrom, mergeTo, mergeTags]);

  const totalTagged = useMemo(
    () => new Set(notes.filter((n) => !n.isDeleted && n.tags.length > 0).map((n) => n.id)).size,
    [notes],
  );

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* 顶部栏 */}
      <div className="shrink-0 border-b border-border/60 px-6 bg-background/80 backdrop-blur-sm">
        <PageHeader
          icon={<Tag className="size-5 text-primary" />}
          title="标签管理"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowMergeDialog(true)}>
                <Merge className="size-4 mr-1" />
                合并标签
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="size-4 mr-1" />
                新建标签
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* 统计概览 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <StatCard label="标签总数" value={tags.length} icon={<Tag className="size-5" />} tone="primary" />
            <StatCard label="已加标签笔记" value={totalTagged} icon={<FileText className="size-5" />} tone="success" />
            <StatCard
              label={`最常用：${sortedTags[0]?.name ?? '无'}`}
              value={tagCounts[sortedTags[0]?.id ?? ''] ?? 0}
              icon={<Sparkles className="size-5" />}
              tone="warning"
            />
          </motion.div>

          {/* 标签云 */}
          <Card className="border-border/50 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                标签云
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  按使用频次排列
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap gap-2"
              >
                {sortedTags.map((tag, i) => {
                  const count = tagCounts[tag.id] ?? 0;
                  const size: 'sm' | 'md' | 'lg' =
                    i < 2 ? 'lg' : i < 6 ? 'md' : 'sm';
                  return (
                    <TagCloudItem
                      key={tag.id}
                      tag={tag}
                      count={count}
                      size={size}
                      onClick={() => setActiveTagId(tag.id)}
                    />
                  );
                })}

                {sortedTags.length === 0 && (
                  <div className="w-full text-center py-8 text-muted-foreground text-sm">
                    还没有标签，点击右上角创建
                  </div>
                )}
              </motion.div>
            </CardContent>
          </Card>

          {/* 标签列表 */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                全部标签
                {sortedTags.length > 50 && (
                  <span className="text-[10px] font-normal text-muted-foreground">（已启用虚拟滚动）</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isVirtualized ? (
                /* 虚拟滚动模式 */
                <div
                  ref={tagListScrollRef}
                  className="overflow-y-auto"
                  style={{ maxHeight: 400 }}
                  onScroll={onScroll}
                >
                  <div style={{ height: totalHeight, position: 'relative' }}>
                    {virtualItems.map((vItem) => {
                      const tag = sortedTags[vItem.index];
                      if (!tag) return null;
                      return (
                        <div
                          key={tag.id}
                          style={{
                            position: 'absolute',
                            top: vItem.offsetTop,
                            left: 0,
                            right: 0,
                          }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/40"
                        >
                          <span
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="font-medium flex-1">{tag.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {tagCounts[tag.id] ?? 0} 篇
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingTag(tag);
                                setNewName(tag.name);
                                setNewColor(tag.color);
                              }}
                              aria-label="编辑"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(tag.id)}
                              aria-label="删除"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* 普通模式 */
                <div className="divide-y divide-border/40">
                  <AnimatePresence>
                    {sortedTags.map((tag, i) => (
                      <motion.div
                        key={tag.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium flex-1">{tag.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {tagCounts[tag.id] ?? 0} 篇
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingTag(tag);
                              setNewName(tag.name);
                              setNewColor(tag.color);
                            }}
                            aria-label="编辑"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(tag.id)}
                            aria-label="删除"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 选中标签的笔记列表 */}
          {activeTag && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Card className="border-border/50">
                <CardHeader className="pb-2 flex-row flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: activeTag.color }}
                    />
                    #{activeTag.name}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      共 {activeTagNotes.length} 篇
                    </span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTagId(null)}
                  >
                    <X className="size-3.5 mr-1" />
                    关闭
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {activeTagNotes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <FileText className="size-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {note.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {note.excerpt}
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeTagNotes.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        该标签下暂无笔记
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* 新建标签对话框 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签名称</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入标签名"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">颜色</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`size-8 rounded-full border-2 transition-all ${
                      newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`选择颜色 ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>
              <Check className="size-4 mr-1" />
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑标签对话框 */}
      <Dialog open={!!editingTag} onOpenChange={(o) => !o && setEditingTag(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签名称</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">颜色</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`size-8 rounded-full border-2 transition-all ${
                      newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合并标签对话框 */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>合并标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">合并源（将被删除）</label>
              <Select value={mergeFrom} onValueChange={setMergeFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要合并的标签" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-center text-muted-foreground">→ 合并到 →</div>
            <div className="space-y-2">
              <label className="text-sm font-medium">目标标签</label>
              <Select value={mergeTo} onValueChange={setMergeTo}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标标签" />
                </SelectTrigger>
                <SelectContent>
                  {tags
                    .filter((t) => t.id !== mergeFrom)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              合并后，源标签的所有笔记将被转移到目标标签，源标签将被删除。此操作不可撤销。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleMerge}>
              <Merge className="size-4 mr-1" />
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
