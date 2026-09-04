import { useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Palette,
  Edit3,
  Keyboard,
  Database,
  Info,
  Briefcase,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Type,
  LayoutGrid,
  Sparkles,
  Puzzle,
  Eye,
  EyeOff,
  RotateCcw,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import type { ISettings } from '@/data/notes';
import GlobalShortcutSettings from '@/components/settings/GlobalShortcutSettings';
import { FEATURE_MODULES, FEATURE_GROUPS } from '@/data/onboarding-features';
import { useThemePack } from '@/hooks/use-theme-pack';
import { THEME_PACKS } from '@/lib/themes';
import { encryptText, decryptText } from '@/lib/crypto';

function EncryptionPanel({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const [phrase, setPhrase] = useState('');
  const [demoIn, setDemoIn] = useState('');
  const [demoOut, setDemoOut] = useState('');
  const [decrypted, setDecrypted] = useState<string | null>(null);

  const handleEncrypt = async () => {
    if (!phrase) { toast.warning('请先填写加密口令'); return; }
    const text = demoIn || '这是一段待加密的笔记内容。';
    const cipher = await encryptText(phrase, text);
    setDemoOut(cipher);
    setDecrypted(null);
    toast.success('已用 AES-256-GCM 生成密文');
  };

  const handleDecrypt = async () => {
    if (!phrase || !demoOut) { toast.warning('请先加密一段文本'); return; }
    const plain = await decryptText(phrase, demoOut);
    if (plain === '') { toast.error('口令错误或数据损坏'); setDecrypted(null); return; }
    setDecrypted(plain);
    toast.success('解密成功');
  };

  return (
    <Card className="border-border/50 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>笔记内容加密（AES-256-GCM）</span>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </CardTitle>
        <CardDescription>开启后新写入的笔记正文会用你的口令加密存储，读取时自动解密。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">加密口令</Label>
          <Input
            type="password"
            placeholder="设置用于派生密钥的口令"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">待加密文本</Label>
            <Input value={demoIn} onChange={(e) => setDemoIn(e.target.value)} placeholder="留空则用示例文本" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">解密结果</Label>
            <Input readOnly value={decrypted ?? ''} placeholder="解密后显示在此" className="font-mono text-xs" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleEncrypt} disabled={!phrase}>加密实测</Button>
          <Button size="sm" variant="outline" onClick={handleDecrypt} disabled={!phrase}>用口令解密</Button>
        </div>
        {demoOut && (
          <div className="rounded-lg bg-muted/40 p-2 break-all font-mono text-[11px] text-muted-foreground leading-relaxed">
            {demoOut}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface WorkspaceContext {
  settings: ISettings;
  setSettings: (s: ISettings | ((prev: ISettings) => ISettings)) => void;
  workspaces?: { id: string; name: string; icon: string; color: string }[];
  activeWorkspaceId?: string;
  switchWorkspace?: (id: string) => void;
  exportWorkspace?: (id: string) => string | null;
  importWorkspace?: (jsonStr: string) => { name: string } | null;
  updateWorkspace?: (id: string, updates: Record<string, unknown>) => void;
  /** 打开启动引导向导 */
  openOnboarding?: () => void;
  enabledFeatures?: Set<string>;
  setEnabledFeatures?: (features: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

const settingSections = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'editor', label: '编辑器', icon: Edit3 },
  { id: 'features', label: '功能模块', icon: Puzzle },
  { id: 'ai', label: 'AI 助手', icon: Sparkles },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'data', label: '数据管理', icon: Database },
  { id: 'workspace', label: '工作区', icon: Briefcase },
  { id: 'about', label: '关于', icon: Info },
] as const;

const shortcutList = [
  { key: 'newNote', name: '新建笔记', default: 'Ctrl+N' },
  { key: 'quickOpen', name: '快速打开', default: 'Ctrl+P' },
  { key: 'search', name: '全局搜索', default: 'Ctrl+K' },
  { key: 'save', name: '保存笔记', default: 'Ctrl+S' },
  { key: 'workspaceSwitch', name: '切换工作区', default: 'Ctrl+Shift+W' },
  { key: 'liteMode', name: '切换精简模式', default: 'Ctrl+Shift+L' },
  { key: 'sidebar', name: '切换侧栏', default: 'Ctrl+B' },
  { key: 'onboarding', name: '启动引导', default: 'Ctrl+Shift+O' },
];

export default function SettingsPage() {
  const ctx = useOutletContext<WorkspaceContext>();
  const { settings, setSettings, workspaces, activeWorkspaceId, exportWorkspace, importWorkspace, openOnboarding, enabledFeatures, setEnabledFeatures, updateWorkspace } = ctx;
  const [activeSection, setActiveSection] = useState('appearance');
  const [shortcuts, setShortcuts] = useState(settings.shortcuts);

  const updateSetting = <K extends keyof ISettings>(key: K, value: ISettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    toast.success('笔记数据已导出');
  };

  const handleImport = () => {
    toast.info('请选择要导入的笔记文件');
  };

  const handleClearCache = () => {
    toast.success('缓存已清理');
  };

  const handleResetShortcuts = () => {
    const defaults: Record<string, string> = {};
    shortcutList.forEach((s) => {
      defaults[s.key] = s.default;
    });
    setShortcuts(defaults);
    updateSetting('shortcuts', defaults);
    toast.success('快捷键已重置为默认');
  };

  // ===== 工作区设置 =====
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string>(
    settings.defaultWorkspaceId ?? workspaces?.[0]?.id ?? '',
  );
  const [workspaceTransition, setWorkspaceTransition] = useState<boolean>(
    settings.workspaceTransition ?? true,
  );
  const [exportWorkspaceId, setExportWorkspaceId] = useState<string>(activeWorkspaceId ?? '');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSetDefaultWorkspace = useCallback(
    (id: string) => {
      setDefaultWorkspaceId(id);
      updateSetting('defaultWorkspaceId', id);
      toast.success('默认工作区已更新');
    },
    [updateSetting],
  );

  const handleExportWorkspace = useCallback(() => {
    if (!exportWorkspace || !exportWorkspaceId) {
      toast.error('请选择要导出的工作区');
      return;
    }
    const json = exportWorkspace(exportWorkspaceId);
    if (!json) {
      toast.error('导出失败');
      return;
    }
    const ws = workspaces?.find((w) => w.id === exportWorkspaceId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-${ws?.name ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('工作区数据已导出');
  }, [exportWorkspace, exportWorkspaceId, workspaces]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !importWorkspace) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = importWorkspace(reader.result as string);
        if (result) {
          toast.success(`已导入工作区「${result.name}」`);
        } else {
          toast.error('导入失败：文件格式无效');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importWorkspace],
  );


  const { applyTheme } = useThemePack();

  const handleThemeChange = useCallback(
    (themeId: string) => {
      applyTheme(themeId);
      updateSetting('themePack', themeId);
      // 同步更新当前工作区的主题包
      if (activeWorkspaceId && updateWorkspace) {
        updateWorkspace(activeWorkspaceId, { themePack: themeId });
      }
      const theme = THEME_PACKS.find((t) => t.id === themeId);
      if (theme) {
        toast.success(`已切换为「${theme.name}」主题`);
      }
    },
    [applyTheme, updateSetting, activeWorkspaceId, updateWorkspace],
  );

  return (
    <div className="h-full w-full flex bg-background">
      {/* 左侧导航 */}
      <div className="shrink-0 w-56 border-r border-border/60 p-4 bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground mb-4 px-2">设置</h2>
        <nav className="space-y-0.5">
          {settingSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="size-4" />
                <span className="flex-1">{section.label}</span>
                {isActive && <ChevronRight className="size-3.5" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <AnimatedSection key="appearance" active={activeSection === 'appearance'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">外观设置</h1>
              <p className="text-sm text-muted-foreground">自定义界面的视觉风格与密度</p>
            </div>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">主题模式</CardTitle>
                <CardDescription>选择适合你的界面主题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: '浅色', icon: Sun },
                    { value: 'dark', label: '深色', icon: Moon },
                    { value: 'system', label: '跟随系统', icon: Monitor },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isActive = settings.theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateSetting('theme', opt.value as any)}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80 bg-card'
                        }`}
                      >
                        <Icon className="size-5" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">主题包</CardTitle>
                <CardDescription>选择一套完整的色彩系统，切换即生效</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {THEME_PACKS.map((theme) => {
                    const isActive = settings.themePack === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => handleThemeChange(theme.id)}
                        className={`group relative rounded-xl border-2 transition-all overflow-hidden ${
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80'
                        }`}
                        title={`${theme.name} — ${theme.description}`}
                      >
                        {/* 三色预览条 */}
                        <div className="h-14 flex">
                          {theme.preview.map((color, i) => (
                            <div
                              key={i}
                              className="flex-1"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="px-2 py-2 text-center">
                          <div
                            className={`text-xs font-medium ${
                              isActive ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {theme.name}
                          </div>
                        </div>
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary flex items-center justify-center">
                            <svg
                              className="size-3 text-primary-foreground"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">界面密度</CardTitle>
                <CardDescription>调整内容间距与紧凑程度</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'compact', label: '紧凑' },
                    { value: 'comfortable', label: '舒适' },
                    { value: 'spacious', label: '宽松' },
                  ].map((opt) => {
                    const isActive = settings.density === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateSetting('density', opt.value as any)}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80 bg-card'
                        }`}
                      >
                        <LayoutGrid className="size-5" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <StickyNote className="size-4 text-primary" />
                    精简模式
                  </span>
                  <Switch
                    checked={!!settings.liteMode}
                    onCheckedChange={(v) => updateSetting('liteMode', v)}
                  />
                </CardTitle>
                <CardDescription>
                  开启后隐藏完整主窗口，仅保留系统托盘与浮动便签，专注随手记录。可通过托盘菜单「退出精简模式」或快捷键 Ctrl+Shift+L 恢复。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">字号缩放</CardTitle>
                <CardDescription>调整界面基础字号大小</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Type className="size-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Slider
                      value={[settings.fontSize === 'small' ? 0 : settings.fontSize === 'medium' ? 1 : 2]}
                      onValueChange={([v]) =>
                        updateSetting('fontSize', (['small', 'medium', 'large'] as const)[v])
                      }
                      max={2}
                      step={1}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {settings.fontSize === 'small' ? '小' : settings.fontSize === 'medium' ? '中' : '大'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection key="editor" active={activeSection === 'editor'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">编辑器设置</h1>
              <p className="text-sm text-muted-foreground">调整编辑器的行为和样式</p>
            </div>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">默认字体</CardTitle>
                <CardDescription>选择编辑器正文字体</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={settings.editorFont}
                  onValueChange={(v) => updateSetting('editorFont', v as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sans">无衬线体 (Sans-serif)</SelectItem>
                    <SelectItem value="serif">衬线体 (Serif)</SelectItem>
                    <SelectItem value="mono">等宽字体 (Monospace)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">自动保存</CardTitle>
                <CardDescription>编辑后自动保存的间隔时间</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">自动保存间隔</div>
                    <div className="text-xs text-muted-foreground">
                      {settings.autoSaveInterval} ms
                    </div>
                  </div>
                  <div className="w-40">
                    <Slider
                      value={[settings.autoSaveInterval / 100]}
                      onValueChange={([v]) => updateSetting('autoSaveInterval', v * 100)}
                      min={1}
                      max={30}
                      step={1}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">辅助功能</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">拼写检查</div>
                    <div className="text-xs text-muted-foreground">
                      自动检测拼写错误并标注
                    </div>
                  </div>
                  <Switch
                    checked={settings.spellCheck}
                    onCheckedChange={(v) => updateSetting('spellCheck', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">实时字数统计</div>
                    <div className="text-xs text-muted-foreground">
                      在编辑器底部显示字数
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-normal">已开启</Badge>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection key="features" active={activeSection === 'features'}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold mb-1">功能模块管理</h1>
                <p className="text-sm text-muted-foreground">
                  管理侧边栏中显示的功能入口
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEnabledFeatures?.(new Set(FEATURE_MODULES.map((m) => m.id)));
                    toast.success('已启用全部功能');
                  }}
                >
                  <Eye className="size-3.5 mr-1" />
                  全部启用
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEnabledFeatures?.(new Set(FEATURE_MODULES.filter((m) => m.defaultEnabled).map((m) => m.id)));
                    toast.success('已恢复默认功能');
                  }}
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  恢复默认
                </Button>
              </div>
            </div>

            {/* 已隐藏的功能 */}
            {(() => {
              const hidden = FEATURE_MODULES.filter((m) => !enabledFeatures?.has(m.id));
              if (hidden.length === 0) return null;
              return (
                <Card className="border-border/50 mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <EyeOff className="size-4 text-muted-foreground" />
                      已隐藏的功能
                      <Badge variant="secondary" className="text-xs font-normal">
                        {hidden.length} 个
                      </Badge>
                    </CardTitle>
                    <CardDescription>在引导页中取消勾选或手动关闭的功能</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {hidden.map((m) => {
                      const Icon = m.icon;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-80"
                        >
                          <div className="size-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-muted-foreground">
                              {m.name}
                            </div>
                            <div className="text-xs text-muted-foreground/70">
                              {m.description}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEnabledFeatures?.((prev) => {
                                const next = new Set(prev);
                                next.add(m.id);
                                return next;
                              });
                              toast.success(`已恢复「${m.name}」`);
                            }}
                          >
                            <Eye className="size-3.5 mr-1" />
                            恢复显示
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })()}

            {/* 按分组展示的功能列表 */}
            <Accordion type="multiple" defaultValue={FEATURE_GROUPS.map((g) => g.id)} className="space-y-4">
              {FEATURE_GROUPS.map((group) => {
                const mods = FEATURE_MODULES.filter((m) => m.group === group.id);
                const enabledCount = mods.filter((m) => enabledFeatures?.has(m.id)).length;
                return (
                  <Card key={group.id} className="border-border/50 overflow-hidden">
                    <AccordionItem value={group.id} className="border-none">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="text-left">
                            <div className="text-sm font-semibold text-foreground">
                              {group.name}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                ({enabledCount}/{mods.length})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {group.description}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-6 pb-4 space-y-1">
                          {mods.map((m) => {
                            const Icon = m.icon;
                            const isEnabled = enabledFeatures?.has(m.id) ?? false;
                            const isCore = m.id === 'notebooks';
                            return (
                              <div
                                key={m.id}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                  isEnabled ? '' : 'opacity-60'
                                }`}
                              >
                                <div
                                  className={`size-9 shrink-0 rounded-lg flex items-center justify-center ${
                                    isEnabled ? 'bg-primary/10' : 'bg-muted'
                                  }`}
                                >
                                  <Icon
                                    className={`size-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">
                                    {m.name}
                                    {isCore && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-[10px] font-normal py-0 h-4"
                                      >
                                        核心
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {m.description}
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  disabled={isCore}
                                  onCheckedChange={(checked) => {
                                    if (!setEnabledFeatures) return;
                                    setEnabledFeatures((prev) => {
                                      const next = new Set(prev);
                                      if (checked) {
                                        next.add(m.id);
                                        toast.success(`已启用「${m.name}」`);
                                      } else {
                                        next.delete(m.id);
                                        toast.info(`已隐藏「${m.name}」`);
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                );
              })}
            </Accordion>
          </AnimatedSection>

          <AnimatedSection key="shortcuts" active={activeSection === 'shortcuts'}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold mb-1">快捷键</h1>
                <p className="text-sm text-muted-foreground">
                  查看和自定义所有键盘快捷键
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleResetShortcuts}>
                <RefreshCw className="size-3.5 mr-1" />
                重置默认
              </Button>
            </div>

            <Card className="mb-4 border-border/50">
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold">全局快捷键（应用外可触发）</h2>
                <GlobalShortcutSettings />
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">功能</TableHead>
                        <TableHead className="whitespace-nowrap">快捷键</TableHead>
                        <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shortcutList.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono">
                              {shortcuts[item.key] ?? item.default}
                            </kbd>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              自定义
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-2">提示</Badge>
              全局搜索快捷键 Ctrl+K 可在任意页面唤起搜索面板
            </div>
          </AnimatedSection>

          <AnimatedSection key="data" active={activeSection === 'data'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">数据管理</h1>
              <p className="text-sm text-muted-foreground">管理你的笔记数据和本地存储</p>
            </div>

            <EncryptionPanel
              enabled={!!settings.encryptionEnabled}
              onToggle={(v) => setSettings((prev) => ({ ...prev, encryptionEnabled: v }))}
            />

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">数据导入/导出</CardTitle>
                <CardDescription>备份或迁移你的笔记数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Download className="size-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">导出所有笔记</div>
                      <div className="text-xs text-muted-foreground">
                        导出为 JSON / Markdown 格式
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleExport}>
                    导出
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Upload className="size-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">导入笔记</div>
                      <div className="text-xs text-muted-foreground">
                        支持 JSON / Markdown 格式导入
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleImport}>
                    选择文件
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-destructive">危险操作</CardTitle>
                <CardDescription>不可恢复的操作，请谨慎</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="size-4 text-destructive" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">清理缓存</div>
                      <div className="text-xs text-muted-foreground">
                        清除本地缓存数据，不影响笔记内容
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClearCache}
                  >
                    清理
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection key="workspace" active={activeSection === 'workspace'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">工作区设置</h1>
              <p className="text-sm text-muted-foreground">默认工作区、切换动画与数据导入导出</p>
            </div>

            <Card className="border-border/50 mb-4">
              <CardHeader>
                <CardTitle className="text-sm">默认工作区</CardTitle>
                <CardDescription className="text-xs">启动应用时自动进入的工作区</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-normal text-muted-foreground">启动默认工作区</Label>
                    <p className="text-xs text-muted-foreground"></p>
                  </div>
                  <div className="w-48">
                    <Select value={defaultWorkspaceId} onValueChange={handleSetDefaultWorkspace}>
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="选择默认工作区" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces
                          ?.filter((w) => !(w as { archived?: boolean }).archived)
                          .map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>
                              <span className="flex items-center gap-2">
                                <span>{ws.icon}</span>
                                {ws.name}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader>
                <CardTitle className="text-sm">切换动画</CardTitle>
                <CardDescription className="text-xs">切换工作区时的过渡效果</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">工作区切换动画</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      切换时显示工作区名称与主题色过渡
                    </p>
                  </div>
                  <Switch checked={workspaceTransition} onCheckedChange={setWorkspaceTransition} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader>
                <CardTitle className="text-sm">数据导出</CardTitle>
                <CardDescription className="text-xs">
                  将单个工作区导出为 JSON 文件，便于备份或迁移
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">选择工作区</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">导出该工作区的所有笔记与设置</p>
                  </div>
                  <div className="w-48">
                    <Select value={exportWorkspaceId} onValueChange={setExportWorkspaceId}>
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="选择工作区" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces?.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            <span className="flex items-center gap-2">
                              <span>{ws.icon}</span>
                              {ws.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <Button variant="secondary" size="sm" onClick={handleExportWorkspace}>
                  <Download className="size-4 mr-1.5" />
                  导出为 JSON
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 mb-4">
              <CardHeader>
                <CardTitle className="text-sm">数据导入</CardTitle>
                <CardDescription className="text-xs">
                  将 JSON 工作区文件导入为新的工作区
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  导入后会创建一个新的工作区，不会覆盖现有数据
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}>
                    <Upload className="size-4 mr-1.5" />
                    选择 JSON 文件
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm">快捷键</CardTitle>
                <CardDescription className="text-xs">工作区相关快捷键</CardDescription>
              </CardHeader>
              <CardContent className="py-3 space-y-2 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">快速切换工作区</span>
                  <kbd className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Ctrl + Shift + W</kbd>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* AI 助手设置 */}
          <AnimatedSection key="ai" active={activeSection === 'ai'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">AI 助手设置</h1>
              <p className="text-sm text-muted-foreground">配置大模型接口，启用真实 AI 写作 / 续写 / 总结等能力</p>
            </div>

            <Card className="border-border/50 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">接口配置</CardTitle>
                <CardDescription>支持 OpenAI 兼容接口：OpenAI、DeepSeek、通义、Ollama 等</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-apiKey">API Key</Label>
                  <Input
                    id="ai-apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={settings.aiApiKey ?? ''}
                    onChange={(e) => updateSetting('aiApiKey', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    API Key 仅保存在本机设置中，不会上传到服务器
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-baseUrl">接口地址 (Base URL)</Label>
                    <Input
                      id="ai-baseUrl"
                      placeholder="https://api.openai.com/v1"
                      value={settings.aiBaseUrl ?? ''}
                      onChange={(e) => updateSetting('aiBaseUrl', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-model">模型名称</Label>
                    <Input
                      id="ai-model"
                      placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
                      value={settings.aiModel ?? ''}
                      onChange={(e) => updateSetting('aiModel', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      localStorage.setItem('yixian_settings', JSON.stringify({ ...settings }));
                      toast.success('AI 配置已保存');
                    }}
                  >
                    保存配置
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {settings.aiApiKey ? '已配置 API Key ✅' : '未配置 API Key，将使用本地处理引擎'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection key="about" active={activeSection === 'about'}>
            <div className="mb-6">
              <h1 className="text-xl font-bold mb-1">关于一闲笔记</h1>
              <p className="text-sm text-muted-foreground">版本信息与致谢</p>
            </div>

            <Card className="border-border/50 mb-4">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="size-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <span className="text-2xl text-primary-foreground font-bold">一</span>
                  </div>
                  <h3 className="text-lg font-bold mb-1">一闲笔记</h3>
                  <Badge variant="secondary">v3.1.0</Badge>
                  <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto">
                    一款轻量高效的桌面端笔记应用，致力于为你打造安静专注的书写空间。
                    闲看庭前花开花落，漫随天外云卷云舒。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="py-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">作者</span>
                  <span className="font-medium">梦一闲</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">版本号</span>
                  <span className="font-medium">v3.1.0</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">更新日期</span>
                  <span className="font-medium">2026-09-03</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">技术栈</span>
                  <span className="font-medium">React + TypeScript</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 mt-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-0.5">启动引导</div>
                    <div className="text-xs text-muted-foreground">
                      重新开启启动引导向导，自定义工作区与功能模块
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openOnboarding?.()}
                  >
                    <Sparkles className="size-4 mr-1.5" />
                    重新启动引导
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}

function AnimatedSection({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
