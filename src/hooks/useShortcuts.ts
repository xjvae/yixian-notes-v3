// ============================================================
// useShortcuts — 全局快捷键管理 Hook
// ============================================================

import { useEffect, useCallback, useRef } from 'react';

// ── 类型定义 ──

export interface ShortcutDefinition {
  id: string;
  keys: string;
  description: string;
  category: ShortcutCategory;
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
}

export type ShortcutCategory = 'general' | 'editor' | 'navigation' | 'file';

export interface ShortcutConfig {
  overrides: Record<string, string>;
}

export interface ShortcutConflict {
  shortcutId: string;
  keys: string;
  conflictsWith: string[];
}

// ── 工具函数 ──

/** 归一化按键字符串为大写比较 */
export function normalizeKeyString(keys: string): string {
  return keys
    .split('+')
    .map((k) => k.trim().toUpperCase())
    .sort()
    .join('+');
}

/** 将 KeyboardEvent 转换为按键字符串 */
export function eventToKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) parts.push('MOD');
  if (e.altKey) parts.push('ALT');
  if (e.shiftKey) parts.push('SHIFT');

  // 对于字母和数字键，统一为大写
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!['CONTROL', 'ALT', 'SHIFT', 'META', 'MOD'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

/** 格式化按键显示（使用符号表示修饰键） */
export function formatKeyDisplay(keys: string): string {
  return keys
    .split('+')
    .map((k) => {
      const upper = k.trim().toUpperCase();
      if (upper === 'MOD') return isMacOS() ? '⌘' : 'Ctrl';
      if (upper === 'ALT') return isMacOS() ? '⌥' : 'Alt';
      if (upper === 'SHIFT') return isMacOS() ? '⇧' : 'Shift';
      if (upper === 'ENTER') return '↵';
      if (upper === 'ESCAPE') return 'Esc';
      if (upper === 'BACKSPACE') return '⌫';
      if (upper === 'DELETE') return 'Del';
      if (upper === 'TAB') return '⇥';
      if (upper === 'SPACE') return '␣';
      if (upper === 'ARROWUP') return '↑';
      if (upper === 'ARROWDOWN') return '↓';
      if (upper === 'ARROWLEFT') return '←';
      if (upper === 'ARROWRIGHT') return '→';
      if (upper.startsWith('F') && parseInt(upper.slice(1))) return upper;
      return k.trim();
    })
    .join(isMacOS() ? '' : ' + ');
}

function isMacOS(): boolean {
  return typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/** 检查按键组合是否匹配 */
export function matchesShortcut(e: KeyboardEvent, keys: string): boolean {
  const eventStr = eventToKeyString(e);
  const targetStr = normalizeKeyString(keys);
  return eventStr === targetStr;
}

// ── 默认快捷键定义 ──

export const DEFAULT_SHORTCUTS: Record<string, { keys: string; description: string; category: ShortcutCategory }> = {
  // 通用
  'new-note': { keys: 'MOD+N', description: '新建笔记', category: 'general' },
  'save-note': { keys: 'MOD+S', description: '保存笔记', category: 'general' },
  'search': { keys: 'MOD+P', description: '快速搜索', category: 'general' },
  'command-palette': { keys: 'MOD+K', description: '命令面板', category: 'general' },
  'shortcuts-help': { keys: 'MOD+/', description: '快捷键帮助', category: 'general' },
  'settings': { keys: 'MOD+,', description: '打开设置', category: 'general' },

  // 编辑器
  'bold': { keys: 'MOD+B', description: '粗体', category: 'editor' },
  'italic': { keys: 'MOD+I', description: '斜体', category: 'editor' },
  'underline': { keys: 'MOD+U', description: '下划线', category: 'editor' },
  'strikethrough': { keys: 'MOD+SHIFT+S', description: '删除线', category: 'editor' },
  'code': { keys: 'MOD+E', description: '行内代码', category: 'editor' },
  'code-block': { keys: 'MOD+SHIFT+E', description: '代码块', category: 'editor' },
  'link': { keys: 'MOD+L', description: '插入链接', category: 'editor' },
  'undo': { keys: 'MOD+Z', description: '撤销', category: 'editor' },
  'redo': { keys: 'MOD+SHIFT+Z', description: '重做', category: 'editor' },

  // 导航
  'go-notes': { keys: 'MOD+1', description: '跳转到笔记', category: 'navigation' },
  'go-dashboard': { keys: 'MOD+2', description: '跳转到仪表盘', category: 'navigation' },
  'go-calendar': { keys: 'MOD+3', description: '跳转到日历', category: 'navigation' },
  'go-todos': { keys: 'MOD+4', description: '跳转到待办', category: 'navigation' },
  'go-tags': { keys: 'MOD+5', description: '跳转到标签', category: 'navigation' },
  'sidebar-toggle': { keys: 'MOD+\\', description: '切换侧边栏', category: 'navigation' },

  // 文件
  'export-note': { keys: 'MOD+SHIFT+X', description: '导出笔记', category: 'file' },
  'import-note': { keys: 'MOD+SHIFT+I', description: '导入笔记', category: 'file' },
  'print-note': { keys: 'MOD+SHIFT+P', description: '打印笔记', category: 'file' },
  'delete-note': { keys: 'MOD+DELETE', description: '删除笔记', category: 'file' },
  'favorite-note': { keys: 'MOD+D', description: '收藏笔记', category: 'file' },
};

// ── 冲突检测 ──

export function detectConflicts(
  shortcuts: ShortcutDefinition[],
): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const keyMap = new Map<string, string[]>();

  for (const sc of shortcuts) {
    if (sc.enabled === false) continue;
    const normalized = normalizeKeyString(sc.keys);
    const existing = keyMap.get(normalized) || [];
    existing.push(sc.id);
    keyMap.set(normalized, existing);
  }

  for (const [keys, ids] of keyMap) {
    if (ids.length > 1) {
      conflicts.push({
        shortcutId: ids[0],
        keys,
        conflictsWith: ids.slice(1),
      });
    }
  }

  return conflicts;
}

// ── Hook 实现 ──

export function useShortcuts(
  shortcuts: ShortcutDefinition[],
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 如果焦点在输入框中，不拦截大部分快捷键
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;

      // 输入框中只允许撤销/重做等编辑快捷键
      if (isInput && !['undo', 'redo', 'bold', 'italic', 'code'].includes(shortcut.id)) {
        continue;
      }

      if (matchesShortcut(e, shortcut.keys)) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.handler(e);
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}

// ── 单快捷键 Hook ──

export function useShortcut(
  keys: string,
  handler: (e: KeyboardEvent) => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {},
) {
  const { enabled = true, preventDefault = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const listener = (e: KeyboardEvent) => {
      if (matchesShortcut(e, keys)) {
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        handlerRef.current(e);
      }
    };

    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [keys, enabled, preventDefault]);
}

// ── 快捷键配置管理 Hook ──

export function useShortcutConfig() {
  const getConfig = useCallback((): ShortcutConfig => {
    try {
      const stored = localStorage.getItem('yixian-shortcuts-config');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return { overrides: {} };
  }, []);

  const saveConfig = useCallback((config: ShortcutConfig) => {
    localStorage.setItem('yixian-shortcuts-config', JSON.stringify(config));
  }, []);

  const getShortcutKeys = useCallback((id: string): string => {
    const config = getConfig();
    return config.overrides[id] || DEFAULT_SHORTCUTS[id]?.keys || '';
  }, [getConfig]);

  const setShortcutKeys = useCallback((id: string, keys: string) => {
    const config = getConfig();
    config.overrides[id] = keys;
    saveConfig(config);
  }, [getConfig, saveConfig]);

  const resetShortcut = useCallback((id: string) => {
    const config = getConfig();
    delete config.overrides[id];
    saveConfig(config);
  }, [getConfig, saveConfig]);

  const resetAllShortcuts = useCallback(() => {
    saveConfig({ overrides: {} });
  }, [saveConfig]);

  return {
    getConfig,
    saveConfig,
    getShortcutKeys,
    setShortcutKeys,
    resetShortcut,
    resetAllShortcuts,
  };
}
