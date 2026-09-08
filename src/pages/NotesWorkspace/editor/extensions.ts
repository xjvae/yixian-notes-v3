// 富文本编辑器 - 扩展编排与序列化
//
// 统一管理 TipTap 扩展清单，并提供 HTML ⇄ ProseMirror 的序列化辅助，
// 使 `note.content`（HTML 字符串）与编辑器文档模型平滑互转。

import type { Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { History } from '@tiptap/extension-history';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TextAlign } from '@tiptap/extension-text-align';
import {
  TextStyle,
  Color,
  FontSize,
  FontFamily,
  LineHeight,
} from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';

/** 空文档的初始化内容（含一个完好的段落） */
export const EMPTY_HTML = '<p></p>';

/**
 * 富文本编辑器使用的全部扩展。
 * - StarterKit：段落、标题、粗斜体、删除线、列表、引用、代码块、行内代码、分割线等基础能力。
 *   （v3 默认内置 link / underline / history；此处关闭，改由下方显式实例按需加载。）
 * - History：原生撤销 / 重做。
 * - Underline / Link / Image / Table / TaskList：笔记常见的扩展项。
 * - Placeholder：空内容占位提示。
 */
export function buildExtensions(placeholder = '') {
  return [
    StarterKit.configure({
      link: false,
      underline: false,
      undoRedo: false,
      codeBlock: {
        HTMLAttributes: { class: 'tiptap-code-block' },
      },
    }),
    History,
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
        class: 'tiptap-link',
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: 'tiptap-image',
      },
    }),
    Table.configure({
      resizable: true,
      allowTableNodeSelection: true,
      HTMLAttributes: { class: 'tiptap-table' },
    }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList.configure({
      HTMLAttributes: { class: 'tiptap-task-list' },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: 'tiptap-task-item' },
    }),
    // --- 行内样式增强 ---
    TextStyle,
    Color.configure(),
    FontSize.configure({
      types: ['textStyle'],
    }),
    FontFamily.configure({
      types: ['textStyle'],
    }),
    LineHeight.configure({
      types: ['textStyle'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Subscript,
    Superscript,
    // --- 块级对齐（用于段落 / 标题） ---
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    ...(placeholder
      ? [
          Placeholder.configure({
            placeholder,
            includeChildren: true,
          }),
        ]
      : []),
  ];
}

/**
 * 将任意内部 HTML（含 `<p></p>` 或空串）解析进编辑器（ProseMirror 文档模型）。
 * 若为空串，使用标准空段落，保证光标可落位。
 */
export function applyHtml(editor: Editor, html: string | null | undefined): void {
  const safe = html ?? '';
  const normalized = safe.trim().length === 0 ? EMPTY_HTML : safe;
  try {
    editor.commands.setContent(normalized);
  } catch (e) {
    // 极端情况下 HTML 无法解析，回退到空文档，避免编辑器崩溃
    console.error('[RichTextEditor] failed to parse html, fallback to empty.', e);
    editor.commands.setContent(EMPTY_HTML);
  }
}

/** 读取编辑器当前 HTML（始终落回标准空段落，保证可重复解析）。 */
export function editorHtml(editor: Editor): string {
  const html = editor.getHTML();
  if (!html || html.trim().length === 0) return '';
  return html;
}

/** 判定编辑器内容是否为空（不含空白）。 */
export function isEditorEmpty(editor: Editor): boolean {
  const text = editor.getText({ blockSeparator: '' }).replace(/\s/g, '');
  return text.length === 0;
}

/**
 * 将内部 HTML 转换为可用于「Markdown 源码」模式的源码。
 * 复用既有 `noteImport.htmlToMarkdown`，保证与导出/导入生态一致。
 */
export async function htmlToMarkdownSource(html: string): Promise<string> {
  const { htmlToMarkdown } = await import('@/lib/noteImport');
  return htmlToMarkdown(html || '');
}