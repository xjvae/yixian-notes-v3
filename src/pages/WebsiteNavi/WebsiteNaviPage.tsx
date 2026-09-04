import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  Copy,
  ShieldCheck,
  X,
  Landmark,
  Lock,
  KeyRound,
  Download,
  Upload,
  Tag,
  PencilRuler,
  Star,
  LayoutGrid,
  List,
  GripVertical,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useWebsites } from '@/hooks/useWebsites';
import type { IWebsite } from '@/data/notes';
import { cn } from '@/lib/utils';

// 打开外部网址：Tauri 环境走 shell，否则 window.open
function openExternal(url: string) {
  if (!url) return;
  if ((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    import('@tauri-apps/plugin-shell')
      .then(({ open }) => open(url))
      .catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// 补齐协议前缀
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0];
  }
}

// 自动获取站点图标：优先用户自定义图标，其次根目录 favicon，再退化为域名下常见 favicon 路径。
// 不依赖 Google s2 这类国内不可达的服务。
function getFaviconCandidates(item: IWebsite): string[] {
  if (item.icon) return [item.icon];
  const domain = getDomain(item.url);
  if (!domain) return [];
  return [`https://${domain}/favicon.ico`];
}
function getFavicon(item: IWebsite): string {
  return getFaviconCandidates(item)[0] || '';
}

// 根据域名生成稳定的配色（用于图标底色，避免每次都随机变色）
const TILE_PALETTE = [
  { bg: 'bg-primary/12', text: 'text-primary' },
  { bg: 'bg-info/10', text: 'text-info' },
  { bg: 'bg-warning/12', text: 'text-warning' },
  { bg: 'bg-[hsl(340_45%_60%/0.12)]', text: 'text-[hsl(340_50%_55%)]' },
  { bg: 'bg-[hsl(264_35%_56%/0.12)]', text: 'text-[hsl(264_35%_55%)]' },
  { bg: 'bg-[hsl(185_45%_45%/0.12)]', text: 'text-[hsl(185_45%_42%)]' },
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function tileColor(key: string) {
  return TILE_PALETTE[hashStr(key) % TILE_PALETTE.length];
}

// 本地持久化的偏好 key
const PREF_KEY = 'yixian_websites_ui';
type Prefs = { view: 'grid' | 'list'; sort: 'freq' | 'recent' | 'name' | 'custom' };
// useWebsites 暴露的站点类型：额外附带密码状态标记
type WebsiteView = IWebsite & { hasPassword?: boolean; isEncrypted?: boolean };

interface FormState {
  name: string;
  url: string;
  category: string;
  username: string;
  password: string;
  note: string;
  icon: string;
}

const emptyForm: FormState = {
  name: '',
  url: '',
  category: '',
  username: '',
  password: '',
  note: '',
  icon: '',
};

// ---- 卡片子组件 ----
interface CardProps {
  item: WebsiteView;
  isRevealed: boolean;
  faviconFailed: boolean;
  onJump: () => void;
  onCopy: (text: string, label?: string) => void;
  onEdit: (item: WebsiteView) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onTogglePassword: () => void;
  onEncrypt: () => void;
  onMarkFailed: () => void;
  /** 是否开启拖拽排序（手动排序模式下） */
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}

/** 站点图标：优先 favicon，失败或缺失回退到带品牌色底的首字母 */
function SiteIcon({ item, faviconFailed, onMarkFailed }: { item: IWebsite; faviconFailed: boolean; onMarkFailed: () => void }) {
  const color = tileColor(getDomain(item.url) || item.name);
  const fallback = (
    <span className={cn('text-base font-bold', color.text)}>
      {(item.name || getDomain(item.url) || '?').charAt(0).toUpperCase()}
    </span>
  );
  return (
    <div className={cn('size-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden', color.bg)}>
      {faviconFailed || !getFavicon(item) ? (
        fallback
      ) : (
        <img
          src={getFavicon(item)}
          alt=""
          className="size-6"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            onMarkFailed();
          }}
        />
      )}
    </div>
  );
}

/** 收藏星标按钮 */
function FavoriteButton({ active, onClick }: { active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={active ? '取消收藏' : '收藏置顶'}
      className={cn(
        'rounded-md p-1 transition-colors',
        active
          ? 'text-warning hover:text-warning/80'
          : 'text-muted-foreground/40 hover:text-warning hover:bg-warning/10 opacity-0 group-hover:opacity-100',
      )}
    >
      <Star className={cn('size-4', active && 'fill-current')} />
    </button>
  );
}

/** 展开的账号 / 密码详情 */
function CredentialRows({ item, isRevealed, onCopy }: { item: IWebsite; isRevealed: boolean; onCopy: (t: string, l?: string) => void }) {
  return (
    <div className="space-y-2 text-xs">
      {item.username && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-12 shrink-0">账号</span>
          <span className="flex-1 truncate">{item.username}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onCopy(item.username!, '账号已复制')} title="复制账号">
            <Copy className="size-3.5" />
          </Button>
        </div>
      )}
      {item.password && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-12 shrink-0">密码</span>
          <span className="flex-1 truncate font-mono">{isRevealed ? item.password : '••••••••'}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onCopy(item.password!, '密码已复制')} title="复制密码">
            <Copy className="size-3.5" />
          </Button>
        </div>
      )}
      {item.note && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-12 shrink-0">备注</span>
          <span className="flex-1 truncate whitespace-pre-wrap leading-relaxed">{item.note}</span>
        </div>
      )}
    </div>
  );
}

/** 网格卡片（开始页风格） */
function WebsiteGridCard(props: CardProps) {
  const { item, isRevealed } = props;
  const domain = getDomain(item.url);
  return (
    <Card
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop?.();
      }}
      className={cn(
        'group border-border/50 hover:border-primary/30 transition-all cursor-pointer h-full',
        props.draggable && 'cursor-grab active:cursor-grabbing',
        props.isDragging && 'opacity-50 border-primary/50',
        props.isDragOver && 'border-primary ring-2 ring-primary/20 scale-[1.02]',
        !props.isDragging && !props.isDragOver && 'hover:shadow-md',
      )}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && props.onJump()}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {props.draggable && (
              <GripVertical className="size-4 text-muted-foreground/50 shrink-0 mt-1" />
            )}
            <SiteIcon item={item} faviconFailed={props.faviconFailed} onMarkFailed={props.onMarkFailed} />
          </div>
          <div className="flex items-center gap-0.5">
            <FavoriteButton active={item.favorite} onClick={props.onToggleFavorite} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{item.name}</span>
            {item.favorite && <Star className="size-3 text-warning fill-current shrink-0" />}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={item.url}>
            {domain}
          </p>
        </div>

        {/* 状态标签 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.category}</span>
          )}
          {item.hasPassword && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full',
                item.isEncrypted ? 'bg-amber-50 text-amber-600' : 'bg-orange-100 text-orange-600',
              )}
              title={item.isEncrypted ? '密码已加密保存' : '密码尚未加密'}
            >
              <ShieldCheck className="size-2.5" />
              {item.isEncrypted ? '已加密' : '未加密'}
            </span>
          )}
          {!!item.visitCount && (
            <span className="text-[10px] text-muted-foreground/60" title={`已访问 ${item.visitCount} 次`}>
              {item.visitCount} 次
            </span>
          )}
        </div>

        {(isRevealed || item.username || item.note) && (
          <div className="border-t border-border/40 pt-3 mt-auto" onClick={(e) => e.stopPropagation()}>
            <CredentialRows item={item} isRevealed={isRevealed} onCopy={props.onCopy} />
          </div>
        )}

        {/* 悬浮操作 */}
        <div
          className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="size-8" onClick={() => props.onCopy(item.url, '网址已复制')} title="复制网址">
            <Copy className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => props.onEdit(item)} title="编辑">
            <Pencil className="size-4" />
          </Button>
          {item.hasPassword && !item.isEncrypted && (
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" onClick={props.onEncrypt} title="加密保存密码">
              <Lock className="size-4" />
            </Button>
          )}
          {item.hasPassword && (
            <Button variant="ghost" size="icon" className="size-8" onClick={props.onTogglePassword} title={isRevealed ? '隐藏密码' : '显示密码'}>
              {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={props.onDelete} title="删除">
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** 列表行（紧凑、信息更多） */
function WebsiteRow(props: CardProps) {
  const { item, isRevealed } = props;
  return (
    <Card
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop?.();
      }}
      className={cn(
        'border-border/50 hover:border-primary/30 transition-all group cursor-pointer',
        props.draggable && 'cursor-grab active:cursor-grabbing',
        props.isDragging && 'opacity-50 border-primary/50',
        props.isDragOver && 'border-primary ring-2 ring-primary/20',
        !props.isDragging && !props.isDragOver && 'hover:shadow-sm',
      )}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && props.onJump()}
      title={`前往 ${item.name}`}
    >
      <CardContent className="p-3.5 flex items-start gap-3">
        {props.draggable && (
          <GripVertical className="size-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        )}
        <SiteIcon item={item} faviconFailed={props.faviconFailed} onMarkFailed={props.onMarkFailed} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.name}</span>
            <FavoriteButton active={item.favorite} onClick={props.onToggleFavorite} />
            {item.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                {item.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
            <span className="truncate">{getDomain(item.url)}</span>
            {item.hasPassword && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded shrink-0',
                  item.isEncrypted ? 'bg-amber-50 text-amber-600' : 'bg-orange-100 text-orange-600',
                )}
                title={item.isEncrypted ? '密码已加密保存' : '密码尚未加密，点🔒可加密'}
              >
                <ShieldCheck className="size-2.5" />
                {item.isEncrypted ? '已加密' : '未加密'}
              </span>
            )}
            {!!item.visitCount && (
              <span className="text-[10px] text-muted-foreground/60 shrink-0" title={`已访问 ${item.visitCount} 次`}>
                {item.visitCount} 次
              </span>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="size-8" onClick={() => props.onCopy(item.url, '网址已复制')} title="复制网址">
            <Copy className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => props.onEdit(item)} title="编辑">
            <Pencil className="size-4" />
          </Button>
          {item.hasPassword && !item.isEncrypted && (
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" onClick={props.onEncrypt} title="加密保存密码">
              <Lock className="size-4" />
            </Button>
          )}
          {item.hasPassword && (
            <Button variant="ghost" size="icon" className="size-8" onClick={props.onTogglePassword} title={isRevealed ? '隐藏密码' : '显示密码'}>
              {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={props.onDelete} title="删除">
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>

      {(isRevealed || item.username || item.note) && (
        <div className="border-t border-border/40 px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <CredentialRows item={item} isRevealed={isRevealed} onCopy={props.onCopy} />
        </div>
      )}
    </Card>
  );
}

export default function WebsiteNaviPage() {
  const {
    websites,
    unlocked,
    isInitialized,
    setupMaster,
    unlock,
    lock,
    decryptPassword,
    encryptPassword,
    addWebsite,
    updateWebsite,
    removeWebsite,
    incrementVisit,
    toggleFavorite,
    reorderWebsites,
    exportBackup,
    importWebsites,
    resetMaster,
  } = useWebsites();

  // UI 偏好（视图 + 排序）落盘
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return {
        view: raw.view === 'list' ? 'list' : 'grid',
        sort: raw.sort || 'freq',
      };
    } catch {
      return { view: 'grid', sort: 'freq' };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [faviconFailed, setFaviconFailed] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState('全部');
  const [deleteTarget, setDeleteTarget] = useState<IWebsite | null>(null);
  const [pendingEncryptId, setPendingEncryptId] = useState<string | null>(null);
  const [showEncryptPrompt, setShowEncryptPrompt] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockPass, setUnlockPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [catManage, setCatManage] = useState<string | null>(null);
  const [catNewName, setCatNewName] = useState('');
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // ---- 拖拽排序（手动模式）----
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const isCustomSort = prefs.sort === 'custom';

  // ---- 导出 / 导入 ----
  const handleExport = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `网址导航备份_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('已导出网址收藏备份');
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      try {
        const mode = websites.length
          ? window.confirm('导入方式：点“确定”合并追加，点“取消”则全量替换现有收藏。')
            ? 'merge'
            : 'replace'
          : 'merge';
        const { added, updated } = await importWebsites(text, mode);
        toast.success(`导入完成：新增 ${added}，更新 ${updated} 条`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '导入失败');
      }
    };
    reader.readAsText(file);
  };

  // ---- 分类管理 ----
  const handleRenameCategory = async () => {
    const oldCat = catManage;
    const newCat = catNewName.trim();
    if (!oldCat || !newCat) return;
    let n = 0;
    for (const w of websites) {
      if ((w.category || '') === oldCat) {
        await updateWebsite(w.id, { category: newCat });
        n++;
      }
    }
    setCatManage(null);
    setCatNewName('');
    toast.success(`已重命名分类「${oldCat}」→「${newCat}」（${n} 条）`);
  };

  const handleDeleteCategory = async () => {
    const oldCat = catManage;
    if (!oldCat) return;
    if (!window.confirm(`删除分类「${oldCat}」？该分类下的网址将变为无分类（内容保留）。`)) return;
    let n = 0;
    for (const w of websites) {
      if ((w.category || '') === oldCat) {
        await updateWebsite(w.id, { category: '' });
        n++;
      }
    }
    setCatManage(null);
    setCatNewName('');
    toast.success(`已删除分类「${oldCat}」（${n} 条移至无分类）`);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    websites.forEach((w) => w.category && set.add(w.category));
    return ['全部', ...Array.from(set).sort()];
  }, [websites]);

  const filtered = useMemo(() => {
    let items = [...websites];
    if (activeCategory !== '全部') {
      items = items.filter((w) => w.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (w) =>
          (w.name || '').toLowerCase().includes(q) ||
          (w.url || '').toLowerCase().includes(q) ||
          (w.category || '').toLowerCase().includes(q) ||
          (w.note || '').toLowerCase().includes(q),
      );
    }
    // 收藏优先，再按所选排序
    const favoriteItems = items.filter((w) => w.favorite);
    const otherItems = items.filter((w) => !w.favorite);
    const sortFn =
      prefs.sort === 'name'
        ? (a: IWebsite, b: IWebsite) => (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN')
        : prefs.sort === 'recent'
          ? (a: IWebsite, b: IWebsite) => (b.updatedAt || 0) - (a.updatedAt || 0)
          : prefs.sort === 'custom'
            ? (a: IWebsite, b: IWebsite) => (a.order ?? 0) - (b.order ?? 0)
            : (a: IWebsite, b: IWebsite) => (b.visitCount || 0) - (a.visitCount || 0);
    return [...favoriteItems.sort(sortFn), ...otherItems.sort(sortFn)];
  }, [websites, searchQuery, activeCategory, prefs.sort]);

  // 拖拽排序：把 draggedId 插入到 overId 的位置（相对当前显示列表重排）
  const handleCardDrop = (overId: string) => {
    if (!isCustomSort || !draggedId || draggedId === overId) return;
    const ids = filtered.map((w) => w.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderWebsites(next);
    setDraggedId(null);
    setDragOverId(null);
  };

  // 生成单个卡片的拖拽属性（仅在手动排序模式启用）
  const dragPropsFor = (id: string) =>
    isCustomSort
      ? {
          draggable: true,
          isDragging: draggedId === id,
          isDragOver: dragOverId === id && draggedId !== id,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
            setDraggedId(id);
          },
          onDragEnd: () => {
            setDraggedId(null);
            setDragOverId(null);
          },
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            if (dragOverId !== id) setDragOverId(id);
          },
          onDragLeave: () => {
            if (dragOverId === id) setDragOverId(null);
          },
          onDrop: () => handleCardDrop(id),
        }
      : {};

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item: IWebsite) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      url: item.url || '',
      category: item.category || '',
      username: item.username || '',
      password: item.password || '',
      note: item.note || '',
      icon: item.icon || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('请填写网站名称');
      return;
    }
    if (!form.url.trim()) {
      toast.error('请填写网站地址');
      return;
    }
    const data = {
      name: form.name.trim(),
      url: normalizeUrl(form.url),
      category: form.category.trim() || undefined,
      username: form.username.trim(),
      password: form.password,
      note: form.note.trim(),
      icon: form.icon.trim(),
    };
    setShowForm(false);
    const pendingEncrypt = data.password && !unlocked;
    if (editingId) {
      await updateWebsite(editingId, data);
      toast.success(`已更新「${data.name}」`);
      if (pendingEncrypt) {
        setPendingEncryptId(editingId);
        setTimeout(() => setShowEncryptPrompt(true), 260);
      }
    } else {
      const created = await addWebsite(data as IWebsite);
      toast.success(`已添加「${data.name}」`);
      if (pendingEncrypt) {
        setPendingEncryptId(created.id);
        setTimeout(() => setShowEncryptPrompt(true), 260);
      }
    }
  };

  const jumpTo = (item: IWebsite) => {
    openExternal(item.url || '');
    incrementVisit(item.id);
  };

  const handleCopy = async (text: string, label = '已复制到剪贴板') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error('复制失败');
    }
  };

  const togglePasswordShow = async (id: string) => {
    if (!unlocked) {
      setShowUnlock(true);
      return;
    }
    if (showPasswords.has(id)) {
      setShowPasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const plain = websites.find((w) => w.id === id)?.password;
    if (plain === undefined || plain === '') {
      await decryptPassword(id);
    }
    setShowPasswords((prev) => new Set(prev).add(id));
  };

  const handleDelete = (item: IWebsite) => {
    setDeleteTarget(item);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeWebsite(deleteTarget.id);
    setShowPasswords((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });
    toast.success(`已删除「${deleteTarget.name}」`);
    setDeleteTarget(null);
  };

  // ---- 主密码解锁 / 设置 ----
  const handleUnlockSubmit = async () => {
    if (!unlockPass.trim()) {
      toast.error('请输入主密码');
      return;
    }
    if (!isInitialized) {
      if (unlockPass.length < 6) {
        toast.error('主密码长度至少 6 位');
        return;
      }
      if (unlockPass !== confirmPass) {
        toast.error('两次输入不一致');
        return;
      }
      const ok = await setupMaster(unlockPass);
      if (ok) toast.success('主密码设置成功');
      else return;
    } else {
      const ok = await unlock(unlockPass);
      if (!ok) {
        toast.error('主密码错误');
        return;
      }
    }
    setShowUnlock(false);
    setUnlockPass('');
    setConfirmPass('');
    if (pendingEncryptId) {
      const id = pendingEncryptId;
      setPendingEncryptId(null);
      const ok = await encryptPassword(id);
      if (ok) toast.success('密码已加密保存');
    }
  };

  const handleEncryptNow = async (id: string) => {
    if (!unlocked) {
      setPendingEncryptId(id);
      setShowEncryptPrompt(true);
      return;
    }
    const ok = await encryptPassword(id);
    if (ok) toast.success('密码已加密保存');
    else toast.error('加密失败，请重试');
  };

  const confirmEncryptPrompt = async (doEncrypt: boolean) => {
    const id = pendingEncryptId;
    if (doEncrypt) {
      if (!id) return;
      if (!unlocked) {
        setShowEncryptPrompt(false);
        setShowUnlock(true);
        return;
      }
      setShowEncryptPrompt(false);
      setPendingEncryptId(null);
      const ok = await encryptPassword(id);
      if (ok) toast.success('密码已加密保存');
      else toast.error('加密失败，请重试');
      return;
    }
    setShowEncryptPrompt(false);
    setPendingEncryptId(null);
  };

  const handleLockClick = () => {
    lock();
    setShowPasswords(new Set());
    toast('已锁定');
  };

  const handleResetMaster = async () => {
    resetMaster();
    setShowPasswords(new Set());
    setShowUnlock(true);
    toast('已清除主密码，下次将重新设置');
  };

  const stats = useMemo(() => {
    const enc = websites.filter((w) => w.hasPassword && w.isEncrypted).length;
    const plainText = websites.filter((w) => w.hasPassword && !w.isEncrypted).length;
    const favs = websites.filter((w) => w.favorite).length;
    return { total: websites.length, enc, plainText, favs, cats: Math.max(0, categories.length - 1) };
  }, [websites, categories.length]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ===== Header / Hero ===== */}
      <div className="shrink-0 border-b border-border/40 bg-gradient-to-b from-primary/[0.06] to-transparent px-6 pt-5 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm ring-1 ring-primary/20">
                <Globe className="size-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight">网址导航</h1>
                <p className="text-xs text-muted-foreground truncate">
                  收藏常用网站与账号密码，一键直达
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unlocked && (
                <Button variant="outline" size="sm" onClick={handleLockClick} title="锁定（隐藏全部密码）">
                  <Lock className="size-3.5 mr-1" />
                  锁定
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} title="导出为 JSON 备份">
                <Download className="size-3.5 mr-1" />
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} title="从 JSON 备份导入">
                <Upload className="size-3.5 mr-1" />
                导入
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-3.5 mr-1" />
                添加网址
              </Button>
            </div>
          </div>

          {/* 统计 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { key: 'total' as const, icon: Globe, label: '收藏网址', value: stats.total, tint: 'text-primary bg-primary/10' },
              { key: 'favs' as const, icon: Star, label: '已收藏', value: stats.favs, tint: 'text-warning bg-warning/10' },
              { key: 'enc' as const, icon: ShieldCheck, label: '已加密', value: stats.enc, tint: 'text-info bg-info/10' },
              { key: 'plainText' as const, icon: KeyRound, label: '未加密', value: stats.plainText, tint: 'text-warning bg-warning/10' },
              { key: 'cats' as const, icon: Tag, label: '分类', value: stats.cats, tint: 'text-primary bg-primary/10' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-2 shadow-xs"
                >
                  <div className={cn('size-7 rounded-lg flex items-center justify-center', s.tint)}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold leading-tight">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground leading-none">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Content ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 py-5 space-y-4">
          {/* 工具栏：搜索 + 视图 + 排序 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索网址 / 名称 / 分类 / 备注..."
                className="pl-9 h-10 w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-0.5">
              {(['custom', 'freq', 'recent', 'name'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, sort: key }))}
                  title={key === 'custom' ? '拖拽卡片调整顺序' : ''}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                    prefs.sort === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {key === 'custom' ? '手动' : key === 'freq' ? '常用' : key === 'recent' ? '最新' : '名称'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/60 p-0.5">
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, view: 'grid' }))}
                title="网格视图"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  prefs.view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, view: 'list' }))}
                title="列表视图"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  prefs.view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {/* 分类筛选 */}
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {cat === '全部' ? '全部' : `${cat} (${websites.filter((w) => w.category === cat).length})`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const target = activeCategory !== '全部' ? activeCategory : categories.find((c) => c !== '全部') ?? '';
                  if (!target) return;
                  setCatManage(target);
                  setCatNewName(target);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="管理分类（重命名/删除）"
              >
                <PencilRuler className="size-3" />
                管理
              </button>
            </div>
          )}

          {/* 计数 + 分组提示 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              共 {filtered.length} 个网址
              {filtered.some((w) => w.favorite) && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-warning">
                  <Star className="size-3 fill-current" />
                  收藏置顶
                </span>
              )}
            </p>
          </div>

          {prefs.view === 'list' ? (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filtered.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <WebsiteRow
                      item={item}
                      isRevealed={showPasswords.has(item.id)}
                      faviconFailed={faviconFailed.has(item.id)}
                      onJump={() => jumpTo(item)}
                      onCopy={(t, l) => handleCopy(t, l)}
                      onEdit={() => openEdit(item)}
                      onToggleFavorite={() => toggleFavorite(item.id)}
                      onDelete={() => handleDelete(item)}
                      onTogglePassword={() => togglePasswordShow(item.id)}
                      onEncrypt={() => handleEncryptNow(item.id)}
                      onMarkFailed={() => setFaviconFailed((prev) => new Set(prev).add(item.id))}
                      {...dragPropsFor(item.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence initial={false}>
                {filtered.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                  >
                    <WebsiteGridCard
                      item={item}
                      isRevealed={showPasswords.has(item.id)}
                      faviconFailed={faviconFailed.has(item.id)}
                      onJump={() => jumpTo(item)}
                      onCopy={(t, l) => handleCopy(t, l)}
                      onEdit={() => openEdit(item)}
                      onToggleFavorite={() => toggleFavorite(item.id)}
                      onDelete={() => handleDelete(item)}
                      onTogglePassword={() => togglePasswordShow(item.id)}
                      onEncrypt={() => handleEncryptNow(item.id)}
                      onMarkFailed={() => setFaviconFailed((prev) => new Set(prev).add(item.id))}
                      {...dragPropsFor(item.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* 图标加载失败的兜底视图 */}
          {filtered.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="py-16 text-center">
                <div className="size-16 mx-auto rounded-xl bg-muted/50 flex items-center justify-center mb-4">
                  <Landmark className="size-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {websites.length === 0 ? '还没有网址收藏' : '没有匹配的网址'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {websites.length === 0 ? '点击右上角"添加网址"开始收藏' : '换个关键词试试'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ===== 新增 / 编辑表单 ===== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑网址' : '添加网址'}</DialogTitle>
            <DialogDescription>
              收藏常用网站，可填写网页账号与密码，点击即可跳转。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              <Label>网站名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：GitHub"
              />
            </div>
            <div className="grid gap-2">
              <Label>网站地址 *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="例如：github.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>分类</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="例如：开发 / 工作 / 生活"
              />
            </div>
            <div className="grid gap-2">
              <Label>账号</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="网页登录账号（可选）"
              />
            </div>
            <div className="grid gap-2">
              <Label>密码</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="网页登录密码（可选）"
              />
            </div>
            <div className="grid gap-2">
              <Label>备注</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="补充说明（可选）"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>图标地址</Label>
              <div className="flex gap-2">
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="https://…图标 或 favicon 地址（可选）"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({ ...f, icon: getFavicon({ name: '', url: f.url } as IWebsite) }))
                  }
                  disabled={!form.url.trim()}
                  title="根据网址自动获取站点图标"
                >
                  自动
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>{editingId ? '保存' : '添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 主密码设置 / 解锁 ===== */}
      <Dialog open={showUnlock} onOpenChange={setShowUnlock}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5" />
              {isInitialized ? '解锁网址密码库' : '设置主密码'}
            </DialogTitle>
            <DialogDescription>
              {isInitialized
                ? '输入主密码以加密/查看网页密码，列表本身可直接使用。'
                : '主密码用于加密所有网页密码，请牢记（仅本地保存，不落盘密码）。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                type={showUnlockPass ? 'text' : 'password'}
                placeholder={isInitialized ? '输入主密码' : '设置主密码（至少 6 位）'}
                value={unlockPass}
                onChange={(e) => setUnlockPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                className="pr-9"
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                onClick={() => setShowUnlockPass(!showUnlockPass)}
              >
                {showUnlockPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {!isInitialized && (
              <Input
                type={showUnlockPass ? 'text' : 'password'}
                placeholder="确认主密码"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
              />
            )}
          </div>
          <DialogFooter className="flex items-center justify-between">
            {isInitialized ? (
              <Button variant="ghost" size="sm" onClick={handleResetMaster} className="text-muted-foreground">
                忘记主密码？清除
              </Button>
            ) : (
              <span />
            )}
            <Button disabled={!unlockPass.trim()} onClick={handleUnlockSubmit}>
              {isInitialized ? '解锁' : '设置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 删除确认 ===== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除网址</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.name}」吗？此操作不可撤销。该网址保存的账号与密码将一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 添加后加密确认 ===== */}
      <Dialog open={showEncryptPrompt} onOpenChange={(open) => !open && setShowEncryptPrompt(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>是否加密保存密码？</DialogTitle>
            <DialogDescription>
              该密码当前为明文保存，加密后仅需主密码解锁即可查看，更安全；也可稍后在卡片上点击 🔒 图标再加密。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => confirmEncryptPrompt(false)}>
              暂不加密
            </Button>
            <Button onClick={() => confirmEncryptPrompt(true)}>
              <Lock className="size-3.5 mr-1" />
              加密保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 分类管理 ===== */}
      <Dialog open={!!catManage} onOpenChange={(open) => !open && setCatManage(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>管理分类「{catManage}」</DialogTitle>
            <DialogDescription>重命名该分类，或将此分类下的网址移为无分类。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={catNewName}
              onChange={(e) => setCatNewName(e.target.value)}
              placeholder="输入新分类名"
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handleDeleteCategory} className="text-destructive hover:text-destructive">
                删除分类
              </Button>
              <Button onClick={handleRenameCategory} disabled={!catNewName.trim() || catNewName.trim() === catManage}>
                <Tag className="size-3.5 mr-1" />
                重命名
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}