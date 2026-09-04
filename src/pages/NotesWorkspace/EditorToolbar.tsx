// 编辑器工具栏组件
//
// 包含撤销/重做、格式按钮、插入操作、AI 助手、历史版本、收藏、更多操作。
// 从 EditorPane 中提取的工具栏 UI。

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Star,
  MoreHorizontal,
  Trash2,
  RotateCcw,
  History,
  Sparkles,
  FileType,
  FileEdit,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { EditorToolbarProps } from './types';

// --- 内部工具按钮 ---

interface ToolButtonProps {
  icon: typeof Bold;
  label: string;
  command: string;
  value?: string;
  /** 激活态检测 key：用于光标处实时高亮当前格式按钮 */
  formatKey?: string;
  /** 当前光标处各格式的激活映射 */
  formatState?: Record<string, boolean>;
}

const ToolButton = memo(function ToolButton({
  icon: Icon,
  label,
  command,
  value,
  formatKey,
  formatState,
}: ToolButtonProps) {
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // 保留编辑器选区的同时执行格式命令（mousedown 时 preventDefault 避免失焦）
    document.execCommand(command, false, value);
    // 明显的按下闪烁反馈，让用户确认已点击
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 220);
  };

  // 光标处已应用该格式（常驻激活态）——由外部 queryCommandState 驱动
  const active = formatKey ? (formatState?.[formatKey] as boolean) ?? false : false;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-colors duration-100',
            flash
              ? 'bg-primary text-primary-foreground'
              : active
                ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
          )}
          onMouseDown={handleClick}
          aria-label={label}
          aria-pressed={active}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
});

// --- 工具栏主组件 ---

export default memo(function EditorToolbar({
  canUndo,
  canRedo,
  showHistory,
  isFavorite,
  isDeleted,
  isMarkdownMode,
  isEncrypted,
  isPrivate,
  onEncrypt,
  onTogglePrivate,
  onToggleMarkdownMode,
  onUndo,
  onRedo,
  onToggleHistory,
  onToggleFavorite,
  onAIClick,
  onInsertLink,
  onInsertImage,
  onDelete,
  onRestore,
  notebooks,
  onMoveNotebook,
  onExportNote,
}: EditorToolbarProps) {
  // ---- 光标格式激活态：实时反映当前选中内容的格式，常驻高亮对应按钮 ----
  const [formatState, setFormatState] = useState<Record<string, boolean>>({});

  const refreshFormats = useCallback(() => {
    const sel = document.getSelection();
    // 仅当选中内容处于可编辑区域时更新，避免点击工具栏按钮时被清空样式
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) {
      setFormatState({});
      return;
    }
    const el = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : (sel.anchorNode as Element);
    const inEditable = el?.closest?.('[contenteditable="true"]');
    if (!inEditable) {
      setFormatState({});
      return;
    }
    const fBlock = (document.queryCommandValue('formatBlock') || '').toString().toLowerCase();
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      h1: fBlock === 'h1',
      h2: fBlock === 'h2',
      blockquote: fBlock === 'blockquote',
      pre: fBlock === 'pre',
    });
  }, []);

  // 用 rAF 合并同帧内的多次事件，降低高频重查询开销
  const rafRef = useRef<number | undefined>(undefined);
  const scheduleRefresh = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = undefined;
      refreshFormats();
    });
  }, [refreshFormats]);

  useEffect(() => {
    refreshFormats();
    document.addEventListener('selectionchange', scheduleRefresh, true);
    document.addEventListener('keyup', refreshFormats);
    document.addEventListener('click', refreshFormats);
    return () => {
      document.removeEventListener('selectionchange', scheduleRefresh, true);
      document.removeEventListener('keyup', refreshFormats);
      document.removeEventListener('click', refreshFormats);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [refreshFormats, scheduleRefresh]);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 transition-all',
              canUndo
                ? 'text-muted-foreground hover:text-foreground hover:bg-accent/10 active:bg-primary active:text-primary-foreground'
                : 'text-muted-foreground/40 cursor-not-allowed',
            )}
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="撤销"
          >
            <Undo2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">撤销 (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 transition-all',
              canRedo
                ? 'text-muted-foreground hover:text-foreground hover:bg-accent/10 active:bg-primary active:text-primary-foreground'
                : 'text-muted-foreground/40 cursor-not-allowed',
            )}
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="重做"
          >
            <Redo2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">重做 (Ctrl+Y)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TooltipProvider delayDuration={300}>
        <ToolButton icon={Bold} label="加粗 (Ctrl+B)" command="bold" formatKey="bold" formatState={formatState} />
        <ToolButton icon={Italic} label="斜体 (Ctrl+I)" command="italic" formatKey="italic" formatState={formatState} />
        <ToolButton icon={Underline} label="下划线 (Ctrl+U)" command="underline" formatKey="underline" formatState={formatState} />
        <ToolButton icon={Strikethrough} label="删除线" command="strikeThrough" formatKey="strikeThrough" formatState={formatState} />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolButton icon={Heading1} label="一级标题" command="formatBlock" value="<h1>" formatKey="h1" formatState={formatState} />
        <ToolButton icon={Heading2} label="二级标题" command="formatBlock" value="<h2>" formatKey="h2" formatState={formatState} />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolButton icon={List} label="无序列表" command="insertUnorderedList" formatKey="insertUnorderedList" formatState={formatState} />
        <ToolButton icon={ListOrdered} label="有序列表" command="insertOrderedList" formatKey="insertOrderedList" formatState={formatState} />
        <ToolButton icon={Quote} label="引用" command="formatBlock" value="<blockquote>" formatKey="blockquote" formatState={formatState} />
        <ToolButton icon={Code} label="代码" command="formatBlock" value="<pre>" formatKey="pre" formatState={formatState} />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsertLink();
              }}
              aria-label="插入链接"
            >
              <LinkIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入链接</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsertImage();
              }}
              aria-label="插入图片"
            >
              <ImageIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入图片</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              isPrivate
                ? 'text-warning bg-warning/10 hover:bg-warning/15'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
            )}
            onClick={onTogglePrivate}
            disabled={isDeleted}
            aria-label={isPrivate ? '取消私密' : '标记私密'}
          >
            {isPrivate ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isPrivate ? '取消私密' : '标记私密'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              isEncrypted
                ? 'text-warning hover:text-warning hover:bg-warning/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
            )}
            onClick={onEncrypt}
            disabled={isDeleted}
            aria-label={isEncrypted ? '解锁笔记' : '加密笔记'}
          >
            {isEncrypted ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isEncrypted ? '解锁笔记' : '加密笔记'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              isMarkdownMode
                ? 'text-primary bg-primary/10 hover:bg-primary/15'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
            )}
            onClick={onToggleMarkdownMode}
            disabled={isDeleted}
            aria-label={isMarkdownMode ? '切换到富文本编辑' : '切换到 Markdown 编辑'}
          >
            <FileType className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isMarkdownMode ? '切换到富文本编辑' : '切换到 Markdown 编辑'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
            onClick={onAIClick}
            aria-label="AI 写作助手"
          >
            <Sparkles className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">AI 写作助手</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', showHistory ? 'text-primary bg-primary/10' : 'text-muted-foreground')}
            onClick={onToggleHistory}
            aria-label="历史版本"
          >
            <History className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">历史版本</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? '取消收藏' : '收藏'}
          >
            <Star
              className={cn(
                'size-3.5',
                isFavorite ? 'fill-warning text-warning' : '',
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isFavorite ? '取消收藏' : '收藏'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="更多操作"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {isDeleted ? (
            <DropdownMenuItem onClick={onRestore}>
              <RotateCcw className="size-3.5 mr-2" />
              恢复笔记
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <Undo2 className="size-3.5 mr-2" />
                  移动到...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {notebooks && notebooks.length > 0 ? (
                    notebooks.map((nb) => (
                      <DropdownMenuItem
                        key={nb.id}
                        className="text-xs"
                        onClick={() => {
                          onMoveNotebook?.(nb.id);
                          toast.success(`已移动到「${nb.name}」`);
                        }}
                      >
                        <span className="size-2 rounded-full mr-2" style={{ backgroundColor: nb.color }} />
                        {nb.name}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled className="text-xs">暂无笔记本</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <FileEdit className="size-3.5 mr-2" />
                  导出
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {(
                    [
                      ['markdown', 'Markdown'],
                      ['html', 'HTML'],
                      ['txt', '纯文本'],
                    ] as const
                  ).map(([fmt, label]) => (
                    <DropdownMenuItem
                      key={fmt}
                      className="text-xs"
                      onClick={() => {
                        onExportNote?.(fmt);
                      }}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="size-3.5 mr-2" />
                删除到回收站
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
