// Markdown 编辑器组件
//
// 提供 Markdown 源码编辑 + 实时预览。通过 "编辑 / 预览 / 分屏" 三种子视图切换。
// 对外仅暴露 value / onChange / disabled，由外部（EditorPane）统一管理状态与转换。

import { memo, useState } from 'react';
import { PenLine, Eye, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import MarkdownView from '@/components/Markdown/MarkdownView';

type MarkdownViewMode = 'write' | 'split' | 'preview';

interface MarkdownEditorProps {
  /** Markdown 源码 */
  value: string;
  /** 源码变更回调 */
  onChange: (value: string) => void;
  /** 是否只读 */
  disabled?: boolean;
  /** 占位提示 */
  placeholder?: string;
}

const MODES: { key: MarkdownViewMode; label: string; icon: typeof PenLine }[] = [
  { key: 'write', label: '编辑', icon: PenLine },
  { key: 'split', label: '分屏', icon: Columns2 },
  { key: 'preview', label: '预览', icon: Eye },
];

function MarkdownEditorPane({
  value,
  onChange,
  disabled,
  placeholder,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<MarkdownViewMode>('split');
  const showWrite = mode !== 'preview';
  const showPreview = mode !== 'write';

  return (
    <div className="flex flex-col h-full">
      {/* 视图切换 */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border/60">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium',
              'transition-colors',
              mode === m.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
            )}
          >
            <m.icon className="size-3.5" />
            {m.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/60">Markdown</span>
      </div>

      <div className={cn('flex-1 flex overflow-hidden', mode === 'split' && 'divide-x divide-border/60')}>
        {showWrite && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              placeholder={placeholder}
              spellCheck={false}
              className={cn(
                'w-full h-full resize-none outline-none bg-transparent',
                'px-6 py-4 font-mono text-sm leading-relaxed',
                'text-foreground',
                disabled ? 'opacity-60' : '',
              )}
            />
          </div>
        )}

        {showPreview && (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-6 py-4 max-w-3xl mx-auto">
              <MarkdownView
                content={value}
                enableMermaid={false}
                enableMath={false}
                enableCodeHighlight={false}
              />
              {!value.trim() && (
                <p className="text-sm text-muted-foreground/50 mt-2">开始输入 Markdown 以预览渲染效果…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MarkdownEditorPane);