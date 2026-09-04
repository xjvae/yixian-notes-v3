import type { TodoItem } from '@/types/todo';

export default async function toggleTodoMock(input: {
  id: string;
  completed: boolean;
}): Promise<TodoItem> {
  return {
    id: input.id,
    title: '待办事项',
    completed: input.completed,
    createTime: Date.now()
  };
}