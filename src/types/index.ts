/**
 * 全局类型定义
 * 从 useStore.ts 中抽取，供各 Slice 和组件共享
 */

// === 笔记相关 ===

export interface NoteMetadata {
  password_hint?: string;
  [key: string]: unknown;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId?: string;
  tags: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: NoteMetadata;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  content: string;
  title: string;
  createdAt: string;
  label?: string;
}

export interface Notebook {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
}

// === 便签相关 ===

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// === 提醒相关 ===

export interface Reminder {
  id: string;
  noteId?: string;
  title: string;
  description?: string;
  remindAt: string;
  isCompleted: boolean;
  repeat?: string;
  createdAt: string;
}

// === 私密库相关 ===

export interface VaultItem {
  id: string;
  name: string;
  itemType: string;
  encryptedData: string;
  createdAt: string;
  updatedAt: string;
}

// === 剪贴板相关 ===

export interface ClipboardEntry {
  id: string;
  content: string;
  contentType: string;
  createdAt: string;
}

// === 设置相关 ===

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  backupEnabled: boolean;
  backupInterval: number;
  encryptionEnabled: boolean;
  globalShortcut?: string;
  holidayPopupEnabled?: string;
}

// === 其他 ===

export interface ReminderHistoryEntry {
  id: string;
  reminderId: string;
  noteId?: string;
  noteTitle?: string;
  triggeredAt: number;
  repeat: string;
}

export interface HolidayPopupConfig {
  enabled: boolean;
  showQuotes: boolean;
  maxPerDay: number;
  minIntervalMinutes: number;
  lastShownAt: number | null;
  todayCount: number;
  todayDate: string;
  lastQuoteDate: string | null;
  quoteIntervalDays: number;
}

export interface ShortcutBinding {
  action: string;
  keys: string;
  enabled: boolean;
}

export interface TagColor {
  tag: string;
  color: string;
}
