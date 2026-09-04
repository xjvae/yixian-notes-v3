import { callFunction } from './cloud';
import type { Notebook } from '@/types/notebook';

export async function getNotebooks(): Promise<Notebook[]> {
  const res = await callFunction<{ list: Notebook[] }>('getNotebooks');
  return res.list;
}

export async function createNotebook(name: string, cover?: string): Promise<Notebook> {
  return callFunction<Notebook>('createNotebook', { name, cover });
}

export async function getStats(): Promise<{
  noteCount: number;
  notebookCount: number;
  todoCount: number;
  reminderCount: number;
}> {
  return callFunction('getStats');
}