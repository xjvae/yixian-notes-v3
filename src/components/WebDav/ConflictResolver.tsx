// ============================================================
// 冲突解决组件
// 显示冲突文件列表、并排对比、选择保留策略、批量解决
// ============================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  X,
  Copy,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
  Monitor,
  Cloud,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SyncConflict } from '@/lib/webdav';

// ── 类型定义 ──

type ResolutionChoice = 'local' | 'remote' | 'both';

interface ConflictItemProps {
  conflict: SyncConflict;
  isExpanded: boolean;
  onToggle: () => void;
  choice: ResolutionChoice | null;
  onChoice: (choice: ResolutionChoice) => void;
}

// ── 单行冲突组件 ──

function ConflictItem({ conflict, isExpanded, onToggle, choice, onChoice }: ConflictItemProps) {
  const fileName = conflict.file.name;

  // 简单的行级差异对比
  const diffLines = useMemo(() => {
    const localLines = conflict.localContent.split('\n');
    const remoteLines = conflict.remoteContent.split('\n');
    const maxLen = Math.max(localLines.length, remoteLines.length);
    const lines: Array<{ num: number; local: string; remote: string; isDiff: boolean }> = [];

    for (let i = 0; i < maxLen; i++) {
      const local = localLines[i] ?? '';
      const remote = remoteLines[i] ?? '';
      lines.push({
        num: i + 1,
        local,
        remote,
        isDiff: local !== remote,
      });
    }
    return lines;
  }, [conflict.localContent, conflict.remoteContent]);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* 冲突文件头 */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20',
        )}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <FileText className="size-4 text-yellow-500 shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
        <Badge variant="outline" className="text-xs font-normal shrink-0">
          <AlertTriangle className="size-3 mr-1 text-yellow-500" />
          冲突
        </Badge>
        {choice && (
          <Badge
            variant={choice === 'local' ? 'default' : choice === 'remote' ? 'secondary' : 'outline'}
            className="text-xs font-normal shrink-0"
          >
            {choice === 'local' ? '保留本地' : choice === 'remote' ? '保留远程' : '保留双方'}
          </Badge>
        )}
      </button>

      {/* 展开的对比视图 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50">
              {/* 时间信息 */}
              <div className="flex items-center gap-4 px-4 py-2 bg-muted/10 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Monitor className="size-3" />
                  <span>本地: {new Date(conflict.localModified).toLocaleString('zh-CN')}</span>
                </div>
                <ArrowLeftRight className="size-3" />
                <div className="flex items-center gap-1">
                  <Cloud className="size-3" />
                  <span>远程: {new Date(conflict.remoteModified).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {/* 并排对比 */}
              <div className="grid grid-cols-2 divide-x divide-border/50">
                {/* 本地版本 */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="size-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-blue-500">本地版本</span>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="font-mono text-xs leading-relaxed">
                      {diffLines.map((line) => (
                        <div
                          key={`local-${line.num}`}
                          className={cn(
                            'flex',
                            line.isDiff && 'bg-blue-500/10 border-l-2 border-blue-500',
                          )}
                        >
                          <span className="w-8 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                            {line.num}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {line.local || '\u00A0'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* 远程版本 */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="size-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-500">远程版本</span>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="font-mono text-xs leading-relaxed">
                      {diffLines.map((line) => (
                        <div
                          key={`remote-${line.num}`}
                          className={cn(
                            'flex',
                            line.isDiff && 'bg-green-500/10 border-l-2 border-green-500',
                          )}
                        >
                          <span className="w-8 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                            {line.num}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {line.remote || '\u00A0'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/10 border-t border-border/50">
                <Button
                  size="sm"
                  variant={choice === 'local' ? 'default' : 'outline'}
                  onClick={() => onChoice('local')}
                >
                  <Monitor className="size-3.5 mr-1" />
                  保留本地
                </Button>
                <Button
                  size="sm"
                  variant={choice === 'remote' ? 'default' : 'outline'}
                  onClick={() => onChoice('remote')}
                >
                  <Cloud className="size-3.5 mr-1" />
                  保留远程
                </Button>
                <Button
                  size="sm"
                  variant={choice === 'both' ? 'default' : 'outline'}
                  onClick={() => onChoice('both')}
                >
                  <Copy className="size-3.5 mr-1" />
                  保留双方
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 主组件 ──

interface ConflictResolverProps {
  conflicts: SyncConflict[];
  onResolve: (resolutions: Map<string, ResolutionChoice>) => void;
  onCancel: () => void;
}

export default function ConflictResolver({ conflicts, onResolve, onCancel }: ConflictResolverProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, ResolutionChoice>>(new Map());

  // 设置单个冲突的解决方式
  const handleChoice = (fileName: string, choice: ResolutionChoice) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(fileName, choice);
      return next;
    });
  };

  // 批量设置
  const handleBatchChoice = (choice: ResolutionChoice) => {
    const newResolutions = new Map<string, ResolutionChoice>();
    conflicts.forEach((c) => {
      newResolutions.set(c.file.name, choice);
    });
    setResolutions(newResolutions);
  };

  // 确认解决
  const handleConfirm = () => {
    onResolve(resolutions);
  };

  // 统计
  const resolvedCount = resolutions.size;
  const totalCount = conflicts.length;
  const allResolved = resolvedCount === totalCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col bg-background rounded-lg shadow-2xl border border-border/50 overflow-hidden"
      >
        {/* 头部 */}
        <div className="shrink-0 px-6 py-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="size-5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">解决同步冲突</h2>
                <p className="text-sm text-muted-foreground">
                  {totalCount} 个文件存在冲突，请选择保留哪个版本
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* 批量操作栏 */}
        <div className="shrink-0 px-6 py-3 border-b border-border/40 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">批量操作:</span>
              <Button size="sm" variant="outline" onClick={() => handleBatchChoice('local')}>
                <Monitor className="size-3.5 mr-1" />
                全部保留本地
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBatchChoice('remote')}>
                <Cloud className="size-3.5 mr-1" />
                全部保留远程
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBatchChoice('both')}>
                <Layers className="size-3.5 mr-1" />
                全部保留双方
              </Button>
            </div>
            <Badge variant={allResolved ? 'default' : 'secondary'}>
              {resolvedCount}/{totalCount} 已解决
            </Badge>
          </div>
        </div>

        {/* 冲突列表 */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-3">
            {conflicts.map((conflict) => (
              <ConflictItem
                key={conflict.file.name}
                conflict={conflict}
                isExpanded={expandedId === conflict.file.name}
                onToggle={() =>
                  setExpandedId((prev) =>
                    prev === conflict.file.name ? null : conflict.file.name,
                  )
                }
                choice={resolutions.get(conflict.file.name) ?? null}
                onChoice={(choice) => handleChoice(conflict.file.name, choice)}
              />
            ))}
          </div>
        </ScrollArea>

        {/* 底部操作 */}
        <div className="shrink-0 px-6 py-4 border-t border-border/60 bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              未解决的冲突将跳过同步，保留当前状态
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onCancel}>
                取消
              </Button>
              <Button onClick={handleConfirm} disabled={resolvedCount === 0}>
                <CheckCheck className="size-4 mr-1.5" />
                确认解决 ({resolvedCount})
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
