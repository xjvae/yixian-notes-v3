/**
 * QuickSwitch Slice - 快速切换窗口状态
 * 职责：快速切换窗口的开关状态
 */
import { StateCreator } from 'zustand';

export interface QuickSwitchSlice {
  // State
  quickSwitchOpen: boolean;

  // Actions
  setQuickSwitchOpen: (open: boolean) => void;
  toggleQuickSwitch: () => void;
}

export const createQuickSwitchSlice: StateCreator<QuickSwitchSlice> = (set) => ({
  // Initial state
  quickSwitchOpen: false,

  // Actions
  setQuickSwitchOpen: (open) => set({ quickSwitchOpen: open }),
  toggleQuickSwitch: () => set((state) => ({ quickSwitchOpen: !state.quickSwitchOpen })),
});
