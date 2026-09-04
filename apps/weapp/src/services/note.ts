import { callFunction } from './cloud';
import type { NoteDetail, NoteItem, PageResult } from '@/types/note';

export interface NoteQuery {
  notebookId?: string;
  keyword?: string;
  pageNo?: number;
  pageSize?: number;
}

export async function getNotes(query: NoteQuery = {}): Promise<PageResult<NoteItem>> {
  return callFunction<PageResult<NoteItem>>('getNotes', query);
}

export async function getNoteDetail(id: string): Promise<NoteDetail> {
  return callFunction<NoteDetail>('getNoteDetail', { id });
}

export async function createNote(input: {
  title: string;
  content: string;
  notebookId?: string;
}): Promise<NoteItem> {
  return callFunction<NoteItem>('createNote', input);
}