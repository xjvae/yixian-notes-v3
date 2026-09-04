import { useMemo, useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Copy,
  Trash2,
  FileText,
  ImageIcon,
  Link2,
  Pin,
  PinOff,
  Eraser,
  ScanText,
  ImagePlus,
  Keyboard,
  Loader2,
  Info,
  FilePlus2,
  Maximize2,
  AlignLeft,
  Download,
  CheckCircle2,
  MoreVertical,
  StickyNote,
  ListTodo,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { IClipboardItem, INote } from '@/data/notes';
import { processText } from '@/lib/ai';
import { plainTextToExcerpt } from '@/lib/text';
import { downloadContent } from '@/lib/noteExport';
import type { CaptureActions } from '@/components/actions/CaptureActionMenu';
import {
  readClipboardImagePng,
  readTextFromClipboard,
  ocrClipboardImage,
  pinClipboardImage,
  pinClipboardText,
  registerClipboardShortcut,
  startClipboardListener,
  isClipboardListening,
} from '@/lib/clipboard';
import { listen } from '@tauri-apps/api/event';
import { SearchInput } from '@/components/shared';
import EmptyState from '@/components/EmptyState';

interface WorkspaceContext extends CaptureActions {
  clipboard: IClipboardItem[];
  clipboardPin: (id: string) => void;
  importNotes: (notes: INote[]) => number;
  clipboardAdd: (content: string) => void;
  clipboardDelete: (id: string) => void;
  clipboardClear: () => void;
  clipboardIncrement: (id: string) => void;
}

type TabType = 'all' | 'text' | 'image' | 'link';

// 时间范围筛选
type RangeType = 'all' | '7d' | '30d' | '90d';
const RANGE_MS: Record<Exclude<RangeType, 'all'>, number> = {
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
  '90d': 90 * 24 * 3600 * 1000,
};
const RangeConfig: Record<RangeType, string> = {
  all: '全部时间',
  '7d': '近 7 天',
  '30d': '近 30 天',
  '90d': '近 90 天',
};

const typeConfig = {
  text: { icon: FileText, label: '文本', color: 'text-blue-500', bg: 'bg-blue-50' },
  image: { icon: ImageIcon, label: '图片', color: 'text-rose-500', bg: 'bg-rose-50' },
  link: { icon: Link2, label: '链接', color: 'text-emerald-500', bg: 'bg-emerald-50' },
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return format(new Date(ts), 'M月d日', { locale: zhCN });
}

export default function ClipboardPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { clipboard, clipboardPin, clipboardDelete, clipboardClear, importNotes, clipboardAdd, clipboardIncrement } = context;
  const [tab, setTab] = useState<TabType>('all');
  const [keyword, setKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 来源应用筛选
  const [dateRange, setDateRange] = useState<RangeType>('all'); // 时间范围筛选
  // 批量选择
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<IClipboardItem | null>(null);

  // 进阶能力状态
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [shortcutTarget, setShortcutTarget] = useState<IClipboardItem | null>(null);
  const [shortcutStr, setShortcutStr] = useState('');
  const [shortcutSaving, setShortcutSaving] = useState(false);

  // 监听开关状态：已开启时按钮置灰为「监听已开启」，提示条隐藏「立即开启」
  const [listening, setListening] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isClipboardListening().then((on) => { if (!cancelled) setListening(on); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 监听后端剪贴板变化事件 `yx-clipboard-changed`：变化时读取系统剪贴板文本，
  // 写入剪贴板历史，让「开启监听」真正生效。仅在 Tauri 环境可用。
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<string>('yx-clipboard-changed', () => {
      if (cancelled) return;
      readTextFromClipboard()
        .then((text) => {
          if (text) { clipboardAdd(text); }
        })
        .catch(() => { /* 读取失败忽略 */ });
    })
      .then((fn) => {
        if (cancelled) fn(); else unlisten = fn;
      })
      .catch(() => { /* 事件系统不可用则静默降级 */ });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // 可用的来源应用列表（用于筛选下拉）
  const sourceApps = useMemo(
    () => Array.from(new Set(clipboard.map((c) => c.sourceApp).filter(Boolean))).slice(0, 8),
    [clipboard],
  );

  const filtered = useMemo(() => {
    let list = [...clipboard];
    if (tab !== 'all') {
      list = list.filter((c) => c.type === tab);
    }
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      list = list.filter(
        (c) =>
          c.content.toLowerCase().includes(kw) ||
          c.preview.toLowerCase().includes(kw) ||
          c.sourceApp.toLowerCase().includes(kw),
      );
    }
    if (sourceFilter !== 'all') {
      list = list.filter((c) => c.sourceApp === sourceFilter);
    }
    if (dateRange !== 'all') {
      const cutoff = Date.now() - RANGE_MS[dateRange];
      list = list.filter((c) => c.createdAt >= cutoff);
    }
    // 置顶的排在前面
    return list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [clipboard, tab, keyword, sourceFilter, dateRange]);

  const pinnedCount = clipboard.filter((c) => c.isPinned).length;

  // 统计概览
  const stats = useMemo(() => {
    const text = clipboard.filter((c) => c.type === 'text').length;
    const image = clipboard.filter((c) => c.type === 'image').length;
    const link = clipboard.filter((c) => c.type === 'link').length;
    const pinned = clipboard.filter((c) => c.isPinned).length;
    return { text, image, link, pinned };
  }, [clipboard]);
  const statCards = [
    { label: '文本', value: stats.text, color: 'text-blue-500', bg: 'bg-blue-500/10', icon: FileText },
    { label: '图片', value: stats.image, color: 'text-rose-500', bg: 'bg-rose-500/10', icon: ImageIcon },
    { label: '链接', value: stats.link, color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Link2 },
    { label: '置顶', value: stats.pinned, color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Pin },
  ];

  const selectedCount = selected.size;
  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  /** 一键转笔记：把文本/链接内容转为真实新笔记（带 AI 摘要/标签） */
  const toNoteFromItem = (item: IClipboardItem) => {
    const text = item.type === 'text' || item.type === 'link' ? item.content : item.preview || '';
    const noteId = 'cl-note-' + Date.now();
    const autoTags = text
      ? String(processText(text, 'tags')).split(/[，,、\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 4)
      : [];
    const aiExcerpt = text ? processText(text.slice(0, 120), 'summary').trim() : '';
    importNotes([
      {
        id: noteId,
        title: item.preview.slice(0, 40) || '剪贴板',
        content: `<p>${text}</p>`,
        excerpt: aiExcerpt || plainTextToExcerpt(text, 80),
        notebookId: 'nb1',
        tags: autoTags,
        isFavorite: false,
        isDeleted: false,
        isPinned: false,
        sortOrder: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    toast.success('已转为笔记');
  };

  const handleCopy = (content: string, id?: string) => {
    navigator.clipboard?.writeText(content).catch(() => {});
    if (id) clipboardIncrement(id);
    toast.success('已复制到剪贴板');
  };

  /** 文本清稿：折叠多余换行/空白，规整为可读段落 */
  const cleanText = (raw: string) => {
    const lines = raw.replace(/\u00a0/g, ' ').split(/\r?\n/);
    const cleaned = lines
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter((l) => l.length > 0);
    return cleaned.join('\n');
  };

  /** 一键清稿：规整后复制 */
  const handleClean = (item: IClipboardItem) => {
    const cleaned = cleanText(item.content);
    if (!cleaned) {
      toast.error('没有可清理的文本内容');
      return;
    }
    navigator.clipboard?.writeText(cleaned).catch(() => {});
    toast.success('已清稿并复制');
  };

  /** 批量导出为纯文本（浏览器下载；Tauri 内同样可用） */
  const exportSelected = () => {
    const ids = Array.from(selected);
    const items = clipboard.filter((c) => ids.includes(c.id));
    const lines = items
      .map((c) => `【${new Date(c.createdAt).toLocaleString()}】 ${c.sourceApp}${c.isPinned ? ' [置顶]' : ''}\n${c.content}`)
      .join('\n\n------------------------------\n\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadContent(lines || '（空）', `剪贴板导出_${stamp}.txt`, 'text/plain;charset=utf-8');
    clearSelection();
    toast.success(`已导出 ${items.length} 条记录`);
  };

  /** 从系统剪贴板读取当前图片 */
  const readCurrentClipboardImage = async (): Promise<string> => {
    const data = await readClipboardImagePng();
    if (!data) {
      toast.error('当前剪贴板中没有图片，请先截图或复制一张图片');
      return '';
    }
    return data;
  };

  /** OCR：读取当前剪贴板图片并识别文本 */
  const handleOcr = async () => {
    setOcrLoading(true);
    try {
      const data = await readCurrentClipboardImage();
      if (!data) return;
      setOcrResult('正在识别...');
      const text = await ocrClipboardImage(data);
      if (!text) {
        setOcrResult('');
        toast.info('未识别到文字（图片中可能没有可识别的文本）');
        setOcrOpen(false);
        return;
      }
      setOcrResult(text);
      setOcrOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OCR 识别失败');
    } finally {
      setOcrLoading(false);
    }
  };

  /** 贴图：把当前剪贴板图片钉到桌面浮动窗口 */
  const handlePinCurrentImage = async () => {
    try {
      const data = await readCurrentClipboardImage();
      if (!data) return;
      const id = `pin-${Date.now()}`;
      await pinClipboardImage({
        id,
        imageData: data,
        x: 120,
        y: 120,
        w: 360,
        h: 280,
      });
      toast.success('已贴图到桌面');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '贴图失败');
    }
  };

  /** 单条置置项贴图（文本/链接贴成文本窗口，图片贴当前图片） */
  const handlePinItem = async (item: IClipboardItem) => {
    try {
      if (item.type === 'image') {
        await handlePinCurrentImage();
      } else {
        await pinClipboardText({
          id: `pin-${Date.now()}`,
          text: item.content,
          x: 120,
          y: 120,
          w: 320,
          h: 200,
        });
        toast.success('已贴到桌面');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '贴图失败');
    }
  };

  /** 打开快捷键绑定弹窗 */
  const openShortcutDialog = (item: IClipboardItem) => {
    setShortcutTarget(item);
    setShortcutStr('');
    setShortcutSaving(false);
  };

  /** 保存全局快捷键 */
  const handleSaveShortcut = async () => {
    if (!shortcutTarget) return;
    const s = shortcutStr.trim();
    if (!s) {
      toast.error('请输入快捷键，例如 Ctrl+Shift+1');
      return;
    }
    setShortcutSaving(true);
    try {
      await registerClipboardShortcut(shortcutTarget.id, s);
      toast.success(`已绑定全局快捷键 ${s}`);
      setShortcutTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '绑定失败');
    } finally {
      setShortcutSaving(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              剪贴板历史
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {clipboard.length} 条记录 · {pinnedCount} 条置顶
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={listening}
              onClick={() => {
                startClipboardListener().then(() => setListening(true)).catch(() => {});
                toast.success('已开启剪贴板监听（在系统中复制内容将自动更新）');
              }}
              title={listening ? '剪贴板监听已开启' : '启动后端事件监听'}
            >
              {listening ? (
                <CheckCircle2 className="size-3.5 mr-1 text-green-500" />
              ) : (
                <ClipboardList className="size-3.5 mr-1" />
              )}
              {listening ? '监听已开启' : '开启监听'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleOcr}
              disabled={ocrLoading}
            >
              {ocrLoading ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <ScanText className="size-3.5 mr-1" />
              )}
              OCR识别
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handlePinCurrentImage}
            >
              <ImagePlus className="size-3.5 mr-1" />
              贴图到桌面
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                clipboardClear();
                toast.success('已清空未置顶记录');
              }}
            >
              <Eraser className="size-3.5 mr-1" />
              一键清空
            </Button>
          </div>
        </motion.div>

        {/* 统计概览卡 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.02 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border/50 bg-card px-3 py-2.5 flex items-center gap-2.5">
                <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                  <Icon className={cn('size-4', s.color)} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-none">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* 系统监听同步提示 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.03 }}
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
            {listening ? (
              <CheckCircle2 className="size-4 text-green-500 shrink-0" />
            ) : (
              <Info className="size-4 text-primary shrink-0" />
            )}
            <span className="flex-1">
              {listening
                ? '剪贴板监听已开启：在系统中复制内容将自动同步到剪贴板历史；置顶的内容不会因「一键清空」被删除。'
                : '点击右上角「开启监听」后，在系统中复制内容将自动同步到剪贴板历史；置顶的内容不会因「一键清空」被删除。'}
            </span>
            {!listening && (
              <button
                type="button"
                className="text-primary hover:underline shrink-0 font-medium"
                onClick={() => {
                  startClipboardListener().then(() => setListening(true)).catch(() => {});
                  toast.success('已开启剪贴板监听');
                }}
              >
                立即开启
              </button>
            )}
          </div>
        </motion.div>

        {/* 搜索 + 筛选 + Tab */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="space-y-3"
        >
          <div className="relative">
            <SearchInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索剪贴板内容..."
              className="h-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                <TabsTrigger value="text" className="text-xs">文本</TabsTrigger>
                <TabsTrigger value="image" className="text-xs">图片</TabsTrigger>
                <TabsTrigger value="link" className="text-xs">链接</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {sourceApps.length > 0 && (
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  title="按来源应用筛选"
                >
                  <option value="all">全部来源</option>
                  {sourceApps.map((app) => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              )}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as RangeType)}
                className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                title="按时间范围筛选"
              >
                {(Object.keys(RangeConfig) as RangeType[]).map((r) => (
                  <option key={r} value={r}>{RangeConfig[r]}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* 批量操作栏 */}
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border bg-muted/40 px-3 py-2 flex items-center gap-3 flex-wrap"
          >
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="全选" />
            <span className="text-xs text-muted-foreground">已选 {selectedCount} 条</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 hover:text-destructive"
                onClick={() => {
                  const ids = Array.from(selected);
                  ids.forEach((id) => clipboardDelete(id));
                  clearSelection();
                  toast.success(`已删除 ${ids.length} 条`);
                }}
              >
                <Trash2 className="size-3.5" />
                批量删除
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={exportSelected}
              >
                <Download className="size-3.5 text-primary" />
                导出成 txt
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                取消
              </Button>
            </div>
          </motion.div>
        )}

        {/* 列表 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-2"
        >
          {filtered.length === 0 ? (
            <EmptyState type="clipboard" />
          ) : (
            filtered.map((item, i) => {
              const t = typeConfig[item.type];
              const Icon = t.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.02 }}
                >
                  <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                    <CardContent className="p-3.5 flex items-start gap-3">
                      <div className="pt-1 shrink-0">
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleOne(item.id)}
                          aria-label="选择"
                        />
                      </div>
                      <div
                        className={cn(
                          'size-10 shrink-0 rounded-lg flex items-center justify-center',
                          t.bg,
                        )}
                      >
                        <Icon className={cn('size-5', t.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 类型 + 来源 + 时间：弱化装饰，时间右对齐 */}
                        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                          <span className={cn('text-xs font-medium shrink-0', t.color)}>
                            {t.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground/80 truncate">
                            来自 {item.sourceApp}
                          </span>
                          <span className="text-[11px] text-muted-foreground/70 ml-auto shrink-0 pl-2">
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>

                        {/* 内容 / 图片预览 */}
                        {item.type === 'image' ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item)}
                            className="w-full h-20 bg-muted/50 rounded-md flex items-center justify-center text-xs text-muted-foreground mt-2 hover:bg-muted transition-colors cursor-pointer group/img"
                          >
                            <ImageIcon className="size-5 mr-2 text-muted-foreground/50" />
                            <span className="truncate max-w-[70%]">{item.preview}</span>
                            <Maximize2 className="size-3.5 ml-2 text-muted-foreground opacity-0 group-hover/img:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <p
                            className={cn(
                              'text-[13px] leading-relaxed mt-1.5 break-words',
                              item.type === 'link'
                                ? 'text-primary underline decoration-dotted'
                                : 'text-foreground',
                            )}
                          >
                            {item.type === 'text'
                              ? item.content.length > 300
                                ? item.content.slice(0, 300) + '...'
                                : item.content
                              : item.preview}
                          </p>
                        )}

                        {/* 复制次数 + 置顶：作为底部弱信息 */}
                        {(item.copyCount !== undefined && item.copyCount > 0 || item.isPinned) && (
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/75">
                            {item.copyCount !== undefined && item.copyCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Copy className="size-3" /> 已复制 {item.copyCount} 次
                              </span>
                            )}
                            {item.isPinned && (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <Pin className="size-3" /> 置顶
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 右侧操作：常用快捷 + 更多 */}
                      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(item.content, item.id)}
                          title="复制"
                        >
                          <Copy className="size-4" />
                        </Button>
                        {item.type !== 'image' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => toNoteFromItem(item)}
                            title="一键转笔记"
                          >
                            <FilePlus2 className="size-4 text-primary" />
                          </Button>
                        )}
                        {item.type === 'text' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleClean(item)}
                            title="一键清稿（折叠多余空白并复制）"
                          >
                            <AlignLeft className="size-4 text-violet-500" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                context.newNote({ notebookId: undefined });
                                toast.success('已转为笔记');
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <StickyNote className="size-4 text-primary" /> 转为笔记
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const title = (item.preview || '速记').slice(0, 40);
                                const body = item.type === 'text' ? item.content : item.preview;
                                context.todoCreate({ title, description: body.slice(0, 500), priority: 'medium' });
                                toast.success('已生成待办');
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <ListTodo className="size-4 text-emerald-500" /> 转为待办
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                context.addFlashcard({
                                  deck: '速记',
                                  front: (item.preview || '速记').slice(0, 40),
                                  back: item.type === 'text' ? item.content : item.preview,
                                  tags: ['速记'],
                                  dueDate: new Date().toISOString(),
                                  status: 'new',
                                });
                                toast.success('已转为闪卡');
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <Layers className="size-4 text-indigo-500" /> 转为闪卡
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handlePinItem(item)}
                              className="gap-2 cursor-pointer"
                            >
                              <ImagePlus className="size-4" /> 贴图到桌面
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openShortcutDialog(item)}
                              className="gap-2 cursor-pointer"
                            >
                              <Keyboard className="size-4" /> 绑定全局快捷键
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => clipboardPin(item.id)}
                              className={cn('gap-2 cursor-pointer', item.isPinned && 'text-amber-500')}
                            >
                              {item.isPinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                              {item.isPinned ? '取消置顶' : '置顶'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                clipboardDelete(item.id);
                                toast.success('已删除');
                              }}
                              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4" /> 删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* OCR 结果弹窗 */}
      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>OCR 识别结果</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap text-foreground">
            {ocrResult || '识别中...'}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(ocrResult).catch(() => {});
                toast.success('识别文本已复制');
              }}
            >
              <Copy className="size-3.5 mr-1" />
              复制结果
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                关闭
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 全局快捷键绑定弹窗 */}
      <Dialog
        open={!!shortcutTarget}
        onOpenChange={(open) => !open && setShortcutTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>绑定全局快捷键</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              为「{shortcutTarget?.preview?.slice(0, 30)}」设置快捷键，如{' '}
              <code className="rounded bg-muted px-1">Ctrl+Shift+1</code>。触发后后端会 emit{' '}
              <code className="rounded bg-muted px-1">yx-clipboard-shortcut</code> 事件。
            </p>
            <Input
              value={shortcutStr}
              onChange={(e) => setShortcutStr(e.target.value)}
              placeholder="例如 Ctrl+Shift+1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleSaveShortcut} disabled={shortcutSaving}>
              {shortcutSaving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              绑定
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                取消
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片大图预览 */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center rounded-md border bg-muted/40 p-3 min-h-[200px]">
            <div className="text-center text-sm text-muted-foreground">
              <ImageIcon className="size-16 text-muted-foreground/40 mx-auto mb-3" />
              {previewImage?.preview || '（图片内容）'}
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => previewImage && handleCopy(previewImage.content, previewImage.id)}
            >
              <Copy className="size-3.5 mr-1" />
              复制图片标识
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">关闭</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}