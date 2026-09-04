// EXPORTS: IFloatingNote, FLOATING_NOTE_COLORS

export type FloatingNoteType = 'note' | 'todo' | 'quote' | 'text';

export interface IFloatingNote {
  id: string;
  content: string;
  color: string; // color key
  /** 样式类型：便签/待办/引用/纯文本 */
  type?: FloatingNoteType;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0.3 - 1
  minimized: boolean;
  pinned: boolean;
  /** 是否已弹出为独立 OS 窗口（为 true 时不再在画布内渲染） */
  popped?: boolean;
  linkedNoteId?: string; // 关联的主笔记 ID
  createdAt: number;
  updatedAt: number;
}

export interface FloatingNoteColor {
  key: string;
  name: string;
  bg: string;
  header: string;
  border: string;
}

export const FLOATING_NOTE_COLORS: FloatingNoteColor[] = [
  { key: 'yellow', name: '柠檬黄', bg: 'hsl(48 95% 88%)', header: 'hsl(48 85% 78%)', border: 'hsl(48 70% 70%)' },
  { key: 'pink', name: '樱花粉', bg: 'hsl(340 80% 92%)', header: 'hsl(340 70% 82%)', border: 'hsl(340 60% 74%)' },
  { key: 'blue', name: '天空蓝', bg: 'hsl(200 80% 90%)', header: 'hsl(200 70% 78%)', border: 'hsl(200 60% 70%)' },
  { key: 'green', name: '薄荷绿', bg: 'hsl(140 70% 88%)', header: 'hsl(140 60% 76%)', border: 'hsl(140 50% 66%)' },
  { key: 'purple', name: '薰衣草', bg: 'hsl(270 70% 90%)', header: 'hsl(270 60% 78%)', border: 'hsl(270 50% 70%)' },
  { key: 'orange', name: '橙子', bg: 'hsl(28 90% 88%)', header: 'hsl(28 80% 76%)', border: 'hsl(28 70% 66%)' },
  { key: 'white', name: '纯白', bg: 'hsl(0 0% 100%)', header: 'hsl(210 15% 94%)', border: 'hsl(210 10% 82%)' },
];

export const FLOATING_NOTE_DEFAULTS = {
  width: 260,
  height: 220,
  color: 'yellow',
  opacity: 1,
  maxCount: 10,
};

/**
 * 统一便签调色板（便签墙画布 + 浮动便签共用同一套颜色 key）。
 * 每项同时提供 bg（十六进制，供便签墙渲染）与浮动层所需的 hsl 配色。
 */
export interface UnifiedStickyColor {
  key: string;
  name: string;
  hex: string;
  bg: string;
  header: string;
  border: string;
}

export const STICKY_COLORS: UnifiedStickyColor[] = [
  { key: 'yellow', name: '柠檬黄', hex: '#fef3c7', bg: 'hsl(48 95% 88%)', header: 'hsl(48 85% 78%)', border: 'hsl(48 70% 70%)' },
  { key: 'pink', name: '樱花粉', hex: '#fce7f3', bg: 'hsl(340 80% 92%)', header: 'hsl(340 70% 82%)', border: 'hsl(340 60% 74%)' },
  { key: 'blue', name: '天空蓝', hex: '#dbeafe', bg: 'hsl(200 80% 90%)', header: 'hsl(200 70% 78%)', border: 'hsl(200 60% 70%)' },
  { key: 'green', name: '薄荷绿', hex: '#d1fae5', bg: 'hsl(140 70% 88%)', header: 'hsl(140 60% 76%)', border: 'hsl(140 50% 66%)' },
  { key: 'purple', name: '薰衣草', hex: '#ede9fe', bg: 'hsl(270 70% 90%)', header: 'hsl(270 60% 78%)', border: 'hsl(270 50% 70%)' },
  { key: 'orange', name: '橙子', hex: '#ffedd5', bg: 'hsl(28 90% 88%)', header: 'hsl(28 80% 76%)', border: 'hsl(28 70% 66%)' },
  { key: 'white', name: '纯白', hex: '#ffffff', bg: 'hsl(0 0% 100%)', header: 'hsl(210 15% 94%)', border: 'hsl(210 10% 82%)' },
];

export const STICKY_COLOR_KEYS = STICKY_COLORS.map((c) => c.key);

/** 颜色 key → 十六进制背景色（供便签墙渲染） */
export function stickyHexByKey(key?: string): string {
  return STICKY_COLORS.find((c) => c.key === key)?.hex ?? STICKY_COLORS[0].hex;
}

/** 十六进制（旧便签墙数据）→ 颜色 key */
export function stickyKeyByHex(hex?: string): string {
  if (!hex) return STICKY_COLORS[0].key;
  const h = hex.toLowerCase();
  const hit = STICKY_COLORS.find((c) => c.hex.toLowerCase() === h);
  if (hit) return hit.key;
  // 旧的便签墙配色表（IStickyNote）兜底映射
  const legacy: Record<string, string> = {
    '#fef9c3': 'yellow', '#fffbeb': 'yellow',
    '#dcfce7': 'green', '#ccfbf1': 'green',
    '#fce7f3': 'pink', '#fecdd3': 'pink', '#fee2e2': 'pink',
    '#dbeafe': 'blue', '#e0e7ff': 'purple',
    '#ede9fe': 'purple', '#fef3c7': 'yellow',
  };
  return legacy[h] ?? STICKY_COLORS[0].key;
}
