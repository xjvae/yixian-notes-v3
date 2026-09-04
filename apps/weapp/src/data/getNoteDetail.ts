import type { NoteItem, NoteDetail } from '@/types/note';
import getNotesMock from './getNotes';

export default async function getNoteDetailMock(input: { id: string }): Promise<NoteDetail> {
  const res = await getNotesMock({ pageSize: 100 });
  const item = res.list.find((n) => n.id === input.id);
  const base: NoteItem = item ?? res.list[0];
  return {
    ...base,
    content:
      `# ${base.title}\n\n这里是「${base.title}」的正文内容。\n\n> 一闲笔记，让灵感随手可得。\n\n- 要点一：清晰记录核心信息\n- 要点二：支持多端同步\n- 要点三：结构化的知识管理\n\n更多内容可在桌面端继续编辑完善。`
  };
}