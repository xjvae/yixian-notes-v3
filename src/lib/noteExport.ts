// ============================================================
// 笔记导出工具函数
// 支持 Markdown / HTML / TXT / PDF 格式
// ============================================================

import type { INote } from '@/data/notes';
import { markdownToHtml } from './markdown';
import { serializeFrontmatter, type FrontmatterData } from './frontmatter';

// ── 类型定义 ──

export type ExportFormat = 'markdown' | 'html' | 'txt' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeFrontmatter?: boolean;
  includeTags?: boolean;
  includeCreatedAt?: boolean;
  includeUpdatedAt?: boolean;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  content: string;
  error?: string;
}

// ── Frontmatter 生成 ──

function generateFrontmatter(note: INote, options: ExportOptions): string {
  const data: FrontmatterData = { title: note.title };

  if (options.includeTags && note.tags.length > 0) {
    data.tags = note.tags;
  }

  if (options.includeCreatedAt && note.createdAt) {
    data.created = note.createdAt;
  }

  if (options.includeUpdatedAt && note.updatedAt) {
    data.updated = note.updatedAt;
  }

  return serializeFrontmatter(data);
}

// ── Markdown → 纯文本 ──
// 说明：Markdown→HTML 转换统一复用 src/lib/markdown.ts 的 markdownToHtml；
// 纯文本提取此处保留一套不依赖 DOM 的正则实现（用于导出 .txt，可在任意环境执行）。

function markdownToPlainText(markdown: string): string {
  let text = markdown;

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split('\n');
    return lines.slice(1, -1).join('\n');
  });

  // 移除行内代码标记
  text = text.replace(/`([^`]+)`/g, '$1');

  // 移除标题标记
  text = text.replace(/^#{1,6} (.+)$/gm, '$1');

  // 移除粗体/斜体标记
  text = text.replace(/\*{1,3}(.+?)\*{1,3}/g, '$1');

  // 移除链接标记，保留文本
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 移除图片
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]');

  // 移除引用标记
  text = text.replace(/^> (.+)$/gm, '$1');

  // 移除列表标记
  text = text.replace(/^[-*] (.+)$/gm, '$1');
  text = text.replace(/^\d+\. (.+)$/gm, '$1');

  // 移除分割线
  text = text.replace(/^---$/gm, '');

  return text.trim();
}

// ── HTML 转义 ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── 生成完整 HTML 文档 ──

function generateFullHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 1.8rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; }
    code { background: #f4f4f4; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding: 0.5rem 1rem; color: #666; }
    img { max-width: 100%; }
    a { color: #0969da; }
    hr { border: none; border-top: 1px solid #eee; margin: 2rem 0; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── 单笔记导出 ──

function exportNote(note: INote, options: ExportOptions): ExportResult {
  const { format } = options;
  const filename = `${sanitizeFilename(note.title)}.${getExtension(format)}`;

  try {
    let content: string;

    switch (format) {
      case 'markdown': {
        const frontmatter = options.includeFrontmatter
          ? generateFrontmatter(note, options) + '\n\n'
          : '';
        content = frontmatter + note.content;
        break;
      }
      case 'html': {
        const body = markdownToHtml(note.content);
        content = generateFullHtml(note.title, body);
        break;
      }
      case 'txt': {
        content = markdownToPlainText(note.content);
        break;
      }
      case 'pdf': {
        // PDF 通过浏览器打印生成，这里返回 HTML 供打印
        const body = markdownToHtml(note.content);
        content = generateFullHtml(note.title, body);
        break;
      }
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }

    return { success: true, filename, content };
  } catch (error) {
    return {
      success: false,
      filename,
      content: '',
      error: error instanceof Error ? error.message : '导出失败',
    };
  }
}

// ── 触发浏览器下载 ──

export function downloadContent(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 导出并下载单笔记 ──

export function exportAndDownload(note: INote, options: ExportOptions): ExportResult {
  const result = exportNote(note, options);

  if (result.success) {
    const mimeMap: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      html: 'text/html',
      txt: 'text/plain',
      pdf: 'text/html',
    };
    downloadContent(result.content, result.filename, mimeMap[options.format]);
  }

  return result;
}

// ── 打印为 PDF（使用浏览器打印） ──

export function printAsPdf(note: INote): void {
  const body = markdownToHtml(note.content);
  const html = generateFullHtml(note.title, body);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // 等待内容加载后触发打印
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

// ── 工具函数 ──

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100) || 'untitled';
}

function getExtension(format: ExportFormat): string {
  const map: Record<ExportFormat, string> = {
    markdown: 'md',
    html: 'html',
    txt: 'txt',
    pdf: 'html',
  };
  return map[format];
}

// ── 格式信息 ──

export const EXPORT_FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; desc: string }> = {
  markdown: { label: 'Markdown', ext: 'md', desc: '纯文本标记格式，保留所有语法' },
  html: { label: 'HTML', ext: 'html', desc: '网页格式，可在浏览器中查看' },
  txt: { label: '纯文本', ext: 'txt', desc: '去除所有格式，仅保留文字' },
  pdf: { label: 'PDF', ext: 'pdf', desc: '通过浏览器打印生成 PDF' },
};
