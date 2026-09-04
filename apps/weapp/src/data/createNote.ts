import type { NoteItem } from '@/types/note';

export default function createNoteMock(input: {
  title: string;
  content: string;
  notebookId?: string;
}): Promise<NoteItem> {
  const summary = (input.content || '').slice(0, 60) || input.title;
  return Promise.resolve({
    id: `note-${Date.now()}`,
    title: input.title || '未命名笔记',
    summary,
    notebookId: input.notebookId ?? 'nb1',
    notebookName: '灵感随笔',
    createTime: Date.now(),
    updateTime: Date.now()
  });
}