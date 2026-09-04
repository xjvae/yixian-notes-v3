// 提醒类型
export interface ReminderItem {
  id: string;
  title: string;
  remindAt: number;
  done: boolean;
  note?: string;
}