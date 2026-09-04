// ============================================================
// 笔记导入工具函数
// 支持 Markdown / HTML / TXT 文件解析
// ============================================================

import type { INote } from '@/data/notes';
import { genId } from './id';
import { formatBytes } from './format';
import { parseFrontmatter } from './frontmatter';
export { parseFrontmatter };

// ── 类型定义 ──

export type ImportFormat = 'markdown' | 'html' | 'txt' | 'evernote' | 'zip';

export interface ImportOptions {
  format: ImportFormat;
  targetNotebookId?: string;
  tags?: string[];
  conflictMode: 'overwrite' | 'skip' | 'rename';
}

export interface ParsedNote {
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, string>;
}

export interface ImportPreview {
  fileName: string;
  fileSize: number;
  format: ImportFormat;
  notes: ParsedNote[];
  totalCount: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
  notes: INote[];
}

export interface FileValidationResult {
  valid: boolean;
  format?: ImportFormat;
  error?: string;
}

// ── 文件类型检测 ──

export function detectFileFormat(file: File): FileValidationResult {
  const name = file.name.toLowerCase();
  const type = file.type;

  // 根据扩展名检测
  if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.mdown')) {
    return { valid: true, format: 'markdown' };
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return { valid: true, format: 'html' };
  }
  if (name.endsWith('.txt')) {
    return { valid: true, format: 'txt' };
  }
  if (name.endsWith('.enex')) {
    return { valid: true, format: 'evernote' };
  }
  if (name.endsWith('.zip')) {
    return { valid: true, format: 'zip' };
  }

  // 根据 MIME 类型检测
  if (type === 'text/markdown' || type === 'text/x-markdown') {
    return { valid: true, format: 'markdown' };
  }
  if (type === 'text/html') {
    return { valid: true, format: 'html' };
  }
  if (type === 'text/plain') {
    return { valid: true, format: 'txt' };
  }

  return { valid: false, error: '不支持的文件格式，请上传 .md、.html 或 .txt 文件' };
}

// ── 文件读取 ──

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('文件读取失败：内容不是文本'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ── Frontmatter 解析 ──
// parseFrontmatter 现由 ./frontmatter 统一提供（见顶部 import + re-export）

// ── Markdown 文件解析 ──

export function parseMarkdown(content: string, fileName?: string): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(content);

  // 提取标题：优先 frontmatter，其次第一个 # 标题，其次文件名
  let title = frontmatter.title || '';
  let markdownBody = body;

  if (!title) {
    const titleMatch = body.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      markdownBody = body.replace(/^#\s+.+\n*/, '');
    }
  }

  if (!title && fileName) {
    title = fileName.replace(/\.(md|markdown|mdown)$/i, '');
  }

  if (!title) {
    title = '未命名笔记';
  }

  // 提取标签
  const tags: string[] = [];
  if (frontmatter.tags) {
    // 支持 YAML 数组格式: [tag1, tag2] 或逗号分隔
    const tagStr = frontmatter.tags.replace(/[\[\]]/g, '');
    tags.push(...tagStr.split(',').map((t) => t.trim()).filter(Boolean));
  }

  // 解析时间
  const createdAt = frontmatter.created
    ? new Date(frontmatter.created).getTime()
    : Date.now();
  const updatedAt = frontmatter.updated
    ? new Date(frontmatter.updated).getTime()
    : Date.now();

  return {
    title,
    content: markdownBody.trim(),
    tags,
    createdAt,
    updatedAt,
    metadata: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
  };
}

// ── HTML 转 Markdown ──

export function htmlToMarkdown(html: string): string {
  let md = html;

  // 移除 script 和 style 标签及其内容
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

  // 粗体和斜体
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // 代码块
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_match, code) => {
    const decoded = decodeHtmlEntities(code.trim());
    return '```\n' + decoded + '\n```\n\n';
  });

  // 行内代码
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // 链接
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 图片
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // 列表
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');

  // 引用块
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');

  // 分割线
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n');

  // 段落和换行
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // 移除剩余 HTML 标签
  md = md.replace(/<[^>]+>/g, '');

  // 解码 HTML 实体
  md = decodeHtmlEntities(md);

  // 清理多余空行
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

// ── HTML 实体解码 ──

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&laquo;': '«',
    '&raquo;': '»',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // 处理数字实体 &#123;
  result = result.replace(/&#(\d+);/g, (_match, num) => String.fromCharCode(parseInt(num, 10)));

  return result;
}

// ── HTML 文件解析 ──

export function parseHtml(content: string, fileName?: string): ParsedNote {
  // 尝试从 HTML 中提取 title
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  let title = '';
  if (titleMatch) {
    title = stripHtmlTags(titleMatch[1]).trim();
  }
  if (!title && h1Match) {
    title = stripHtmlTags(h1Match[1]).trim();
  }
  if (!title && fileName) {
    title = fileName.replace(/\.(html?)$/i, '');
  }
  if (!title) {
    title = '未命名笔记';
  }

  // 提取 body 内容
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const htmlBody = bodyMatch ? bodyMatch[1] : content;

  // 转换为 Markdown
  const markdown = htmlToMarkdown(htmlBody);

  return {
    title,
    content: markdown,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── 移除 HTML 标签 ──

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

// ── 纯文本解析 ──

export function parsePlainText(content: string, fileName?: string): ParsedNote {
  let title = fileName ? fileName.replace(/\.txt$/i, '') : '未命名笔记';

  // 如果第一行较短，可能是标题
  const lines = content.split('\n');
  if (lines[0] && lines[0].trim().length <= 100 && lines.length > 1) {
    title = lines[0].trim();
    lines.shift();
  }

  return {
    title,
    content: lines.join('\n').trim(),
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── 通用文件解析 ──

// ── Evernote ENEX 解析 ──

function decodeXmlEntities(s: string): string {
  return (s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function stripHtml(s: string): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * 解析 Evernote / 印象笔记导出的 .enex 文件（XML 格式）。
 * 提取每条 <note> 的标题、正文（CDATA 内 HTML 转纯文本）、标签与时间戳。
 */
export function parseEnex(content: string): ParsedNote[] {
  const notes: ParsedNote[] = [];
  const noteRe = /<note\b[^>]*>([\s\S]*?)<\/note>/g;
  let m: RegExpExecArray | null;
  while ((m = noteRe.exec(content)) !== null) {
    const body = m[1];
    const titleM = body.match(/<title>([\s\S]*?)<\/title>/);
    const title = (titleM ? decodeXmlEntities(titleM[1]) : '').trim() || '未命名笔记';

    const contentM = body.match(/<content>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>/);
    const noteContent = stripHtml(contentM ? contentM[1] : '').trim();

    const tags = Array.from(body.matchAll(/<tag>([\s\S]*?)<\/tag>/g)).map((t) => decodeXmlEntities(t[1]).trim()).filter(Boolean);

    const stamp = (re: RegExp) => {
      const s = body.match(re);
      return s ? new Date(decodeXmlEntities(s[1])).getTime() : NaN;
    };
    const createdAt = stamp(/<created>([\s\S]*?)<\/created>/) || Date.now();
    const updatedAt = stamp(/<updated>([\s\S]*?)<\/updated>/) || createdAt;

    notes.push({ title, content: noteContent, tags, createdAt, updatedAt });
  }
  return notes;
}

/**
 * 解析 Zip 压缩包（如 notion 导出的 .zip）：解压出其中的 .md/.txt/.enex 并分别解析。
 */
async function parseZipArchive(file: File): Promise<ParsedNote[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const notes: ParsedNote[] = [];
  const markdownFiles: Array<{ name: string; content: string }> = [];
  const textFiles: Array<{ name: string; content: string }> = [];
  const enexContents: string[] = [];

  const entries = zip.filter((relativePath) => !relativePath.startsWith('__MACOSX') && !relativePath.endsWith('/'));
  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown')) {
      markdownFiles.push({ name: entry.name, content: await entry.async('string') });
    } else if (lower.endsWith('.txt')) {
      textFiles.push({ name: entry.name, content: await entry.async('string') });
    } else if (lower.endsWith('.enex')) {
      enexContents.push(await entry.async('string'));
    }
  }

  markdownFiles.forEach((f) => notes.push(parseMarkdown(f.content, f.name)));
  textFiles.forEach((f) => notes.push(parsePlainText(f.content, f.name)));
  enexContents.forEach((c) => notes.push(...parseEnex(c)));

  if (notes.length === 0) {
    throw new Error('压缩包中未发现可解析的 .md / .txt / .enex 文件');
  }
  return notes;
}

export async function parseFile(file: File): Promise<ImportPreview> {
  const validation = detectFileFormat(file);
  if (!validation.valid || !validation.format) {
    return {
      fileName: file.name,
      fileSize: file.size,
      format: 'markdown',
      notes: [],
      totalCount: 0,
      error: validation.error,
    };
  }

  try {
    if (validation.format === 'zip') {
      const zNotes = await parseZipArchive(file);
      return {
        fileName: file.name,
        fileSize: file.size,
        format: 'zip',
        notes: zNotes,
        totalCount: zNotes.length,
      };
    }
    const content = await readFileAsText(file);
    const format = validation.format;

    let notes: ParsedNote[];

    switch (format) {
      case 'markdown':
        notes = [parseMarkdown(content, file.name)];
        break;
      case 'html':
        notes = [parseHtml(content, file.name)];
        break;
      case 'txt':
        notes = [parsePlainText(content, file.name)];
        break;
      case 'evernote':
        notes = parseEnex(content);
        break;
      default:
        notes = [];
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      format,
      notes,
      totalCount: notes.length,
    };
  } catch (error) {
    return {
      fileName: file.name,
      fileSize: file.size,
      format: validation.format,
      notes: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : '文件解析失败',
    };
  }
}

// ── 批量文件解析 ──

export async function parseMultipleFiles(files: File[]): Promise<ImportPreview[]> {
  const results: ImportPreview[] = [];

  for (const file of files) {
    const preview = await parseFile(file);
    results.push(preview);
  }

  return results;
}

// ── 将解析结果转换为 INote ──

export function parsedNoteToINote(
  parsed: ParsedNote,
  notebookId: string,
  extraTags?: string[],
): INote {
  return {
    id: genId('note', 7),
    title: parsed.title,
    content: parsed.content,
    excerpt: parsed.content.slice(0, 120),
    notebookId,
    tags: [...parsed.tags, ...(extraTags || [])],
    isFavorite: false,
    isDeleted: false,
    isPinned: false,
    sortOrder: Date.now(),
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

// ── 冲突检测 ──

export function checkConflict(
  incoming: ParsedNote,
  existingNotes: INote[],
): { hasConflict: boolean; conflictNote?: INote } {
  const conflict = existingNotes.find(
    (n) => n.title === incoming.title && !n.isDeleted,
  );

  return {
    hasConflict: !!conflict,
    conflictNote: conflict,
  };
}

// ── 生成唯一 ID ──
// id 现由 genId('./id') 统一提供

// ── 文件大小格式化 ──

export function formatFileSize(bytes: number): string {
  return formatBytes(bytes);
}

// ── 格式信息 ──

export const IMPORT_FORMAT_INFO: Record<ImportFormat, { label: string; ext: string; accept: string }> = {
  markdown: { label: 'Markdown', ext: 'md', accept: '.md,.markdown,.mdown' },
  html: { label: 'HTML', ext: 'html', accept: '.html,.htm' },
  txt: { label: '纯文本', ext: 'txt', accept: '.txt' },
  evernote: { label: 'Evernote ENEX', ext: 'enex', accept: '.enex' },
  zip: { label: 'ZIP 压缩包', ext: 'zip', accept: '.zip' },
};
