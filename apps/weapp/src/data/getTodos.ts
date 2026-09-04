import type { TodoItem } from '@/types/todo';

const todos: TodoItem[] = [
  { id: 'todo1', title: '完成周报提交', completed: false, dueText: '今天', createTime: Date.now() },
  { id: 'todo2', title: '整理书架书籍分类', completed: false, dueText: '明天', createTime: Date.now() },
  { id: 'todo3', title: '预约体检', completed: false, dueText: '周五', createTime: Date.now() },
  { id: 'todo4', title: '给孩子买生日礼物', completed: true, dueText: '已完成', createTime: Date.now() },
  { id: 'todo5', title: '更新学习计划', completed: true, dueText: '已完成', createTime: Date.now() }
];

export default async function getTodosMock(input: { status?: string } = {}): Promise<{ list: TodoItem[] }> {
  let list = todos;
  if (input.status === 'done') {
    list = todos.filter((t) => t.completed);
  } else if (input.status === 'active') {
    list = todos.filter((t) => !t.completed);
  }
  return { list };
}