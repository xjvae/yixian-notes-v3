import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IWorkspace } from '@/data/notes';

interface WorkspaceStats {
  noteCount: number;
}

interface WorkspaceQuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  workspaces: IWorkspace[];
  activeWorkspaceId: string;
  workspaceStats: Map<string, WorkspaceStats>;
  onSwitch: (id: string) => void;
}

export default function WorkspaceQuickSwitcher({
  open,
  onClose,
  workspaces,
  activeWorkspaceId,
  workspaceStats,
  onSwitch,
}: WorkspaceQuickSwitcherProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');

  const activeWorkspaces = workspaces.filter((w) => !w.archived);

  const filtered = activeWorkspaces.filter(
    (w) => w.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
    setQuery('');
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const ws = filtered[selectedIndex];
        if (ws) {
          onSwitch(ws.id);
          onClose();
        }
        return;
      }

      // 数字键 1-9 直接切换
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= filtered.length) {
        const ws = filtered[num - 1];
        if (ws) {
          onSwitch(ws.id);
          onClose();
        }
      }
    },
    [open, filtered, selectedIndex, onSwitch, onClose],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-card rounded-xl border shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 搜索框 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <Command className="size-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索工作区..."
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Esc
            </kbd>
          </div>

          {/* 工作区列表 */}
          <div className="p-2 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                没有匹配的工作区
              </div>
            ) : (
              filtered.map((ws, i) => {
                const isSelected = i === selectedIndex;
                const isActive = ws.id === activeWorkspaceId;
                const stats = workspaceStats.get(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSwitch(ws.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50 text-foreground',
                    )}
                  >
                    <div
                      className="size-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                      style={{ backgroundColor: `${ws.color}20` }}
                    >
                      {ws.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <span className="truncate">{ws.name}</span>
                        {isActive && (
                          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {stats?.noteCount ?? 0} 篇笔记
                      </div>
                    </div>
                    {i < 9 && (
                      <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {i + 1}
                      </kbd>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* 底部提示 */}
          <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>↑↓ 选择</span>
              <span>Enter 切换</span>
            </div>
            <span>Ctrl+Shift+W</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
