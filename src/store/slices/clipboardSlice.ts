import { StateCreator } from 'zustand';
import type { ClipboardEntry } from '@/types';

/**
 * Clipboard Slice - 剪贴板状态管理
 * 职责：剪贴板历史、添加/删除/清空
 */
export interface ClipboardSlice {
  // State
  clipboardHistory: ClipboardEntry[];

  // Actions
  setClipboardHistory: (entries: ClipboardEntry[]) => void;
  addClipboardEntry: (entry: ClipboardEntry) => void;
  deleteClipboardEntry: (id: string) => void;
  pinClipboardEntry: (id: string) => void;
  clearClipboardHistory: () => void;
}

// 最大历史记录数
const MAX_CLIPBOARD_HISTORY = 100;

export const createClipboardSlice: StateCreator<ClipboardSlice> = (set) => ({
  // Initial state
  clipboardHistory: [],

  // Actions
  setClipboardHistory: (entries) => set({ clipboardHistory: entries }),

  addClipboardEntry: (entry) =>
    set((state) => {
      // 去重：如果已存在相同内容，先移除旧的
      const filtered = state.clipboardHistory.filter(
        (e) => e.content !== entry.content || e.contentType !== entry.contentType
      );
      return {
        clipboardHistory: [entry, ...filtered].slice(0, MAX_CLIPBOARD_HISTORY),
      };
    }),

  deleteClipboardEntry: (id) =>
    set((state) => ({
      clipboardHistory: state.clipboardHistory.filter((e) => e.id !== id),
    })),

  pinClipboardEntry: (id) =>
    set((state) => {
      const entry = state.clipboardHistory.find((e) => e.id === id);
      if (!entry) return state;
      // 取消其他置顶，将此条移到最前
      const others = state.clipboardHistory.filter((e) => e.id !== id);
      return {
        clipboardHistory: [entry, ...others].slice(0, MAX_CLIPBOARD_HISTORY),
      };
    }),

  clearClipboardHistory: () => set({ clipboardHistory: [] }),
});
