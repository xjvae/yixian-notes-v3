import { StateCreator } from 'zustand';
import type { StickyNote } from '@/types';

/**
 * Stickies Slice - 便签状态管理
 * 职责：便签CRUD、位置/尺寸管理
 */
export interface StickiesSlice {
  // State
  stickyNotes: StickyNote[];

  // Actions
  setStickyNotes: (stickies: StickyNote[]) => void;
  addSticky: (sticky: StickyNote) => void;
  updateSticky: (id: string, updates: Partial<StickyNote>) => void;
  deleteSticky: (id: string) => void;

  // 批量操作
  updateStickyPosition: (id: string, x: number, y: number) => void;
  updateStickySize: (id: string, width: number, height: number) => void;
  toggleStickyPin: (id: string) => void;
}

export const createStickiesSlice: StateCreator<StickiesSlice> = (set) => ({
  // Initial state
  stickyNotes: [],

  // CRUD actions
  setStickyNotes: (stickies) => set({ stickyNotes: stickies }),

  addSticky: (sticky) => set((state) => ({ stickyNotes: [...state.stickyNotes, sticky] })),

  updateSticky: (id, updates) =>
    set((state) => ({
      stickyNotes: state.stickyNotes.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
    })),

  deleteSticky: (id) =>
    set((state) => ({ stickyNotes: state.stickyNotes.filter((s) => s.id !== id) })),

  // 批量操作
  updateStickyPosition: (id, x, y) =>
    set((state) => ({
      stickyNotes: state.stickyNotes.map((s) =>
        s.id === id ? { ...s, x, y, updatedAt: new Date().toISOString() } : s
      ),
    })),

  updateStickySize: (id, width, height) =>
    set((state) => ({
      stickyNotes: state.stickyNotes.map((s) =>
        s.id === id ? { ...s, width, height, updatedAt: new Date().toISOString() } : s
      ),
    })),

  toggleStickyPin: (id) =>
    set((state) => ({
      stickyNotes: state.stickyNotes.map((s) =>
        s.id === id ? { ...s, isPinned: !s.isPinned, updatedAt: new Date().toISOString() } : s
      ),
    })),
});
