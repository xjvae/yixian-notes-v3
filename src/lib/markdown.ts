// ============================================================
// Markdown 转换工具
//
// 编辑器在「所见即所得」与「Markdown 源码」模式间切换时，
// 需要 HTML ↔ Markdown 双向转换。这里汇集两个方向的转换函数：
//   - htmlToMarkdown：复用 noteImport 中已有的实现
//   - markdownToHtml：将 Markdown 源码转换为编辑器可存储的 HTML
// ============================================================

import { htmlToMarkdown } from './noteImport';

export { htmlToMarkdown };

/** HTML 实体转换（用于代码内容转义/反转义） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * 将 Markdown 源码转换为 HTML 字符串。
 *
 * 这是一套轻量自包含的正则实现，覆盖笔记编辑的常见语法
 * （标题、粗斜体、代码块、行内代码、链接、图片、列表、引用、分割线、表格、任务列表）。
 * 不引入额外依赖，避免破坏性依赖/安全风险。
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;
  const safe = (s: string) => unescapeHtml(s);

  // ── 代码块（优先处理，避免内部被其他规则影响）──
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const langAttr = lang ? ` class="language-${lang}" data-lang="${lang}"` : '';
    return `<pre style="background:var(--muted);padding:12px;border-radius:6px;font-family:monospace;font-size:13px;overflow-x:auto"><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
  });

  // ── 表格（优先处理，避免 `|` 与其它规则冲突）──
  html = html.replace(/^\|(.+)\|[\s\S]*?^\|(.+)\|$/m, (block) => {
    const lines = block.split('\n');
    let header = '';
    let rows = '';
    lines.forEach((line, idx) => {
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (idx === 0) {
        header = cells.map((c) => `<th>${safe(c)}</th>`).join('');
      } else if (idx === 1 || (cells[0] && /^:?-{2,}:?$/.test(cells[0]))) {
        // 分隔行：忽略
      } else {
        rows += `<tr>${cells.map((c) => `<td>${safe(c)}</td>`).join('')}</tr>`;
      }
    });
    return `<table style="border-collapse:collapse;width:100%;margin:8px 0;border:1px solid var(--border)"><tr style="background:var(--muted)">${header}</tr>${rows}</table>`;
  });

  // ── 行内代码 ──
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // ── 任务列表 ──
  html = html.replace(/^\s*- \[([ xX])\]\s+(.+)$/gm, (_m, checked: string, text: string) => {
    const isChecked = checked === 'x' || checked === 'X';
    return `<div style="display:flex;align-items:center;gap:6px"><input type="checkbox" ${isChecked ? 'checked ' : ''}/> <span>${safe(text)}</span></div>`;
  });

  // ── 标题 ──
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // ── 粗体和斜体 ──
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // ── 删除线 ──
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // ── 图片（优先于链接）──
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:6px" />');

  // ── 链接 ──
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // ── 无序列表 / 有序列表（转换为 ul/ol）──
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match.trim()}</ul>`);
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ol>${match.trim()}</ol>`);

  // ── 引用块 ──
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // ── 分割线 ──
  html = html.replace(/^---+$/gm, '<hr />');

  // ── 段落（空行分隔）──
  html = html.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h') || trimmed.startsWith('<pre') ||
      trimmed.startsWith('<ul') || trimmed.startsWith('<ol') ||
      trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr') ||
      trimmed.startsWith('<div') || trimmed.startsWith('<table') ||
      trimmed.startsWith('<li')
    ) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
  }).join('\n');

  return html.trim();
}

/**
 * 从 Markdown 源码提取纯文本（用于字数统计 / 摘要）。
 */
export function markdownToPlainText(markdown: string): string {
  const html = markdownToHtml(markdown);
  // 在 DOM 中渲染以提取纯文本（兼容 SSR 场景则回退到标签剥离）
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent || '';
  }
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}