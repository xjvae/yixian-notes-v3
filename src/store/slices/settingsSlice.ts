/**
 * Settings Slice - 应用设置状态管理
 * 职责：应用设置、自定义快捷键、标签颜色
 */
import { StateCreator } from 'zustand';
import type { AppSettings, ShortcutBinding, TagColor } from '@/types';

export interface SettingsSlice {
  // State
  settings: AppSettings;
  customShortcuts: ShortcutBinding[];
  tagColors: TagColor[];
  activeFilter: string;

  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Shortcut actions
  setCustomShortcuts: (shortcuts: ShortcutBinding[]) => void;
  setCustomShortcut: (action: string, keys: string) => void;
  toggleShortcut: (action: string, enabled: boolean) => void;

  // Tag color actions
  setTagColors: (colors: TagColor[]) => void;
  setTagColor: (tag: string, color: string) => void;

  // Filter actions
  setActiveFilter: (filter: string) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  // Initial state
  settings: {
    theme: 'system',
    language: 'zh-CN',
    fontSize: 14,
    autoSave: true,
    autoSaveInterval: 30,
    backupEnabled: false,
    backupInterval: 24,
    encryptionEnabled: false,
    globalShortcut: 'CmdOrCtrl+Shift+N',
  },
  customShortcuts: [],
  tagColors: [],
  activeFilter: 'all',

  // Settings actions
  updateSettings: (newSettings) =>
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  // Shortcut actions
  setCustomShortcuts: (shortcuts) => set({ customShortcuts: shortcuts }),
  setCustomShortcut: (action, keys) =>
    set((state) => {
      const existing = state.customShortcuts;
      const next = existing.some((s) => s.action === action)
        ? existing.map((s) => (s.action === action ? { ...s, keys } : s))
        : [...existing, { action, keys, enabled: true }];
      return { customShortcuts: next };
    }),
  toggleShortcut: (action, enabled) =>
    set((state) => ({
      customShortcuts: state.customShortcuts.map((s) =>
        s.action === action ? { ...s, enabled } : s
      ),
    })),

  // Tag color actions
  setTagColors: (colors) => set({ tagColors: colors }),
  setTagColor: (tag, color) =>
    set((state) => {
      const existing = state.tagColors;
      const next = existing.some((t) => t.tag === tag)
        ? existing.map((t) => (t.tag === tag ? { tag, color } : t))
        : [...existing, { tag, color }];
      return { tagColors: next };
    }),

  // Filter actions
  setActiveFilter: (filter) => set({ activeFilter: filter }),
});
