/**
 * Reminder Slice - 提醒状态管理
 * 职责：提醒CRUD、提醒历史、节假日弹窗配置
 */
import { StateCreator } from 'zustand';
import type { Reminder, ReminderHistoryEntry, HolidayPopupConfig } from '@/types';
import {
  loadRemindersFromBackend,
  saveReminderToBackend,
  completeReminderToBackend,
  deleteReminderFromBackend,
} from '@/lib/backend';

export const defaultHolidayPopupConfig: HolidayPopupConfig = {
  enabled: true,
  showQuotes: true,
  maxPerDay: 3,
  minIntervalMinutes: 60,
  lastShownAt: null,
  todayCount: 0,
  todayDate: '',
  lastQuoteDate: null,
  quoteIntervalDays: 1,
};

export interface ReminderSlice {
  // State
  reminders: Reminder[];
  reminderHistory: ReminderHistoryEntry[];
  holidayPopupConfig: HolidayPopupConfig;

  // Reminder CRUD
  setReminders: (reminders: Reminder[]) => void;
  /** 从后端 SQLite 加载全部提醒填充 store（非 Tauri 环境静默跳过） */
  fetchReminders: () => Promise<void>;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  completeReminder: (id: string) => void;
  deleteReminder: (id: string) => void;

  // Reminder history
  setReminderHistory: (entries: ReminderHistoryEntry[]) => void;
  clearReminderHistory: () => void;
  recordReminderTrigger: (entry: Omit<ReminderHistoryEntry, 'id'>) => void;

  // Holiday popup
  updateHolidayPopupConfig: (patch: Partial<HolidayPopupConfig>) => void;
  checkAndRecordPopup: () => boolean;
}

// 辅助函数
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeNextTrigger(lastTrigger: number, repeat: string): number {
  const date = new Date(lastTrigger);
  switch (repeat) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return 0;
  }
  return date.getTime();
}

export const createReminderSlice: StateCreator<ReminderSlice> = (set, get) => ({
  // Initial state
  reminders: [],
  reminderHistory: [],
  holidayPopupConfig: defaultHolidayPopupConfig,

  // Reminder CRUD
  setReminders: (reminders) => set({ reminders }),
  fetchReminders: async () => {
    const rows = await loadRemindersFromBackend();
    if (rows) set({ reminders: rows });
  },
  addReminder: (reminder) => {
    set((state) => ({ reminders: [...state.reminders, reminder] }));
    void saveReminderToBackend(reminder);
  },
  updateReminder: (id, updates) => {
    const next = get().reminders.map((r) => (r.id === id ? { ...r, ...updates } : r));
    set({ reminders: next });
    const updated = next.find((r) => r.id === id);
    if (updated) void saveReminderToBackend(updated);
  },
  completeReminder: (id) => {
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, isCompleted: true } : r
      ),
    }));
    void completeReminderToBackend(id);
  },
  deleteReminder: (id) => {
    set((state) => ({ reminders: state.reminders.filter((r) => r.id !== id) }));
    void deleteReminderFromBackend(id);
  },

  // Reminder history
  setReminderHistory: (entries) => set({ reminderHistory: entries }),
  clearReminderHistory: () => set({ reminderHistory: [] }),
  recordReminderTrigger: (entry) => {
    const full: ReminderHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };
    set((state) => ({
      reminderHistory: [full, ...state.reminderHistory].slice(0, 200),
    }));
  },

  // Holiday popup
  updateHolidayPopupConfig: (patch) =>
    set((state) => ({ holidayPopupConfig: { ...state.holidayPopupConfig, ...patch } })),

  checkAndRecordPopup: () => {
    const cfg = get().holidayPopupConfig;
    const now = Date.now();
    const today = todayStr();

    if (!cfg.enabled) return false;

    let currentCount = cfg.todayCount;
    if (cfg.todayDate !== today) {
      currentCount = 0;
    }

    if (currentCount >= cfg.maxPerDay) return false;

    if (cfg.lastShownAt) {
      const elapsedMin = (now - cfg.lastShownAt) / 60_000;
      if (elapsedMin < cfg.minIntervalMinutes) return false;
    }

    set({
      holidayPopupConfig: {
        ...cfg,
        lastShownAt: now,
        todayCount: currentCount + 1,
        todayDate: today,
      },
    });

    return true;
  },
});
