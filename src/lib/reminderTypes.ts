// 提醒系统类型定义
// 用于笔记和便签的提醒功能

/** 重复频率 */
export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

/** 提醒记录（用于笔记或便签） */
export interface Reminder {
  /** 唯一 ID */
  id: string;
  /** 关联的目标类型：笔记或便签 */
  targetType: "note" | "sticky";
  /** 关联的目标 ID（笔记 id 或便签 id） */
  targetId: string;
  /** 目标标题（冗余存储，方便提醒历史中展示，即使原目标被删除也能看到） */
  targetTitle: string;
  /** 提醒时间（时间戳，毫秒） */
  remindAt: number;
  /** 重复频率 */
  repeat: ReminderRepeat;
  /** 是否已启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 上次触发时间（用于去重，避免同一提醒在同一个检查周期内重复触发） */
  lastTriggeredAt?: number | null;
}

/** 提醒历史记录 */
export interface ReminderHistoryEntry {
  /** 唯一 ID */
  id: string;
  /** 提醒标题 */
  title: string;
  /** 目标类型 */
  targetType: "note" | "sticky";
  /** 目标 ID */
  targetId: string;
  /** 触发时间 */
  triggeredAt: number;
  /** 重复频率 */
  repeat: ReminderRepeat;
}

/** 节假日弹窗显示频率控制配置 */
export interface HolidayPopupConfig {
  /** 是否启用节假日弹窗 */
  enabled: boolean;
  /** 每日最多弹窗次数 */
  maxPerDay: number;
  /** 弹窗间隔最小分钟数（避免频繁打扰） */
  minIntervalMinutes: number;
  /** 上次弹窗时间 */
  lastShownAt?: number | null;
  /** 今日已弹窗次数 */
  todayCount: number;
  /** 今日日期（YYYY-MM-DD，用于重置计数） */
  todayDate: string;
  /** 是否显示温馨语录（非节假日也随机展示） */
  showQuotes: boolean;
  /** 温馨语录显示频率（每 N 天一次） */
  quoteIntervalDays: number;
  /** 上次显示语录的日期 */
  lastQuoteDate?: string | null;
}

/** 默认弹窗频率配置 */
export const defaultHolidayPopupConfig: HolidayPopupConfig = {
  enabled: true,
  maxPerDay: 3,
  minIntervalMinutes: 60,
  lastShownAt: null,
  todayCount: 0,
  todayDate: "",
  showQuotes: true,
  quoteIntervalDays: 1,
  lastQuoteDate: null,
};
