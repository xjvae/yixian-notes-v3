// 笔记本类型
export interface Notebook {
  _id: string;
  name: string;
  cover?: string;
  noteCount: number;
  createTime: number;
  updateTime: number;
}