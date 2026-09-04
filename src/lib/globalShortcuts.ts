// ============================================================
// globalShortcuts — 全局快捷键前端配置工具
//
// 全局快捷键（应用外也能触发的弹窗类操作）的用户配置权威保存在
// 前端设置 localStorage["yixian_settings"].globalShortcuts。
// 通过后端命令 apply_global_shortcuts 实时注册/覆盖系统全局热键。
// ============================================================

export interface GlobalShortcut {
  action: string;
  key: string; // 组合键如 "Ctrl+Shift+N"，或 "DoubleCtrl" 表示双击 Ctrl
  enabled: boolean;
}

export interface GlobalShortcutDef {
  action: string;
  name: string;
  desc: string;
  defaultKey: string;
  canDouble?: boolean; // 是否可用"双击 Ctrl"作为值
}

export const GLOBAL_SHORTCUT_DEFS: GlobalShortcutDef[] = [
  { action: 'local-search', name: '本地搜索', desc: '桌面任意位置唤起本地文件搜索', defaultKey: 'DoubleCtrl', canDouble: true },
  { action: 'new-note', name: '新建笔记', desc: '脱离主窗口快捷新建一篇笔记', defaultKey: 'Ctrl+Shift+N' },
  { action: 'quick-open', name: '快速打开', desc: '跨对象搜索并打开', defaultKey: 'Ctrl+Shift+P' },
  { action: 'clipboard', name: '剪贴板', desc: '快速查看/复制剪贴板历史', defaultKey: 'Ctrl+Shift+V' },
];

export function defaultGlobalShortcuts(): GlobalShortcut[] {
  return GLOBAL_SHORTCUT_DEFS.map((d) => ({ action: d.action, key: d.defaultKey, enabled: true }));
}

/** 从持久化设置读取全局快捷键配置；缺省时给出默认值 */
export function readGlobalShortcuts(): GlobalShortcut[] {
  try {
    const raw = JSON.parse(localStorage.getItem('yixian_settings') || '{}');
    if (Array.isArray((raw as { globalShortcuts?: unknown }).globalShortcuts)) {
      const list = (raw as { globalShortcuts: GlobalShortcut[] }).globalShortcuts;
      // 与定义表对齐：缺失的 action 补默认，多余的忽略
      return GLOBAL_SHORTCUT_DEFS.map((d) => {
        const found = list.find((it) => it.action === d.action);
        return found && found.key ? { ...found } : { action: d.action, key: d.defaultKey, enabled: true };
      });
    }
  } catch {
    /* ignore */
  }
  return defaultGlobalShortcuts();
}

/** 写入持久化设置 */
export function writeGlobalShortcuts(items: GlobalShortcut[]): void {
  try {
    const raw = JSON.parse(localStorage.getItem('yixian_settings') || '{}');
    (raw as { globalShortcuts?: GlobalShortcut[] }).globalShortcuts = items;
    localStorage.setItem('yixian_settings', JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

/** 应用一组全局快捷键到后端（实时注册热键） */
export async function applyGlobalShortcuts(items: GlobalShortcut[]): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('apply_global_shortcuts', { shortcuts: items });
}

/** 把按键事件解析为标准组合键串（如 Ctrl+Shift+N / F8 / Backspace） */
export function eventToGlobalKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mods: [boolean, string][] = [
    [e.ctrlKey, 'Ctrl'],
    [e.altKey, 'Alt'],
    [e.shiftKey, 'Shift'],
    [e.metaKey, 'Meta'],
  ];
  for (const [on, label] of mods) if (on) parts.push(label);
  const key = e.key;
  const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(key);
  if (!isModifier && key && key.length > 0) {
    parts.push(key.length === 1 ? key.toUpperCase() : primaryName(key));
  }
  return parts.join('+');
}

function primaryName(key: string): string {
  const map: Record<string, string> = {
    ' ': 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc',
    Backspace: 'Backspace', Delete: 'Delete', ArrowUp: 'Up', ArrowDown: 'Down',
    ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End',
    ',': 'Comma', '.': 'Period', '/': 'Slash', '\\': 'Backslash', '-': 'Minus', '=': 'Equal',
    '[': 'BracketLeft', ']': 'BracketRight', ';': 'Semicolon', "'": 'Quote', '`': 'Backquote',
  };
  return map[key] || key;
}