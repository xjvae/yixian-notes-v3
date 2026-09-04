import { callFunction } from './cloud';
import type { ReminderItem } from '@/types/reminder';

export async function getReminders(): Promise<ReminderItem[]> {
  const res = await callFunction<{ list: ReminderItem[] }>('getReminders');
  return res.list;
}