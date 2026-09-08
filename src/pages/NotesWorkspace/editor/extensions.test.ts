// 编辑器中立的序列化与核心命令单元测试
//
// 直接通过 @tiptap/react 创建 Editor（jsdom），验证：
//  - HTML ⇄ 文档模型的往返（applyHtml / editorHtml）
//  - 空内容判定（isEditorEmpty）
//  - 基础格式命令的激活态（toggleBold / toggleHeading 等）
//
// 注意：同一时刻只存在一个 Editor 实例，避免 ProseMirror 的 keyed plugin（如 history）
// 冲突（"Adding different instances of a keyed plugin"）。

import { Editor } from '@tiptap/react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  buildExtensions,
  applyHtml,
  editorHtml,
  isEditorEmpty,
} from './extensions';

let editor: Editor | null = null;

beforeEach(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({
    element: el,
    extensions: buildExtensions('占位'),
  });
});

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function getEditor(): Editor {
  if (!editor) throw new Error('editor not created');
  return editor;
}

describe('applyHtml / editorHtml 往返', () => {
  it('空内容回退为标准空段落', () => {
    const ed = getEditor();
    expect(ed.getText()).toBe('');
    expect(ed.getJSON().content?.length).toBe(1);
  });

  it('普通段落往返一致', () => {
    const ed = getEditor();
    applyHtml(ed, '<p>你好 <strong>世界</strong></p>');
    const html = editorHtml(ed);
    expect(html).toContain('<strong>世界</strong>');
    expect(html).toContain('你好');
    expect(isEditorEmpty(ed)).toBe(false);
  });

  it('标题 / 列表往返可用', () => {
    const ed = getEditor();
    applyHtml(ed, '<h1>标题一</h1><ul><li><p>项一</p></li></ul>');
    const html = editorHtml(ed);
    expect(html).toMatch(/<h[1-6][^>]*>标题一/);
    expect(html).toMatch(/<ul/);
    expect(html).toMatch(/<li/);
  });

  it('空内容判断：空白文本视为空', () => {
    const ed = getEditor();
    applyHtml(ed, '<p>&nbsp;</p>');
    expect(isEditorEmpty(ed)).toBe(true);
  });
});

describe('格式命令与激活态', () => {
  it('toggleBold 后 isActive(bold) 为真', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('加粗文本').run();
    ed.chain().focus().selectAll().run();
    ed.chain().focus().setBold().run();
    expect(ed.isActive('bold')).toBe(true);
    ed.chain().focus().unsetBold().run();
    expect(ed.isActive('bold')).toBe(false);
  });

  it('toggleHeading 应用标题后可恢复段落', () => {
    const ed = getEditor();
    applyHtml(ed, '<p>标题</p>');
    // 将光标定位到第一段文本，避免全选跨段造成的块级命令歧义
    ed.chain().focus().setTextSelection(1).run();
    ed.chain().focus().toggleHeading({ level: 1 }).run();
    expect(ed.isActive('heading', { level: 1 })).toBe(true);
    ed.chain().focus().setParagraph().run();
    expect(ed.isActive('paragraph')).toBe(true);
  });

  it('setParagraph 能恢复默认段落（原 execCommand 缺位功能）', () => {
    const ed = getEditor();
    applyHtml(ed, '<p>正文</p>');
    ed.chain().focus().setTextSelection(1).run();
    ed.chain().focus().toggleCodeBlock().run();
    expect(ed.isActive('codeBlock')).toBe(true);
    ed.chain().focus().setParagraph().run();
    expect(ed.isActive('paragraph')).toBe(true);
  });

  it('原生内置 undo/redo 可用', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('第一句').run();
    ed.chain().focus().insertContent(' 第二句').run();
    expect(ed.getText()).toContain('第二句');
    ed.commands.undo();
    expect(ed.getText()).not.toContain('第二句');
    ed.commands.redo();
    expect(ed.getText()).toContain('第二句');
  });
});

describe('新增行内/块级扩展命令', () => {
  it('文字颜色与字号可通过文本样式设置', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('带样式文本').selectAll().run();
    ed.chain().focus().setColor('#ef4444').run();
    ed.chain().focus().setFontSize('20px').run();
    const html = editorHtml(ed);
    // 颜色被 DOM 规范化为 rgb(...) 形式，字号保留 px
    expect(html).toContain('rgb(239, 68, 68)');
    expect(html).toContain('font-size: 20px');
    // 清除颜色与字号后回退
    ed.chain().focus().unsetColor().run();
    ed.chain().focus().unsetFontSize().run();
    expect(editorHtml(ed)).not.toContain('rgb(239, 68, 68)');
  });

  it('高亮与上下标激活态可用', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('X2').selectAll().run();
    ed.chain().focus().toggleHighlight({ color: '#fde047' }).run();
    expect(ed.isActive('highlight')).toBe(true);
    ed.chain().focus().selectAll().run();
    ed.chain().focus().toggleSubscript().run();
    expect(ed.isActive('subscript')).toBe(true);
    ed.chain().focus().selectAll().run();
    ed.chain().focus().toggleSuperscript().run();
    expect(ed.isActive('superscript')).toBe(true);
  });

  it('对齐命令 setTextAlign 生效并可复位', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('对齐测试').run();
    ed.chain().focus().setTextAlign('center').run();
    const html = editorHtml(ed);
    expect(html).toContain('center');
    ed.chain().focus().setTextAlign('left').run();
    expect(editorHtml(ed)).not.toContain('center');
  });

  it('清除格式：一键复位标记与对齐', () => {
    const ed = getEditor();
    ed.chain().focus().insertContent('内容').selectAll().run();
    ed.chain().focus().setBold().setColor('#3b82f6').setTextAlign('center').run();
    // 应用后应含样式
    expect(editorHtml(ed)).toMatch(/<strong/);
    ed.chain().focus().unsetAllMarks().run();
    ed.chain().focus().unsetColor().run();
    ed.chain().focus().unsetFontSize().run();
    ed.chain().focus().clearNodes().setParagraph().run();
    ed.chain().focus().setTextAlign('left').run();
    expect(editorHtml(ed)).not.toMatch(/<strong/);
    expect(editorHtml(ed)).not.toContain('rgb(59, 130, 246)');
  });
});