/**
 * 主 Store - 纯组合器模式
 * 将各 Slice 组合成一个统一的 Store
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createNotesSlice, type NotesSlice } from './slices/notesSlice';
import { createClipboardSlice, type ClipboardSlice } from './slices/clipboardSlice';
import { createStickiesSlice, type StickiesSlice } from './slices/stickiesSlice';
import { createReminderSlice, type ReminderSlice } from './slices/reminderSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createVaultSlice, type VaultSlice } from './slices/vaultSlice';
import { createQuickSwitchSlice, type QuickSwitchSlice } from './slices/quickSwitchSlice';

// 导出常用类型供组件使用
export type { Note, NoteVersion, Notebook, Reminder, VaultItem } from '@/types';

// 组合所有 Slice 的类型
export type AppState = NotesSlice &
  ClipboardSlice &
  StickiesSlice &
  ReminderSlice &
  SettingsSlice &
  VaultSlice &
  QuickSwitchSlice;

// 默认设置值
const defaultSettings = {
  theme: 'system' as const,
  language: 'zh-CN',
  fontSize: 14,
  autoSave: true,
  autoSaveInterval: 30,
  backupEnabled: false,
  backupInterval: 24,
  encryptionEnabled: false,
  globalShortcut: 'CmdOrCtrl+Shift+N',
};

export const useStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createNotesSlice(...a),
      ...createClipboardSlice(...a),
      ...createStickiesSlice(...a),
      ...createReminderSlice(...a),
      ...createSettingsSlice(...a),
      ...createVaultSlice(...a),
      ...createQuickSwitchSlice(...a),
    }),
    {
      name: 'yixian-notes-storage',
      partialize: (state) => ({
        settings: state.settings,
        activeFilter: state.activeFilter,
        // 保险库条目已由 useVault 以 AES-256-GCM 加密（encryptedData 为密文），
        // 在此仅持久化密文，明文口令/内容永不落盘。
        vaultItems: state.vaultItems,
      }),
    }
  )
);

export { defaultSettings };
