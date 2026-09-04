// ============================================================
// Frontmatter 序列化 / 解析
// 统一 noteExport（生成）与 noteImport（解析）双向实现，避免各写一套。
// ============================================================

export interface FrontmatterData {
  title?: string;
  tags?: string[];
  created?: number;
  updated?: number;
  [key: string]: unknown;
}

export interface ParseFrontmatterResult {
  frontmatter: Record<string, string>;
  body: string;
}

/** 解析 markdown 开头的 YAML frontmatter */
export function parseFrontmatter(content: string): ParseFrontmatterResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
  const body = match[2];
  const frontmatter: Record<string, string> = {};

  for (const line of frontmatterText.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/** 生成 markdown frontmatter 文本（含首尾 ---） */
export function serializeFrontmatter(data: FrontmatterData): string {
  const lines: string[] = ['---'];

  if (data.title) lines.push(`title: ${data.title}`);
  if (data.tags && data.tags.length > 0) {
    lines.push(`tags: [${data.tags.join(', ')}]`);
  }
  if (data.created) lines.push(`created: ${new Date(data.created).toISOString()}`);
  if (data.updated) lines.push(`updated: ${new Date(data.updated).toISOString()}`);
  for (const key of Object.keys(data)) {
    if (key !== 'title' && key !== 'tags' && key !== 'created' && key !== 'updated') {
      const v = data[key];
      if (v != null) lines.push(`${key}: ${String(v)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}