import type { Notebook } from '@/types/notebook';

export default async function createNotebookMock(input: {
  name: string;
  cover?: string;
}): Promise<Notebook> {
  return {
    _id: `nb-${Date.now()}`,
    name: input.name,
    cover: input.cover,
    noteCount: 0,
    createTime: Date.now(),
    updateTime: Date.now()
  };
}