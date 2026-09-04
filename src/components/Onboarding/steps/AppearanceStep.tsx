import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  Settings2,
  FileText,
  Sparkles,
  Search,
  Star,
  Calendar,
  Settings,
} from 'lucide-react';
import { THEME_PACKS } from '@/lib/themes';

// ========== 外观设置步骤 ==========
interface AppearanceStepProps {
  themePack: string;
  onThemePack: (id: string) => void;
  themeMode: 'light' | 'dark' | 'system';
  onThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  fontSize: 'small' | 'medium' | 'large';
  onFontSize: (size: 'small' | 'medium' | 'large') => void;
}

export default function AppearanceStep({
  themePack,
  onThemePack,
  themeMode,
  onThemeMode,
  fontSize,
  onFontSize,
}: AppearanceStepProps) {
  const selectedTheme = useMemo(
    () => THEME_PACKS.find((t) => t.id === themePack) ?? THEME_PACKS[0],
    [themePack],
  );
  const isDark = themeMode === 'dark';

  // 根据主题和亮暗模式计算预览色
  const previewColors = useMemo(() => {
    const vars = selectedTheme.vars;
    const primary = vars['--primary'] ?? vars['--ring'] ?? '#3F7F5F';
    const bg = vars['--background'] ?? '#F7F5F0';
    const card = vars['--card'] ?? '#ffffff';
    const sidebar = vars['--sidebar'] ?? vars['--muted'] ?? '#f0eeea';
    const foreground = vars['--foreground'] ?? '#2d3436';
    const mutedFg = vars['--muted-foreground'] ?? '#7a8086';
    const accent = vars['--accent'] ?? vars['--secondary'] ?? '#e6f0eb';
    const border = vars['--border'] ?? '#e5e7eb';
    const sidebarFg = vars['--sidebar-foreground'] ?? foreground;

    if (isDark) {
      // 简单反色：整体变暗
      return {
        bg: '#1a1a1a',
        card: '#252525',
        sidebar: '#202020',
        foreground: '#e8e8e8',
        mutedFg: '#888',
        primary: primary,
        accent: 'rgba(255,255,255,0.08)',
        border: 'rgba(255,255,255,0.1)',
        sidebarFg: '#e8e8e8',
      };
    }
    return { bg, card, sidebar, foreground, mutedFg, primary, accent, border, sidebarFg };
  }, [selectedTheme, isDark]);

  const fontSizeClass = fontSize === 'small' ? 'text-[8px]' : fontSize === 'large' ? 'text-[11px]' : 'text-[9px]';
  const titleSize = fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-[13px]' : 'text-[11px]';
  const fontScale = fontSize === 'small' ? 0.85 : fontSize === 'large' ? 1.15 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="px-6 py-4"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-1">选择你喜欢的外观</h3>
        <p className="text-sm text-muted-foreground">
          打造最舒服的笔记视觉体验，随时可以在设置中调整
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* 左侧：设置项 */}
        <div className="col-span-3 space-y-4">
          {/* 主题包 */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">
              <Palette className="size-3.5 inline mr-1.5 -mt-0.5" />
              主题风格
            </label>
            <div className="grid grid-cols-5 gap-2">
              {THEME_PACKS.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onThemePack(theme.id)}
                  className={`relative flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                    themePack === theme.id
                      ? 'border-primary'
                      : 'border-transparent hover:bg-accent/50'
                  }`}
                  title={`${theme.name} - ${theme.description}`}
                >
                  <div
                    className="w-full aspect-square rounded-md overflow-hidden mb-1"
                    style={{
                      background: `linear-gradient(135deg, ${theme.preview[0]} 0%, ${theme.preview[1]} 50%, ${theme.preview[2]} 100%)`,
                    }}
                  />
                  <span className="text-[10px] text-foreground/70 truncate w-full text-center">
                    {theme.name}
                  </span>
                  {themePack === theme.id && (
                    <div className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Sparkles className="size-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 亮/暗模式 */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">
              <Settings2 className="size-3.5 inline mr-1.5 -mt-0.5" />
              显示模式
            </label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onThemeMode(m)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    themeMode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground/70 hover:bg-accent/50'
                  }`}
                >
                  {m === 'light' ? '浅色' : m === 'dark' ? '深色' : '跟随系统'}
                </button>
              ))}
            </div>
          </div>

          {/* 字体大小 */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">
              <FileText className="size-3.5 inline mr-1.5 -mt-0.5" />
              字体大小
            </label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onFontSize(s)}
                  className={`flex-1 py-2 px-3 font-medium border transition-all ${
                    fontSize === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground/70 hover:bg-accent/50'
                  } ${s === 'small' ? 'text-xs' : s === 'medium' ? 'text-sm' : 'text-base'}`}
                >
                  {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：实时预览 */}
        <div className="col-span-2">
          <label className="text-sm font-medium text-foreground/80 mb-2 block flex items-center justify-between">
            <span>实时预览</span>
            <span className="text-xs font-normal text-muted-foreground">
              {selectedTheme.name}
            </span>
          </label>
          <div
            className="rounded-xl border shadow-sm overflow-hidden transition-all duration-300"
            style={{ backgroundColor: previewColors.bg, borderColor: previewColors.border }}
          >
            {/* 迷你三栏布局 */}
            <div
              className="flex h-[220px] transition-all duration-300"
              style={{ fontSize: `${fontScale}em` }}
            >
              {/* 迷你侧边栏 */}
              <div
                className="w-10 shrink-0 flex flex-col items-center py-2 gap-1.5 border-r transition-all duration-300"
                style={{
                  backgroundColor: previewColors.sidebar,
                  borderColor: previewColors.border,
                }}
              >
                {/* logo */}
                <div
                  className="size-6 rounded-md flex items-center justify-center mb-1"
                  style={{ backgroundColor: previewColors.primary, color: '#fff' }}
                >
                  <Sparkles className="size-3" />
                </div>
                {/* 导航图标 */}
                {[FileText, Star, Calendar, Settings].map((Icon: any, i: number) => (
                  <div
                    key={i}
                    className={`size-6 rounded-md flex items-center justify-center transition-colors ${
                      i === 0 ? '' : 'opacity-60'
                    }`}
                    style={{
                      backgroundColor: i === 0 ? previewColors.accent : 'transparent',
                      color: i === 0 ? previewColors.primary : previewColors.sidebarFg,
                    }}
                  >
                    <Icon className="size-3" />
                  </div>
                ))}
              </div>

              {/* 迷你笔记列表 */}
              <div
                className="w-24 shrink-0 flex flex-col border-r transition-all duration-300"
                style={{
                  backgroundColor: previewColors.card,
                  borderColor: previewColors.border,
                }}
              >
                {/* 搜索框 */}
                <div className="p-1.5 border-b" style={{ borderColor: previewColors.border }}>
                  <div
                    className="h-4 rounded flex items-center gap-1 px-1.5"
                    style={{ backgroundColor: previewColors.accent + '60' }}
                  >
                    <Search className="size-2.5" style={{ color: previewColors.mutedFg }} />
                    <span className="text-[7px]" style={{ color: previewColors.mutedFg }}>搜索...</span>
                  </div>
                </div>
                {/* 笔记卡片 */}
                <div className="flex-1 overflow-hidden p-1 space-y-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded px-1.5 py-1 transition-colors"
                      style={{
                        backgroundColor: i === 0 ? previewColors.accent : 'transparent',
                        borderLeft: i === 0 ? `2px solid ${previewColors.primary}` : '2px solid transparent',
                      }}
                    >
                      <div
                        className="font-semibold leading-tight truncate"
                        style={{ color: previewColors.foreground, fontSize: i === 0 ? '9px' : '8px' }}
                      >
                        {i === 0 ? '欢迎使用一闲笔记' : i === 1 ? '产品规划思路' : '读书笔记摘录'}
                      </div>
                      <div
                        className="truncate leading-tight mt-0.5"
                        style={{ color: previewColors.mutedFg, fontSize: '7px' }}
                      >
                        {i === 0 ? '开始你的第一篇笔记...' : i === 1 ? '整理核心功能模块' : '原子习惯 第三章'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 迷你编辑器 */}
              <div
                className="flex-1 min-w-0 flex flex-col transition-all duration-300"
                style={{ backgroundColor: previewColors.bg }}
              >
                {/* 工具栏 */}
                <div
                  className="h-5 shrink-0 flex items-center gap-1 px-2 border-b"
                  style={{ borderColor: previewColors.border }}
                >
                  {['B', 'I', 'U', '•', '"', '</>'].map((t, i) => (
                    <div
                      key={i}
                      className="size-3.5 rounded flex items-center justify-center font-bold"
                      style={{ color: previewColors.mutedFg, fontSize: '7px' }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
                {/* 编辑内容 */}
                <div className="flex-1 p-2 overflow-hidden space-y-1" style={{ color: previewColors.foreground }}>
                  <div
                    className="font-bold leading-tight"
                    style={{ fontSize: titleSize, color: previewColors.foreground }}
                  >
                    欢迎使用一闲笔记
                  </div>
                  <div
                    className="leading-relaxed"
                    style={{ fontSize: fontSizeClass === 'text-[8px]' ? '7px' : fontSizeClass === 'text-[11px]' ? '9px' : '8px', color: previewColors.foreground, opacity: 0.85 }}
                  >
                    这是一个示例笔记，你可以在这里记录任何想法。
                  </div>
                  <ul className="space-y-0.5 pl-3" style={{ color: previewColors.foreground, opacity: 0.7 }}>
                    <li className="text-[7px] leading-tight">✓ 支持富文本编辑</li>
                    <li className="text-[7px] leading-tight">✓ 标签与分类管理</li>
                    <li className="text-[7px] leading-tight">✓ 云同步与备份</li>
                  </ul>
                  <div
                    className="rounded px-1.5 py-0.5 mt-1 inline-block"
                    style={{ backgroundColor: previewColors.primary, color: '#fff', fontSize: '7px' }}
                  >
                    开始写作
                  </div>
                </div>
                {/* 状态栏 */}
                <div
                  className="h-4 shrink-0 flex items-center justify-between px-2 border-t"
                  style={{ borderColor: previewColors.border, color: previewColors.mutedFg }}
                >
                  <span style={{ fontSize: '6px' }}>128 字</span>
                  <span style={{ fontSize: '6px' }}>已保存</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {themeMode === 'light' ? '浅色模式' : themeMode === 'dark' ? '深色模式' : '跟随系统'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
