// 笔记类型
export interface NoteItem {
  id: string;
  title: string;
  summary: string;
  notebookId: string;
  notebookName?: string;
  createTime: number;
  updateTime: number;
  pinned?: boolean;
}

export interface NoteDetail extends NoteItem {
  content: string;
}

export interface PageResult<T> {
  list: T[];
  pageNo: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}