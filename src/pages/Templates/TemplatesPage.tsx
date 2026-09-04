import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutTemplate,
  Plus,
  Star,
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  Clock,
  Tag,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { ITemplate, INote, INotebook } from '@/data/notes';
import { PageHeader, SearchInput } from '@/components/shared';
import EmptyState from '@/components/EmptyState';

interface WorkspaceContext {
  templates: ITemplate[];
  notes: INote[];
  notebooks: INotebook[];
  templateUpdate: (id: string, updates: Partial<ITemplate>) => void;
  templateCreate: (tpl: Partial<ITemplate>) => void;
  newNote: (opts?: { template?: ITemplate; notebookId?: string }) => INote;
  activeNoteId: string | null;
}

type CategoryTab = 'all' | '日记' | '会议' | '学习' | '项目' | '旅行' | '周报' | '写作' | '效率' | '自定义';

const CATEGORY_ICONS: Record<string, string> = {
  日记: '🌅',
  会议: '💼',
  学习: '📚',
  项目: '🚀',
  旅行: '✈️',
  周报: '📊',
  写作: '💡',
  效率: '✅',
  自定义: '✨',
};

export default function TemplatesPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { templates, templateUpdate, templateCreate, newNote, notebooks } = context;
  const navigate = useNavigate();
  const [category, setCategory] = useState<CategoryTab>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedTpl, setSelectedTpl] = useState<ITemplate | null>(null);
  const [createNotebookId, setCreateNotebookId] = useState<string>('nb1');
  const [sortBy, setSortBy] = useState<'usage' | 'name' | 'recent'>('usage');

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [templates]);

  const filtered = useMemo(() => {
    let list = [...templates];
    if (category !== 'all') {
      if (category === '自定义') list = list.filter((t) => t.isCustom);
      else list = list.filter((t) => t.category === category);
    }
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw),
      );
    }
    if (sortBy === 'usage') {
      list.sort((a, b) => b.usageCount - a.usageCount);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [templates, category, keyword, sortBy]);

  const handleUseTemplate = (tpl: ITemplate) => {
    newNote({ template: tpl, notebookId: createNotebookId });
    navigate('/notes');
    toast.success(`已使用「${tpl.name}」模板创建新笔记`);
    setSelectedTpl(null);
  };

  const handleToggleFav = (tpl: ITemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    templateUpdate(tpl.id, { isFavorite: !tpl.isFavorite });
    toast.success(tpl.isFavorite ? '已取消收藏' : '已收藏模板');
  };

  const handleCreateFromNote = () => {
    const activeNote = context.notes.find((n) => n.id === context.activeNoteId && !n.isDeleted);
    if (!activeNote) {
      toast.info('请先选择一篇笔记作为模板来源');
      return;
    }
    templateCreate({
      name: activeNote.title || '自定义模板',
      description: '从笔记创建',
      category: '自定义',
      preview: '📝',
      content: activeNote.content,
      isCustom: true,
    });
    toast.success(`已将「${activeNote.title}」保存为模板`);
  };

  const handleDuplicate = (tpl: ITemplate) => {
    templateCreate({
      name: `${tpl.name}（副本）`,
      description: tpl.description,
      category: '自定义',
      preview: tpl.preview,
      content: tpl.content,
      isCustom: true,
    });
    toast.success('模板已复制');
  };

  const previewContent = useMemo(() => {
    if (!selectedTpl) return '';
    return selectedTpl.content;
  }, [selectedTpl]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PageHeader
            icon={<LayoutTemplate className="size-5 text-primary" />}
            title="模板库"
            subtitle={`${templates.length} 个模板 · 快速开始你的写作`}
            actions={
              <Button onClick={handleCreateFromNote}>
                <Plus className="size-4 mr-1" />
                从笔记创建模板
              </Button>
            }
          />
        </motion.div>

        {/* 搜索 + 分类 + 排序 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索模板名称或描述..."
              className="h-10 flex-1"
            />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usage">使用最多</SelectItem>
                <SelectItem value="recent">最新创建</SelectItem>
                <SelectItem value="name">名称排序</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryTab)}>
            <TabsList className="h-8 flex-wrap h-auto">
              <TabsTrigger value="all" className="text-xs h-7 px-3">全部</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs h-7 px-3">
                  {CATEGORY_ICONS[cat] && <span className="mr-1">{CATEGORY_ICONS[cat]}</span>}
                  {cat}
                </TabsTrigger>
              ))}
              <TabsTrigger value="自定义" className="text-xs h-7 px-3">
                ✨ 自定义
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* 模板网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((tpl, i) => (
              <motion.div
                key={tpl.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <Card
                  className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all h-full cursor-pointer overflow-hidden group"
                  onClick={() => setSelectedTpl(tpl)}
                >
                  {/* 预览区 */}
                  <div className="h-32 bg-gradient-to-br from-primary/10 via-secondary/20 to-accent/30 relative flex items-center justify-center">
                    <span className="text-4xl drop-shadow-sm">{tpl.preview}</span>
                    <button
                      onClick={(e) => handleToggleFav(tpl, e)}
                      className={cn(
                        'absolute top-2.5 right-2.5 size-7 rounded-full flex items-center justify-center transition-all',
                        tpl.isFavorite
                          ? 'bg-card/90 text-warning'
                          : 'bg-card/60 text-muted-foreground opacity-0 group-hover:opacity-100',
                      )}
                      aria-label={tpl.isFavorite ? '取消收藏' : '收藏模板'}
                    >
                      <Star
                        className={cn('size-3.5', tpl.isFavorite && 'fill-warning')}
                      />
                    </button>
                    {tpl.isCustom && (
                      <Badge className="absolute top-2.5 left-2.5 text-[10px] h-4 px-1.5 font-normal bg-foreground/70">
                        自定义
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm">{tpl.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 h-8">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                        {tpl.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Sparkles className="size-3" />
                        {tpl.usageCount} 次使用
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <EmptyState type="search" extra={<p className="text-xs text-muted-foreground/70 mt-1">试试其他关键词或分类</p>} />
          </motion.div>
        )}
      </div>

      {/* 模板详情弹窗 */}
      <Dialog open={!!selectedTpl} onOpenChange={(o) => !o && setSelectedTpl(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
          {selectedTpl && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-start gap-4">
                  <div className="size-14 shrink-0 rounded-xl bg-gradient-to-br from-primary/15 to-accent/30 flex items-center justify-center text-3xl">
                    {selectedTpl.preview}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg font-bold">{selectedTpl.name}</DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                      {selectedTpl.description}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" />
                        {selectedTpl.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="size-3" />
                        {selectedTpl.usageCount} 次使用
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {format(selectedTpl.createdAt, 'yyyy-MM-dd')}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* 模板内容预览 */}
              <div className="flex-1 overflow-y-auto px-8 py-6 bg-background/50">
                <div className="max-w-none prose prose-sm prose-headings:font-semibold prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-li:text-sm prose-blockquote:text-sm prose-table:text-xs max-w-none">
                  <div
                    className="template-preview-content"
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t border-border/50 flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Label htmlFor="notebook-select" className="text-xs text-muted-foreground shrink-0">
                    保存到：
                  </Label>
                  <Select value={createNotebookId} onValueChange={setCreateNotebookId}>
                    <SelectTrigger id="notebook-select" className="h-9 w-[180px]">
                      <SelectValue placeholder="选择笔记本" />
                    </SelectTrigger>
                    <SelectContent>
                      {notebooks.map((nb) => (
                        <SelectItem key={nb.id} value={nb.id}>
                          <span className="mr-2">{nb.icon}</span>
                          {nb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleDuplicate(selectedTpl);
                    }}
                  >
                    <Copy className="size-3.5 mr-1" />
                    复制模板
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleToggleFav(selectedTpl, e as unknown as React.MouseEvent)}
                  >
                    <Star
                      className={cn(
                        'size-3.5 mr-1',
                        selectedTpl.isFavorite && 'fill-warning text-warning',
                      )}
                    />
                    {selectedTpl.isFavorite ? '取消收藏' : '收藏'}
                  </Button>
                  <Button size="sm" onClick={() => handleUseTemplate(selectedTpl)}>
                    <Check className="size-3.5 mr-1" />
                    使用此模板
                    <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .template-preview-content h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; color: hsl(210 15% 18%); }
        .template-preview-content h2 { font-size: 1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: hsl(210 15% 18%); }
        .template-preview-content h3 { font-size: 0.875rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.375rem; color: hsl(210 15% 18%); }
        .template-preview-content p { font-size: 0.8125rem; line-height: 1.7; margin-bottom: 0.5rem; color: hsl(210 15% 18%); }
        .template-preview-content ul, .template-preview-content ol { font-size: 0.8125rem; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .template-preview-content li { line-height: 1.7; }
        .template-preview-content blockquote { font-size: 0.8125rem; padding: 0.5rem 0.75rem; background: hsl(155 30% 94%); border-left: 3px solid hsl(155 35% 38%); border-radius: 0 0.375rem 0.375rem 0; margin: 0.5rem 0; color: hsl(155 35% 28%); }
        .template-preview-content table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 0.5rem 0; }
        .template-preview-content th, .template-preview-content td { border: 1px solid hsl(210 8% 88%); padding: 0.375rem 0.5rem; text-align: left; }
        .template-preview-content th { background: hsl(40 15% 93%); font-weight: 600; }
        .template-preview-content hr { border: none; border-top: 1px solid hsl(210 8% 88%); margin: 0.75rem 0; }
        .template-preview-content strong { font-weight: 600; }
      `}</style>
    </div>
  );
}
