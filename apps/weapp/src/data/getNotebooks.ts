import type { Notebook } from '@/types/notebook';

const notebooks: Notebook[] = [
  { _id: 'nb1', name: '灵感随笔', noteCount: 128, createTime: 1700000000000, updateTime: 1730000000000 },
  { _id: 'nb2', name: '工作项目', noteCount: 64, createTime: 1700000000000, updateTime: 1730000000000 },
  { _id: 'nb3', name: '学习笔记', noteCount: 92, createTime: 1700000000000, updateTime: 1730000000000 },
  { _id: 'nb4', name: '生活记录', noteCount: 46, createTime: 1700000000000, updateTime: 1730000000000 },
  { _id: 'nb5', name: '读书摘录', noteCount: 31, createTime: 1700000000000, updateTime: 1730000000000 }
];

export default async function getNotebooksMock(): Promise<{ list: Notebook[] }> {
  return { list: notebooks };
}