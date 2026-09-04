// ============================================================
// 文本处理工具：HTML 剥离、摘要、字数统计
// ============================================================

export interface StripHtmlOptions {
  /** 普通标签去除后替换的字符，默认 '' */
  replace?: string;
  /** 是否把换行标签（br/p/div/li 等）换算为 '\n' */
  keepNewline?: boolean;
}

const NEWLINE_TAGS = /<\s*(br|hr|p|div|li|tr|h[1-6]|blockquote)\b[^>]*>/gi;

/**
 * 去除 HTML 标签得到纯文本，统一处理 &nbsp; 等实体。
 * 替代全项目 14 处手写 `replace(/<[^>]+>/g, ...)`。
 */
export function stripHtmlToText(html: string, options: StripHtmlOptions = {}): string {
  const { replace = '', keepNewline = false } = options;
  let text = html ?? '';
  if (keepNewline) {
    text = text.replace(NEWLINE_TAGS, '\n');
  }
  text = text
    .replace(/<[^>]+>/g, replace)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  if (keepNewline) {
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }
  return text;
}

export interface ExcerptOptions {
  ellipsis?: boolean;
  whitespace?: boolean;
}

/**
 * 统一截取摘要：压缩空白 + 按 max 截断 + 可选省略符。
 * 替代各页面 `.slice(0,80)` / `.slice(0,120)` 的不一致实现。
 */
export function plainTextToExcerpt(text: string, max = 80, options: ExcerptOptions = {}): string {
  const { ellipsis = true, whitespace = true } = options;
  const src = whitespace ? (text ?? '').replace(/\s+/g, ' ').trim() : text ?? '';
  if (src.length <= max) return src;
  return src.slice(0, max) + (ellipsis ? '...' : '');
}

export type CountMode = 'char' | 'word';

/**
 * 统一字数统计口径。
 * - 'char'：去掉所有空白后的字符数（中文场景）。
 * - 'word'：按空白分词后的词数。
 */
export function countChars(plain: string, mode: CountMode = 'char'): number {
  if (mode === 'word') {
    return (plain ?? '').trim().split(/\s+/).filter(Boolean).length;
  }
  return (plain ?? '').replace(/\s/g, '').length;
}