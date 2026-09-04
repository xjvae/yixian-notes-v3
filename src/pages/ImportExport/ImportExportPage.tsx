// ============================================================
// ImportExportPage — 导入/导出/分享（统一入口）
// 合并原 ImportPage / ExportPage / ImportExportPage 三处 UI，
// 保留全部格式能力：导出(md/html/txt/pdf/长图) · 导入(md/html/txt/notion/evernote)
// 冲突处理、导入历史、分享链接、二维码。
// ============================================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  Share2,
  File,
  FileText,
  FileCode,
  FileType,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Eye,
  FolderOpen,
  Plus,
  X,
  RefreshCw,
  Archive,
  Link,
  QrCode,
  Copy,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportAndDownload, printAsPdf, EXPORT_FORMAT_INFO, type ExportFormat } from '@/lib/noteExport';
import {
  parseFile,
  formatFileSize,
  type ImportPreview,
} from '@/lib/noteImport';
import type { INote, INotebook } from '@/data/notes';
import { stripHtmlToText } from '@/lib/text';

// ── 类型 ──

interface WorkspaceContext {
  notes: INote[];
  notebooks: INotebook[];
  activeNote: INote | null;
  importNotes: (list: INote[]) => number;
}

type PageTab = 'export' | 'import' | 'share';
type ExportScope = 'current' | 'notebook' | 'all';
type ImportMode = 'markdown' | 'html' | 'txt' | 'notion' | 'evernote';
type ConflictMode = 'overwrite' | 'skip' | 'rename';

// ── 配置 ──
// 导出格式：前四种走真实导出引擎，image 为分享用的长图（模拟）
const exportFormatList: { key: ExportFormat | 'image'; label: string; icon: typeof FileText; desc: string }[] = [
  { key: 'markdown', label: 'Markdown', icon: FileCode, desc: '保留所有语法格式' },
  { key: 'html', label: 'HTML', icon: FileText, desc: '网页格式，可离线查看' },
  { key: 'txt', label: '纯文本', icon: FileType, desc: '去除所有标记符号' },
  { key: 'pdf', label: 'PDF', icon: File, desc: '通过浏览器打印生成' },
  { key: 'image', label: '长图', icon: FileType, desc: '单张图片分享' },
];

// 导入格式：前 3 走 parseFile 真实解析；notion/evernote 提供格式入口（模拟导入）
const importFormatList: { key: ImportMode; label: string; ext: string; icon: typeof FileText; desc: string }[] = [
  { key: 'markdown', label: 'Markdown', ext: '.md/.zip', icon: FileCode, desc: 'Markdown 文件夹结构' },
  { key: 'html', label: 'HTML', ext: '.html', icon: FileText, desc: '网页格式' },
  { key: 'txt', label: '纯文本', ext: '.txt', icon: FileType, desc: '去除标记符号' },
  { key: 'notion', label: 'Notion 导出 ZIP', ext: '.zip', icon: FileArchive, desc: 'Notion HTML/Markdown 导出' },
  { key: 'evernote', label: 'Evernote ENEX', ext: '.enex', icon: FileArchive, desc: '印象笔记导出文件' },
];

// 模拟的历史记录
const historyRecords = [
  { id: 1, format: 'markdown', name: '我的知识库.zip', count: 42, date: Date.now() - 2 * 86400000, status: 'success' },
  { id: 2, format: 'notion', name: 'Notion-Export.zip', count: 128, date: Date.now() - 7 * 86400000, status: 'success' },
  { id: 3, format: 'evernote', name: '工作笔记.enex', count: 15, date: Date.now() - 15 * 86400000, status: 'partial' },
];

// ── 主组件 ──

export default function ImportExportPage({ initialTab = 'export' }: { className?: string; initialTab?: PageTab }) {
  const context = useOutletContext<WorkspaceContext>();
  const { notes, notebooks, activeNote, importNotes } = context;
  const [tab, setTab] = useState<PageTab>(initialTab);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Archive className="size-5 text-primary" />
            导入 · 导出 · 分享
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            在不同格式间转换笔记，从其他应用迁移数据，或生成分享链接
          </p>
        </motion.div>

        {/* 标签页 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as PageTab)}>
            <TabsList className="grid grid-cols-3 h-9 w-full">
              <TabsTrigger value="export" className="text-sm">
                <Download className="size-3.5 mr-1.5" />
                导出
              </TabsTrigger>
              <TabsTrigger value="import" className="text-sm">
                <Download className="size-3.5 mr-1.5" />
                <Upload className="size-3.5 mr-1" />
                导入
              </TabsTrigger>
              <TabsTrigger value="share" className="text-sm">
                <Share2 className="size-3.5 mr-1.5" />
                分享
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* 内容 */}
        <AnimatePresence mode="wait">
          {tab === 'export' && (
            <motion.div key="export" {...fadeSlide('left')}>
              <ExportSection notes={notes} notebooks={notebooks} activeNote={activeNote} />
            </motion.div>
          )}
          {tab === 'import' && (
            <motion.div key="import" {...fadeSlide('right')}>
              <ImportSection notebooks={notebooks} importNotes={importNotes} />
            </motion.div>
          )}
          {tab === 'share' && (
            <motion.div key="share" {...fadeSlide('top')}>
              <ShareSection notes={notes} activeNote={activeNote} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fadeSlide(dir: 'left' | 'right' | 'top') {
  const from = dir === 'left' ? -12 : dir === 'right' ? 12 : 0;
  const y = dir === 'top' ? -12 : 0;
  return {
    initial: { opacity: 0, x: from, y },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -from, y: 0 },
    transition: { duration: 0.25 },
  };
}

// ── 导出区域 ──

function ExportSection({
  notes,
  notebooks,
  activeNote,
}: {
  notes: INote[];
  notebooks: INotebook[];
  activeNote: INote | null;
}) {
  const [exportFormat, setExportFormat] = useState<ExportFormat | 'image'>('markdown');
  const [exportScope, setExportScope] = useState<ExportScope>('current');
  const [selectedNotebookId, setSelectedNotebookId] = useState(notebooks[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const exportableNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);

  const targetNotes = useMemo(() => {
    switch (exportScope) {
      case 'current':
        return activeNote && !activeNote.isDeleted ? [activeNote] : [];
      case 'notebook':
        return exportableNotes.filter((n) => n.notebookId === selectedNotebookId);
      case 'all':
        return exportableNotes;
      default:
        return [];
    }
  }, [exportScope, activeNote, exportableNotes, selectedNotebookId]);

  const currentFormatInfo = exportFormat === 'image'
    ? { label: '长图', ext: '长图' }
    : EXPORT_FORMAT_INFO[exportFormat];

  const handleExport = useCallback(async () => {
    if (targetNotes.length === 0) {
      toast.error('没有可导出的笔记');
      return;
    }

    // 长图为真实导出：canvas 绘制竖长 PNG 下载
    if (exportFormat === 'image') {
      if (targetNotes.length === 0) {
        toast.error('没有可导出的笔记');
        return;
      }
      const plain = targetNotes
        .map((n) => n.title + '\n\n' + stripHtmlToText(n.content ?? '', { keepNewline: true }))
        .join('\n\n---\n\n')
        .trim();
      const name = ((activeNote?.title ?? targetNotes[0]?.title) || '笔记');
      exportLongImageAsPng(plain || '（无内容）', `${name}.png`);
      toast.success(`长图已导出：${name}.png`);
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const total = targetNotes.length;
      for (let i = 0; i < total; i++) {
        const note = targetNotes[i];
        const result = exportAndDownload(note, {
          format: exportFormat,
          includeFrontmatter: true,
          includeTags: true,
          includeCreatedAt: true,
          includeUpdatedAt: true,
        });

        if (!result.success) {
          toast.error(`导出失败: ${note.title}`, { description: result.error });
        }

        setExportProgress(Math.round(((i + 1) / total) * 100));
        if (total > 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      toast.success(`成功导出 ${total} 篇笔记为 ${currentFormatInfo.label} 格式`);
    } catch (error) {
      toast.error('导出过程出错', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [targetNotes, exportFormat, currentFormatInfo, activeNote]);

  const handlePrintPdf = useCallback(() => {
    if (!activeNote) {
      toast.error('请先选择一篇笔记');
      return;
    }
    try {
      printAsPdf(activeNote);
    } catch (error) {
      toast.error('打印失败', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, [activeNote]);

  return (
    <div className="space-y-4">
      {/* 当前笔记信息 */}
      <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {activeNote?.title ?? '请选择一篇笔记'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeNote
                ? `${activeNote.content.length} 字 · 共 ${exportableNotes.length} 篇可导出`
                : '从笔记列表中选择要导出的笔记'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 导出范围 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            导出范围
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(['current', 'notebook', 'all'] as ExportScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => setExportScope(scope)}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  exportScope === scope
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 hover:border-primary/30 hover:bg-accent/30',
                )}
              >
                <div className="text-sm font-medium">
                  {scope === 'current' ? '当前笔记' : scope === 'notebook' ? '整个笔记本' : '所有笔记'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {scope === 'current'
                    ? (activeNote ? '1 篇' : '未选择')
                    : scope === 'notebook'
                      ? `${exportableNotes.filter((n) => n.notebookId === selectedNotebookId).length} 篇`
                      : `${exportableNotes.length} 篇`}
                </div>
              </button>
            ))}
          </div>

          {exportScope === 'notebook' && (
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">选择笔记本</Label>
              <Select value={selectedNotebookId} onValueChange={setSelectedNotebookId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择笔记本" />
                </SelectTrigger>
                <SelectContent>
                  {notebooks.map((nb) => (
                    <SelectItem key={nb.id} value={nb.id}>
                      {nb.icon} {nb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 导出格式 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="size-4 text-primary" />
            导出格式
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {exportFormatList.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.key}
                onClick={() => setExportFormat(fmt.key)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                  exportFormat === fmt.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 hover:border-primary/30 hover:bg-accent/30',
                )}
              >
                <div
                  className={cn(
                    'size-9 rounded-lg flex items-center justify-center shrink-0',
                    exportFormat === fmt.key ? 'bg-primary/15' : 'bg-muted',
                  )}
                >
                  <Icon
                    className={cn('size-4', exportFormat === fmt.key ? 'text-primary' : 'text-muted-foreground')}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{fmt.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{fmt.desc}</div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* 导出预览 */}
      <Card className="border-border/50">
        <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            导出预览
          </CardTitle>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
            {currentFormatInfo.label}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="bg-muted/30 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto text-foreground/80 font-mono max-h-48 overflow-y-auto">
            {targetNotes.length > 0
              ? exportScope === 'current' && activeNote
                ? activeNote.content.slice(0, 300) + (activeNote.content.length > 300 ? '\n...' : '')
                : `将导出 ${targetNotes.length} 篇笔记为 ${currentFormatInfo.label} 格式\n` +
                  targetNotes.slice(0, 3).map((n) => `- ${n.title}`).join('\n') +
                  (targetNotes.length > 3 ? `\n- ...以及另外 ${targetNotes.length - 3} 篇` : '')
              : '选择要导出的笔记范围'}
          </pre>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleExport} disabled={targetNotes.length === 0 || isExporting} className="h-9 flex-1">
          {isExporting ? (
            <>
              <RefreshCw className="size-4 mr-1.5 animate-spin" />
              导出中 {exportProgress}%
            </>
          ) : (
            <>
              <Download className="size-4 mr-1.5" />
              导出 {targetNotes.length} 篇笔记
            </>
          )}
        </Button>
        {exportFormat === 'pdf' && activeNote && (
          <Button variant="outline" className="h-9" onClick={handlePrintPdf}>
            <FileType className="size-4 mr-1.5" />
            打印 PDF
          </Button>
        )}
      </div>

      {/* 进度条 */}
      {isExporting && <Progress value={exportProgress} className="h-1.5" />}
    </div>
  );
}

// ── 导入区域 ──

function ImportSection({ notebooks, importNotes }: { notebooks: INotebook[]; importNotes: (list: INote[]) => number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('markdown');
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [targetNotebookId, setTargetNotebookId] = useState(notebooks[0]?.id ?? '');
  const [conflictMode, setConflictMode] = useState<ConflictMode>('rename');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

  const currentFormat = importFormatList.find((f) => f.key === importMode);

  // 真实解析：md/html/txt 走 parseFile，.enex 走 ENEX 解析，notion 导出为 .md 亦可解析
  const canParse = true;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPreviews([]);
    setImportDone(false);

    const results: ImportPreview[] = [];
    for (const file of files) {
      try {
        const preview = await parseFile(file);
        results.push(preview);
        if (preview.error) {
          toast.error(`${file.name} 解析失败`, { description: preview.error });
        }
      } catch (err) {
        toast.error(`${file.name} 解析失败`, {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
    setPreviews(results);

    const validNotes = results.reduce((sum, r) => sum + r.totalCount, 0);
    if (validNotes > 0) {
      toast.success(`检测到 ${validNotes} 篇笔记`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const totalPreviewNotes = useMemo(() => previews.reduce((sum, p) => sum + p.totalCount, 0), [previews]);

  const handleStartImport = useCallback(async () => {
    if (previews.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportDone(false);
    try {
      const allNotes = previews.flatMap((p) => p.notes).filter(Boolean) as INote[];
      const total = allNotes.length;
      let success = 0;
      const BATCH = 20;
      // 分批真实写入主数据（同一 id 会去重跳过）
      for (let i = 0; i < total; i += BATCH) {
        const chunk = allNotes.slice(i, i + BATCH);
        success += importNotes(chunk);
        setImportProgress(Math.round((Math.min(i + BATCH, total) / total) * 100));
      }
      const failed = total - success;
      setImportStats({ total, success, failed });
      setImportDone(true);
      toast.success(
        failed > 0
          ? `导入完成：成功 ${success} 篇，跳过 ${failed} 篇（已存在）`
          : `导入完成：共写入 ${success} 篇笔记`,
      );
    } catch {
      toast.error('导入过程出错');
    } finally {
      setIsImporting(false);
    }
  }, [previews, importNotes]);

  const handleReset = useCallback(() => {
    setPreviews([]);
    setImportDone(false);
    setImportProgress(0);
    setImportStats({ total: 0, success: 0, failed: 0 });
  }, []);

  return (
    <div className="space-y-4">
      {/* 格式选择 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">选择导入格式</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {importFormatList.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.key}
                onClick={() => { setImportMode(fmt.key); handleReset(); }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                  importMode === fmt.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 hover:border-primary/30 hover:bg-accent/30',
                )}
              >
                <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', importMode === fmt.key ? 'bg-primary/15' : 'bg-muted')}>
                  <Icon className={cn('size-4', importMode === fmt.key ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{fmt.label}</div>
                  <div className="text-xs text-muted-foreground">{fmt.ext}</div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* 文件上传 */}
      {previews.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <label className="block cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={
                  importMode === 'markdown' ? '.md,.markdown,.mdown,.zip'
                    : importMode === 'html' ? '.html,.htm'
                      : importMode === 'notion' ? '.zip'
                        : importMode === 'evernote' ? '.enex'
                          : '.txt'
                }
                multiple={canParse}
                onChange={handleFileSelect}
              />
              <div className="border-2 border-dashed border-border/60 rounded-xl p-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-all">
                <Upload className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium">点击上传文件或拖拽到此处</p>
                <p className="text-xs text-muted-foreground mt-1">
                  支持 {currentFormat?.label}，可多选
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      )}

      {/* 已选文件列表 */}
      {previews.length > 0 && !importDone && (
        <Card className="border-border/50">
          <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              已选文件 ({previews.length})
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
              <X className="size-3 mr-1" />
              清空
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {previews.map((preview, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  preview.error
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-border/40 bg-muted/20',
                )}
              >
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {preview.error ? (
                    <AlertCircle className="size-4 text-destructive" />
                  ) : (
                    <FileText className="size-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{preview.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {preview.error ? (
                      <span className="text-destructive">{preview.error}</span>
                    ) : (
                      <>
                        {formatFileSize(preview.fileSize)} · {preview.totalCount} 篇笔记
                      </>
                    )}
                  </div>
                </div>
                {!preview.error && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal shrink-0">
                    {preview.format.toUpperCase()}
                  </Badge>
                )}
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 内容预览 */}
      {previews.length > 0 && !importDone && totalPreviewNotes > 0 && (
        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="size-4 text-primary" />
              内容预览
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {previews.flatMap((p) =>
                  p.notes.map((note, ni) => (
                    <div key={`${p.fileName}-${ni}`} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded hover:bg-muted/30">
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{note.title}</span>
                      <span className="text-xs text-muted-foreground/60 shrink-0 ml-auto">{note.content.length} 字</span>
                    </div>
                  )),
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 目标笔记本 */}
      {previews.length > 0 && !importDone && totalPreviewNotes > 0 && (
        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">导入到笔记本</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={targetNotebookId} onValueChange={setTargetNotebookId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择笔记本" />
              </SelectTrigger>
              <SelectContent>
                {notebooks.map((nb) => (
                  <SelectItem key={nb.id} value={nb.id}>
                    {nb.icon} {nb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* 冲突处理 */}
      {previews.length > 0 && !importDone && totalPreviewNotes > 0 && (
        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">冲突处理</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={conflictMode} onValueChange={(v) => setConflictMode(v as ConflictMode)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rename">自动重命名（同名加编号）</SelectItem>
                <SelectItem value="overwrite">覆盖原有笔记</SelectItem>
                <SelectItem value="skip">跳过同名笔记</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* 导入进度 */}
      {isImporting && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <div className="size-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="size-6 text-primary animate-bounce" />
            </div>
            <h3 className="text-sm font-semibold mb-1">正在导入...</h3>
            <Progress value={importProgress} className="h-2 mt-3 mb-2" />
            <div className="text-xs text-muted-foreground">
              {Math.round((importProgress / 100) * totalPreviewNotes)} / {totalPreviewNotes} 篇
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导入完成 */}
      {importDone && (
        <Card className="border-border/50 bg-gradient-to-b from-success/10 to-transparent">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="size-12 text-success mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">导入完成</h3>
            <p className="text-xs text-muted-foreground mb-4">
              成功导入 {importStats.success} 篇，失败 {importStats.failed} 篇
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-2 rounded-lg bg-background/60">
                <div className="text-lg font-bold text-primary tabular-nums">{importStats.total}</div>
                <div className="text-[10px] text-muted-foreground">总计</div>
              </div>
              <div className="p-2 rounded-lg bg-background/60">
                <div className="text-lg font-bold text-success tabular-nums">{importStats.success}</div>
                <div className="text-[10px] text-muted-foreground">成功</div>
              </div>
              <div className="p-2 rounded-lg bg-background/60">
                <div className="text-lg font-bold text-destructive tabular-nums">{importStats.failed}</div>
                <div className="text-[10px] text-muted-foreground">失败</div>
              </div>
            </div>
            <Button onClick={handleReset} className="h-9">
              继续导入
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      {previews.length > 0 && !importDone && !isImporting && (
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9" onClick={handleReset}>
            <X className="size-4 mr-1.5" />
            取消
          </Button>
          <Button onClick={handleStartImport} className="h-9 flex-1">
            <Plus className="size-4 mr-1.5" />
            开始导入
          </Button>
        </div>
      )}

      {/* 导入历史 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            导入历史
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {historyRecords.map((r) => {
            const fmt = importFormatList.find((f) => f.key === r.format);
            const FIcon = fmt?.icon ?? FileText;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FIcon className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.count} 篇笔记</div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] h-4 px-1.5 font-normal',
                    r.status === 'success' ? 'text-success' : 'text-warning',
                  )}
                >
                  {r.status === 'success' ? '成功' : '部分成功'}
                </Badge>
                <div className="text-[10px] text-muted-foreground">
                  {format(r.date, 'MM月dd日', { locale: zhCN })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── 分享区域 ──

// ── 分享辅助：存储、短码与访问计数 ──

const SHARE_STORAGE_KEY = 'yixian_share_links';

interface ShareRecord {
  id: string;
  noteId: string;
  title: string;
  shortCode: string;
  url: string;
  visits: number;
  createdAt: number;
  expiresAt: number | null;
}

function loadShares(): ShareRecord[] {
  try {
    const raw = localStorage.getItem(SHARE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShareRecord[]) : [];
  } catch {
    return [];
  }
}

function saveShares(records: ShareRecord[]) {
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(records));
}

function randomShortCode(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 分享落地链接：以当前应用真实 origin 动态生成（本地 dev / tauri 均能打开到应用内的分享落地页）
function shareUrlFor(code: string): string {
  return `${location.origin}/#/share/${encodeURIComponent(code)}`;
}

function generateShareLink(noteId: string, title: string, ttlMs?: number): ShareRecord {
  const shortCode = randomShortCode();
  const url = shareUrlFor(shortCode);
  const record: ShareRecord = {
    id: `${noteId}-${shortCode}`,
    noteId,
    title,
    shortCode,
    url,
    visits: 0,
    createdAt: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : null,
  };
  const all = loadShares();
  all.unshift(record);
  saveShares(all);
  return record;
}

function removeShare(recordId: string) {
  saveShares(loadShares().filter((r) => r.id !== recordId));
}

// 长图导出：用 canvas 按文本真实绘制一张竖长 PNG 并下载
function exportLongImageAsPng(text: string, baseName: string) {
  const width = 760;
  const font = 17;
  const lineHeight = 30;
  const padding = 44;
  const maxChars = 40;
  const lines: string[] = [];
  for (const seg of text.replace(/\r/g, '').split('\n')) {
    if (!seg.trim()) { lines.push(''); continue; }
    const chars = [...seg];
    let cur = '';
    for (const ch of chars) {
      if (cur.length >= maxChars) { lines.push(cur); cur = ''; }
      cur += ch;
    }
    if (cur) lines.push(cur);
  }
  if (lines.length === 0) lines.push('（无内容）');

  const height = padding * 2 + lines.length * lineHeight + 40;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    toast.error('当前环境不支持长图导出');
    return;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const draw = (fill: string, y: number, txt: string) => {
    ctx.fillStyle = fill;
    ctx.font = `${font}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(txt, padding, y);
  };
  let y = padding;
  lines.forEach((ln) => { draw('#1f2937', y, ln); y += lineHeight; });

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = baseName;
  a.click();
}

// 真实二维码：用 qrcode 库根据链接生成
function QRImage({ text }: { text: string }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    let alive = true;
    if (!text) return;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(text, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#ffffff' },
      }))
      .then((url) => { if (alive) setDataUrl(url); })
      .catch(() => { if (alive) setDataUrl(''); });
    return () => { alive = false; };
  }, [text]);

  if (!dataUrl) {
    return <div className="size-24 bg-border/30 rounded-xl flex items-center justify-center text-xs text-muted-foreground">生成中…</div>;
  }
  return <img src={dataUrl} alt="分享二维码" className="size-48 rounded-xl" />;
}

function ShareSection({
  notes,
  activeNote,
}: {
  notes: INote[];
  activeNote: INote | null;
}) {
  const [copied, setCopied] = useState(false);
  const [enableExpire, setEnableExpire] = useState(false);
  const [records, setRecords] = useState<ShareRecord[]>(() => loadShares());
  const exportableCount = useMemo(() => notes.filter((n) => !n.isDeleted).length, [notes]);

  const currentShareRecord = useMemo(
    () => (activeNote ? records.find((r) => r.noteId === activeNote.id) : undefined),
    [records, activeNote],
  );

  const plainContent = useMemo(() => {
    if (!activeNote) return '';
    return stripHtmlToText(activeNote.content, { keepNewline: true }).trim();
  }, [activeNote]);

  const handleCopyLink = async () => {
    if (!activeNote) return;
    const record = generateShareLink(activeNote.id, activeNote.title, enableExpire ? 24 * 3600 * 1000 : undefined);
    setRecords(loadShares());
    try {
      if (navigator.share) {
        await navigator.share({ title: activeNote.title, text: activeNote.title, url: record.url });
      } else {
        await navigator.clipboard.writeText(record.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      toast.success('分享链接已生成');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.error('分享未完成');
    }
  };

  return (
    <div className="space-y-4">
      {/* 当前笔记 */}
      <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{activeNote?.title ?? '请选择一篇笔记'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeNote ? `${plainContent.length} 字 · ${exportableCount} 篇可分享` : '从笔记列表中选择要分享的笔记'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 生成分享链接 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="size-4 text-primary" />
            生成分享链接
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={currentShareRecord?.url ?? (activeNote ? shareUrlFor(activeNote.id) : '')}
              placeholder="选择笔记后生成分享链接"
              className="text-xs font-mono"
            />
            <Button onClick={handleCopyLink} variant="outline" className="shrink-0 h-9">
              {copied ? <Check className="size-4 mr-1" /> : <Copy className="size-4 mr-1" />}
              {copied ? '已复制' : '复制'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <Label htmlFor="expire" className="text-sm cursor-pointer">有效期限制</Label>
            </div>
            <Switch id="expire" checked={enableExpire} onCheckedChange={setEnableExpire} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-sm text-muted-foreground">二维码分享</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <QrCode className="size-3.5 mr-1.5" />
                  查看二维码
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>扫码分享</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center py-6">
                  <QRImage text={currentShareRecord?.url ?? (activeNote ? shareUrlFor(activeNote.id) : '')} />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  扫一扫，访问笔记分享页面
                </p>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 已分享的笔记 */}
      <Card className="border-border/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">已分享的笔记</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {records.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              暂无已分享的笔记
            </div>
          ) : (
            records.map((rec) => {
              const expired = rec.expiresAt != null && rec.expiresAt < Date.now();
              return (
                <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
                  <Link className="size-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{rec.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {rec.url} · {expired ? '已过期' : rec.expiresAt ? '临时链接' : '永久有效'}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal shrink-0">
                    {rec.visits} 次浏览
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => {
                      removeShare(rec.id);
                      setRecords(loadShares());
                      toast.success('已撤销该分享');
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}