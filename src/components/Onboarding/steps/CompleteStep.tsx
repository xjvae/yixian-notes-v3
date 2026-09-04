import { motion } from 'framer-motion';
import { CheckCircle2, LayoutGrid, Palette, StickyNote } from 'lucide-react';
import type { IWorkspace } from '@/data/notes';

// ========== 完成步骤 ==========
interface CompleteStepProps {
  workspace?: IWorkspace;
  enabledCount: number;
  themeName: string;
  themeMode: 'light' | 'dark' | 'system';
  dontShowAgain: boolean;
  onDontShowAgain: (v: boolean) => void;
  liteMode: boolean;
  onLiteMode: (v: boolean) => void;
}

export default function CompleteStep({
  workspace,
  enabledCount,
  themeName,
  themeMode,
  dontShowAgain,
  onDontShowAgain,
  liteMode,
  onLiteMode,
}: CompleteStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center px-8 py-8 text-center"
    >
      {/* 动画对勾 */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="relative w-20 h-20 mb-6"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5" />
        <div className="absolute inset-2 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <CheckCircle2 className="size-10" />
        </div>
        {/* 彩带装饰点 */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <motion.div
            key={deg}
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: -20, opacity: 0 }}
            transition={{ delay: 0.4 + deg * 0.002, duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
            className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-primary"
            style={{
              transform: `rotate(${deg}deg) translateY(-36px)`,
              transformOrigin: '0 0',
            }}
          />
        ))}
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-foreground mb-1"
      >
        一切就绪！
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-sm text-muted-foreground mb-6"
      >
        你的专属笔记空间已准备好
      </motion.p>

      {/* 选择摘要 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm bg-card border border-border rounded-xl p-4 space-y-3 text-left mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <div
              className="size-6 rounded-md flex items-center justify-center text-sm"
              style={{ backgroundColor: workspace ? `${workspace.color}20` : undefined }}
            >
              {workspace?.icon}
            </div>
            工作区
          </div>
          <span className="text-sm font-medium text-foreground">{workspace?.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <LayoutGrid className="size-4" />
            启用功能
          </div>
          <span className="text-sm font-medium text-foreground">{enabledCount} 个</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <Palette className="size-4" />
            主题外观
          </div>
          <span className="text-sm font-medium text-foreground">
            {themeName} · {themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统'}
          </span>
        </div>
      </motion.div>

      {/* 精简模式选择 */}
      <motion.label
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-sm flex items-start gap-3 bg-card border border-border rounded-xl p-4 mb-6 cursor-pointer select-none text-left"
      >
        <input
          type="checkbox"
          checked={liteMode}
          onChange={(e) => onLiteMode(e.target.checked)}
          className="mt-1 size-4 rounded border-border text-primary focus:ring-primary/30"
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <StickyNote className="size-4 text-primary" />
            使用精简模式
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed">
            立即隐藏主窗口，只保留系统托盘与浮动便签，专注随手记录。
          </span>
        </span>
      </motion.label>

      <motion.label
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none"
      >
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => onDontShowAgain(e.target.checked)}
          className="size-4 rounded border-border text-primary focus:ring-primary/30"
        />
        不再显示启动引导
      </motion.label>
    </motion.div>
  );
}
