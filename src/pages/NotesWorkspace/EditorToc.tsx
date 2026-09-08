// 笔记目录（TOC）侧栏组件
//
// 从 TipTap 文档模型中提取标题结构（h1~h3），渲染为可点击目录；
// 点击条目后定位到对应标题位置并滚动到可视区。
// 通过 onTogglePosition 在左 / 右两侧切换显示。

import { useEffect, useState, memo } from 'react';
import type { Editor } from '@tiptap/react';
import { ListTree, PanelLeft, PanelRight, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TocItem {
  /** 标题层级（1~6） */
  level: number;
  /** 标题文本（去空白） */
  text: string;
  /** 标题节点在文档中的位置（用于定位/滚动） */
  from: number;
}

/** 从 ProseMirror 文档提取标题（h1~h3），空标题跳过 */
export function extractToc(editor: Editor | null): TocItem[] {
  if (!editor) return [];
  const items: TocItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return;
    const level = node.attrs.level as number;
    if (level > 3) return;
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    items.push({ level, text, from: pos });
  });
  return items;
}

interface EditorTocProps {
  editor: Editor | null;
  /** 当前所在位置：'left' | 'right' */
  position: 'left' | 'right';
  /** 向左 / 向右切换 */
  onPositionChange: (position: 'left' | 'right') => void;
  /** 关闭目录 */
  onClose: () => void;
  /** 是否可编辑（true 时点击仅定位、可滚动） */
  disabled?: boolean;
}

export default memo(function EditorToc({ editor, position, onPositionChange, onClose, disabled }: EditorTocProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeFrom, setActiveFrom] = useState<number | null>(null);

  // 编辑器变更时刷新目录（transaction 事件）
  useEffect(() => {
    if (!editor) return;
    const refresh = () => setItems(extractToc(editor));
    refresh();
    editor.on('transaction', refresh);
    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor]);

  // 点击定位到指定标题并滚动到可视区
  const handleJump = (from: number) => {
    if (!editor) return;
    setActiveFrom(from);
    editor
      .chain()
      .focus()
      .setTextSelection(from)
      .run();
    editor.commands.scrollIntoView();
    // 短暂高亮后清除
    setTimeout(() => setActiveFrom(null), 1200);
  };

  const next: 'left' | 'right' = position === 'left' ? 'right' : 'left';

  return (
    <aside
      className={cn(
        'shrink-0 w-56 bg-muted/20 overflow-hidden flex flex-col',
        position === 'left' ? 'border-r border-border/60' : 'border-l border-border/60',
      )}
    >
      {/* 头部：标题 + 左右切换 + 关闭 */}
      <div className="shrink-0 px-3 py-2.5 flex items-center justify-between gap-1">
        <TooltipProvider>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 truncate">
            <ListTree className="size-4 text-primary" />
            目录
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onPositionChange(next)}
              >
                {position === 'left' ? <PanelRight className="size-3.5" /> : <PanelLeft className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {position === 'left' ? '移到右侧' : '移到左侧'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">关闭目录</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 目录列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-1 py-2 text-center">
            {disabled ? '暂无目录' : '使用 H1~H3 标题以生成目录'}
          </p>
        ) : (
          items.map((item) => (
            <button
              key={`${item.from}-${item.text}`}
              type="button"
              onClick={() => handleJump(item.from)}
              className={cn(
                'w-full text-left rounded px-2 py-1 text-xs transition-colors line-clamp-2',
                item.level === 1 && 'font-medium',
                item.level === 2 && 'pl-4',
                item.level === 3 && 'pl-7',
                activeFrom === item.from
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              )}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </aside>
  );
});