// 编辑器工具栏组件
//
// 由 TipTap 编辑器实例驱动：所有格式命令通过 editor.chain().focus().xxx() 执行，
// 激活态通过 editor.isActive(...) 计算，不再使用已废弃的 document.execCommand。
// 撤销 / 重做一并走编辑器原生 history。
//
// 包含撤销/重做、格式按钮、插入操作、AI 助手、历史版本、收藏、更多操作。

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
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
  Table as TableIcon,
  ListTodo,
  ListTree,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RemoveFormatting,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Highlighter,
  Minus,
  CalendarPlus,
  Palette,
  CaseSensitive,
  Rows3,
  Columns3,
  Merge,
  TableProperties,
  CodeXml,
  Type,
  MoveVertical,
  ListIndentIncrease,
  ListIndentDecrease,
  Unlink2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
import type { EditorToolbarProps } from './types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// --- 工具函数 ---

/** 返回当前本地日期文本（如 2026-09-08） */
function formatDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- 内部工具按钮：基于 editor.isActive 的激活态 + 命令执行 ---

interface FormatButtonProps {
  icon: typeof Bold;
  label: string;
  /** 是否激活（由 editor.isActive 计算后传入） */
  active: boolean;
  /** 点击时执行命令（已自带 focus()，在 onMouseDown 中 preventDefault 以避免失焦） */
  run: (e: React.MouseEvent) => void;
}

function FormatButton({ icon: Icon, label, active, run }: FormatButtonProps) {
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    run(e);
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 220);
  };

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
}

// 订阅编辑器变更以驱动激活态刷新
function useEditorRefresh(editor: Editor | null, cb: () => void) {
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', cb);
    return () => {
      editor.off('transaction', cb);
    };
  }, [editor, cb]);
}

// --- 工具栏主组件 ---

export default memo(function EditorToolbar({
  editor,
  canUndo,
  canRedo,
  showHistory,
  showToc,
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
  onToggleToc,
  onToggleFavorite,
  onAIClick,
  onInsertLink,
  onInsertImage,
  onInsertTable,
  onInsertTodo,
  onDelete,
  onRestore,
  notebooks,
  onMoveNotebook,
  onExportNote,
}: EditorToolbarProps) {
  // 绑定编辑器变更信号，驱动下面的激活态按钮刷新（重渲染以重新计算 isActive）
  const [tick, setTick] = useState(0);
  useEditorRefresh(
    editor,
    useCallback(() => setTick((t) => t + 1), []),
  );
  void tick;

  // 通用命令包装：先 focus 编辑器，确保选区恢复
  const run = useCallback((fn: (e: Editor) => void) => (e: React.MouseEvent) => {
    if (!editor) return;
    e.preventDefault();
    fn(editor);
  }, [editor]);

  const disabled = !editor || isDeleted || isMarkdownMode;

  return (
    <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1.5 px-3 py-1.5">
      {/* 组1：撤销 / 重做 */}
      <div className="flex items-center gap-0.5">
      {/* 撤销 / 重做（原生历史栈） */}
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
            disabled={!canUndo || isDeleted}
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
            disabled={!canRedo || disabled}
            aria-label="重做"
          >
            <Redo2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">重做 (Ctrl+Y)</TooltipContent>
      </Tooltip>
      </div>

      <div className="min-w-px h-5 bg-border/60" />

      <TooltipProvider delayDuration={300}>
        {/* 组2：行内格式 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        <FormatButton
          icon={Bold}
          label="加粗 (Ctrl+B)"
          active={!!editor?.isActive('bold')}
          run={run((ed) => ed.chain().focus().toggleBold().run())}
        />
        <FormatButton
          icon={Italic}
          label="斜体 (Ctrl+I)"
          active={!!editor?.isActive('italic')}
          run={run((ed) => ed.chain().focus().toggleItalic().run())}
        />
        <FormatButton
          icon={Underline}
          label="下划线 (Ctrl+U)"
          active={!!editor?.isActive('underline')}
          run={run((ed) => ed.chain().focus().toggleUnderline().run())}
        />
        <FormatButton
          icon={Strikethrough}
          label="删除线"
          active={!!editor?.isActive('strike')}
          run={run((ed) => ed.chain().focus().toggleStrike().run())}
        />
        <FormatButton
          icon={SubscriptIcon}
          label="下标"
          active={!!editor?.isActive('subscript')}
          run={run((ed) => ed.chain().focus().toggleSubscript().run())}
        />
        <FormatButton
          icon={SuperscriptIcon}
          label="上标"
          active={!!editor?.isActive('superscript')}
          run={run((ed) => ed.chain().focus().toggleSuperscript().run())}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7',
                    editor?.isActive('highlight') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
                  )}
                  disabled={disabled}
                  aria-label="高亮颜色"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Highlighter className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {(
                  [
                    ['#fde047', '淡黄'],
                    ['#a7f3d0', '淡绿'],
                    ['#bfdbfe', '淡蓝'],
                    ['#fbcfe8', '淡粉'],
                    ['#fed7aa', '淡橙'],
                    ['#e9d5ff', '淡紫'],
                  ] as const
                ).map(([color, label]) => (
                  <DropdownMenuItem key={color} className="flex items-center gap-2 text-xs" onClick={() => editor?.chain().focus().toggleHighlight({ color }).run()}>
                    <span className="size-3 rounded-sm border border-border/50" style={{ backgroundColor: color }} />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().unsetHighlight().run()}>
                  取消高亮
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side="bottom">高亮颜色</TooltipContent>
        </Tooltip>
        <FormatButton
          icon={CodeXml}
          label="行内代码"
          active={!!editor?.isActive('code')}
          run={run((ed) => ed.chain().focus().toggleCode().run())}
        />
        </div>

        {/* 组3：文本样式 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        {/* 文字颜色 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10" disabled={disabled} aria-label="文字颜色">
              <Palette className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {(
              [
                ['#ef4444', '红色'],
                ['#f59e0b', '橙色'],
                ['#eab308', '黄色'],
                ['#22c55e', '绿色'],
                ['#3b82f6', '蓝色'],
                ['#6366f1', '靛蓝'],
                ['#a855f7', '紫色'],
                ['#797c82', '灰色'],
              ] as const
            ).map(([color, label]) => (
              <DropdownMenuItem key={color} className="flex items-center gap-2 text-xs" onClick={() => editor?.chain().focus().setColor(color).run()}>
                <span className="size-3 rounded-full border border-border/50" style={{ backgroundColor: color }} />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().unsetColor().run()}>
              清除颜色
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 更多文本设置（字号 / 字体 / 行高） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              disabled={disabled}
              aria-label="更多文本设置"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <CaseSensitive className="size-3.5 mr-2" />
                字号
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-28">
                {([12, 14, 16, 18, 20, 24, 28, 32] as const).map((size) => (
                  <DropdownMenuItem key={size} className="text-xs" onClick={() => editor?.chain().focus().setFontSize(`${size}px`).run()}>
                    {size}px
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().unsetFontSize().run()}>
                  默认字号
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <Type className="size-3.5 mr-2" />
                字体
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {(
                  [
                    'sans-serif',
                    'serif',
                    'monospace',
                    'cursive',
                    'Georgia, serif',
                    'Verdana, sans-serif',
                    '"Courier New", monospace',
                    'PingFang SC, "Microsoft YaHei", sans-serif',
                  ] as const
                ).map((family) => (
                  <DropdownMenuItem key={family} className="text-xs" onClick={() => editor?.chain().focus().setFontFamily(family).run()}>
                    <span style={{ fontFamily: family }}>{family.split(',')[0].replace(/"/g, '')}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().unsetFontFamily().run()}>
                  默认字体
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <MoveVertical className="size-3.5 mr-2" />
                行高
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-24">
                {([1, 1.25, 1.5, 1.75, 2, 2.5] as const).map((lh) => (
                  <DropdownMenuItem key={lh} className="text-xs" onClick={() => editor?.chain().focus().setLineHeight(String(lh)).run()}>
                    {lh}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().unsetLineHeight().run()}>
                  默认行高
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <FormatButton
          icon={RemoveFormatting}
          label="清除格式（恢复默认样式）"
          active={false}
          run={run((ed) => {
            ed.chain().focus().unsetAllMarks().run();
            // 内联 textStyle（颜色/字号）与块级一律复位为默认段落
            ed.chain().focus().unsetColor().run();
            ed.chain().focus().unsetFontSize().run();
            ed.chain().focus().unsetFontFamily().run();
            ed.chain().focus().unsetLineHeight().run();
            ed.chain().focus().unsetHighlight().run();
            // 块级（标题/列表/引用/代码块等）强制复位为普通段落
            ed.chain().focus().clearNodes().run();
            ed.chain().focus().setParagraph().run();
          })}
        />
        </div>

        {/* 组4：标题 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        <FormatButton
          icon={Heading1}
          label="一级标题"
          active={!!editor?.isActive('heading', { level: 1 })}
          run={run((ed) => ed.chain().focus().toggleHeading({ level: 1 }).run())}
        />
        <FormatButton
          icon={Heading2}
          label="二级标题"
          active={!!editor?.isActive('heading', { level: 2 })}
          run={run((ed) => ed.chain().focus().toggleHeading({ level: 2 }).run())}
        />
        </div>

        {/* 组5：列表与引用 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        <FormatButton
          icon={List}
          label="无序列表"
          active={!!editor?.isActive('bulletList')}
          run={run((ed) => ed.chain().focus().toggleBulletList().run())}
        />
        <FormatButton
          icon={ListOrdered}
          label="有序列表"
          active={!!editor?.isActive('orderedList')}
          run={run((ed) => ed.chain().focus().toggleOrderedList().run())}
        />
        <FormatButton
          icon={Quote}
          label="引用"
          active={!!editor?.isActive('blockquote')}
          run={run((ed) => ed.chain().focus().toggleBlockquote().run())}
        />
        <FormatButton
          icon={Code}
          label="代码块"
          active={!!editor?.isActive('codeBlock')}
          run={run((ed) => ed.chain().focus().toggleCodeBlock().run())}
        />
        {/* 复制当前代码块内容 */}
        <FormatButton
          icon={Copy}
          label="复制代码"
          active={false}
          run={run((ed) => {
            const { state } = ed;
            const depth = state.selection.$from.depth;
            let found: string | null = null;
            for (let d = depth; d >= 0; d -= 1) {
              const node = state.selection.$from.node(d);
              if (node && node.type.name === 'codeBlock') {
                found = node.textContent;
                break;
              }
            }
            if (found == null) return;
            void navigator.clipboard?.writeText(found).then(() => {
              toast('已复制代码到剪贴板');
            }).catch(() => undefined);
          })}
        />
        </div>

        {/* 组6：对齐与缩进 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        {/* 对齐 */}
        <FormatButton
          icon={AlignLeft}
          label="左对齐"
          active={!!editor?.isActive({ textAlign: 'left' })}
          run={run((ed) => ed.chain().focus().setTextAlign('left').run())}
        />
        <FormatButton
          icon={AlignCenter}
          label="居中"
          active={!!editor?.isActive({ textAlign: 'center' })}
          run={run((ed) => ed.chain().focus().setTextAlign('center').run())}
        />
        <FormatButton
          icon={AlignRight}
          label="右对齐"
          active={!!editor?.isActive({ textAlign: 'right' })}
          run={run((ed) => ed.chain().focus().setTextAlign('right').run())}
        />
        <FormatButton
          icon={ListIndentIncrease}
          label="增加缩进（列表嵌套）"
          active={false}
          run={run((ed) => {
            if (ed.isActive('listItem')) {
              ed.chain().focus().sinkListItem('listItem').run();
            }
          })}
        />
        <FormatButton
          icon={ListIndentDecrease}
          label="减少缩进"
          active={false}
          run={run((ed) => {
            if (ed.isActive('listItem')) {
              ed.chain().focus().liftListItem('listItem').run();
            }
          })}
        />
        {/* 移除链接 */}
        <FormatButton
          icon={Unlink2}
          label="移除链接"
          active={!!editor?.isActive('link')}
          run={run((ed) => ed.chain().focus().unsetLink().run())}
        />
        </div>

        {/* 组7：分割线 / 日期 */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onMouseDown={(e) => {
                e.preventDefault();
                if (editor) editor.chain().focus().setHorizontalRule().run();
              }}
              disabled={disabled}
              aria-label="插入分割线"
            >
              <Minus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入分割线</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onMouseDown={(e) => {
                e.preventDefault();
                if (editor) editor.chain().focus().insertContent(formatDate()).run();
              }}
              disabled={disabled}
              aria-label="插入当前日期"
            >
              <CalendarPlus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入当前日期</TooltipContent>
        </Tooltip>
        </div>

        {/* 组8：插入（链接 / 图片 / 表格 / 待办） */}
        <div className="flex items-center gap-0.5"><div className="w-px h-5 bg-border/60 mr-1" />
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
              disabled={disabled}
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
              disabled={disabled}
              aria-label="插入图片"
            >
              <ImageIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入图片</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsertTable();
              }}
              disabled={disabled}
              aria-label="插入表格"
            >
              <TableIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入表格</TooltipContent>
        </Tooltip>
        {/* 表格编辑菜单（光标在表格内时可用） */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7',
                    editor?.isActive('table')
                      ? 'text-primary bg-primary/10 hover:bg-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
                  )}
                  disabled={disabled}
                  aria-label="表格编辑"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <TableProperties className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <div className="px-2 py-1.5 text-[10px] text-muted-foreground">表格编辑（光标需在表格内）</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().addRowBefore().run()}>
                  <Rows3 className="size-3.5 mr-2" />在上方插入行
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().addRowAfter().run()}>
                  <Rows3 className="size-3.5 mr-2" />在下方插入行
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().deleteRow().run()}>
                  <Rows3 className="size-3.5 mr-2" />删除当前行
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().addColumnBefore().run()}>
                  <Columns3 className="size-3.5 mr-2" />在左侧插入列
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().addColumnAfter().run()}>
                  <Columns3 className="size-3.5 mr-2" />在右侧插入列
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().deleteColumn().run()}>
                  <Columns3 className="size-3.5 mr-2" />删除当前列
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().mergeOrSplit().run()}>
                  <Merge className="size-3.5 mr-2" />合并/拆分单元格
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>
                  <TableProperties className="size-3.5 mr-2" />切换表头行
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-destructive" onClick={() => editor?.chain().focus().deleteTable().run()}>
                  <Trash2 className="size-3.5 mr-2" />删除表格
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side="bottom">表格编辑</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsertTodo();
              }}
              disabled={disabled}
              aria-label="插入待办"
            >
              <ListTodo className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">插入待办</TooltipContent>
        </Tooltip>
        </div>
      </TooltipProvider>

      <div className="ml-auto flex items-center gap-0.5" />

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
        <TooltipContent side="bottom">{isPrivate ? '取消私密' : '标记私密'}</TooltipContent>
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
        <TooltipContent side="bottom">{isEncrypted ? '解锁笔记' : '加密笔记'}</TooltipContent>
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
            className={cn(
              'h-7 w-7',
              showToc
                ? 'text-primary bg-primary/10 font-medium'
                : 'text-muted-foreground',
            )}
            onClick={onToggleToc}
            aria-label="目录"
          >
            <ListTree className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">目录（可左右切换）</TooltipContent>
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
            <Star className={cn('size-3.5', isFavorite ? 'fill-warning text-warning' : '')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{isFavorite ? '取消收藏' : '收藏'}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="更多操作">
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
                      onClick={() => onExportNote?.(fmt)}
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