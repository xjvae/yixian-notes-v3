import type { ReminderItem } from '@/types/reminder';

const reminders: ReminderItem[] = [
  { id: 'rm1', title: '下午三点喝水提醒', remindAt: Date.now() + 1000 * 60 * 60, done: false },
  { id: 'rm2', title: '提交季度总结', remindAt: Date.now() + 1000 * 60 * 60 * 24, done: false },
  { id: 'rm3', title: '给妈妈打电话', remindAt: Date.now() + 1000 * 60 * 60 * 24 * 2, done: false },
  { id: 'rm4', title: '整理相册', remindAt: Date.now() + 1000 * 60 * 60 * 24 * 3, done: true }
];

export default async function getRemindersMock(): Promise<{ list: ReminderItem[] }> {
  return { list: reminders };
}