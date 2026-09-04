import type { NoteItem, PageResult } from '@/types/note';

const titles = [
  '晨间闪念：关于专注与心流',
  '本周复盘：项目里程碑回顾',
  '读书笔记：纳瓦尔宝典摘录',
  '旅行清单：云南十日行',
  '高效工作的三个习惯',
  'Node.js 学习路线整理',
  '年度目标拆解与规划',
  '健康饮食记录',
  '产品需求评审要点',
  'React 源码阅读心得',
  '周末露营装备清单',
  '英语单词积累本'
];

const notebooksOf = (i: number) => `nb${(i % 5) + 1}`;

function buildList(): NoteItem[] {
  return titles.map((t, i) => {
    const nbId = notebooksOf(i);
    const nbName = ['灵感随笔', '工作项目', '学习笔记', '生活记录', '读书摘录'][Number(nbId.slice(-1)) - 1];
    return {
      id: `note-${i + 1}`,
      title: t,
      summary: `这是一条关于「${t.replace(/[:：].*$/, '')}」的简短摘要，用于在列表中快速预览内容。`,
      notebookId: nbId,
      notebookName: nbName,
      createTime: Date.now() - i * 1000 * 60 * 60 * 24,
      updateTime: Date.now() - i * 1000 * 60 * 60 * 8,
      pinned: i === 0
    };
  });
}

export default async function getNotesMock(input: {
  notebookId?: string;
  keyword?: string;
  pageNo?: number;
  pageSize?: number;
} = {}): Promise<PageResult<NoteItem>> {
  const pageNo = input.pageNo ?? 1;
  const pageSize = input.pageSize ?? 10;
  let list = buildList();
  if (input.notebookId) {
    list = list.filter((n) => n.notebookId === input.notebookId);
  }
  if (input.keyword) {
    list = list.filter((n) => n.title.includes(input.keyword!));
  }
  const total = list.length;
  const start = (pageNo - 1) * pageSize;
  const paged = list.slice(start, start + pageSize);
  return {
    list: paged,
    pageNo,
    pageSize,
    total,
    hasMore: start + pageSize < total
  };
}