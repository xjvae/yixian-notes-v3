// TipTap 富文本编辑器（核心组件）
//
// 它是一个受控展示组件：编辑器实例（Editor）由父层通过 useEditor 创建并传入，
// 本组件负责将其渲染为带排版样式的可编辑区域。
//
// 对外职责：
//  - 渲染 EditorContent（ProseMirror 挂载点）
//  - 应用 markdown 风格排版样式（标题、引用、代码块、表格、链接、图片、任务列表等）
//  - 支持只读 / 占位 / 空状态提示
//
// 编辑状态、撤销重做、保存等均由父层（EditorPane）统一管理。

import { memo, type RefObject } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  /** 编辑器实例（由父组件 useEditor 创建） */
  editor: Editor | null;
  /** 是否只读（删除/锁定等场景） */
  disabled?: boolean;
  /** 空状态占位提示文案 */
  placeholder?: string;
  /** 挂载占位区的内容（空状态提示，可选） */
  emptyHint?: React.ReactNode;
  /** 暴露外层可滚动容器 ref（可选） */
  containerRef?: RefObject<HTMLDivElement | null>;
}

function RichTextEditorBase({
  editor,
  disabled,
  emptyHint,
  containerRef,
}: RichTextEditorProps) {
  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full min-h-[400px] px-8 py-6',
        disabled && 'opacity-60 pointer-events-none',
      )}
    >
      {emptyHint}
      <EditorContent
        editor={editor}
        className={cn(
          // 排版样式挂载在 `.ProseMirror`，这里只需保证占满与拖尾 padding
          'tiptap-editor prose prose-sm max-w-none',
          'prose-headings:font-bold prose-headings:text-foreground',
          'prose-p:text-foreground prose-p:my-3',
          'prose-ul:my-3 prose-ol:my-3',
          'prose-blockquote:border-l-4 prose-blockquote:border-primary/30',
          'prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:my-4',
          'prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs',
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
          'prose-strong:text-foreground prose-em:text-foreground/80',
        )}
      />
    </div>
  );
}

const RichTextEditor = memo(RichTextEditorBase);
export default RichTextEditor;