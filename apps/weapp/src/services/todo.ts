import { callFunction } from './cloud';
import type { TodoItem } from '@/types/todo';

export async function getTodos(status?: string): Promise<TodoItem[]> {
  const res = await callFunction<{ list: TodoItem[] }>('getTodos', { status });
  return res.list;
}

export async function toggleTodo(id: string, completed: boolean): Promise<TodoItem> {
  return callFunction<TodoItem>('toggleTodo', { id, completed });
}