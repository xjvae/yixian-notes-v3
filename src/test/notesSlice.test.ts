/**
 * Notes Slice 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createNotesSlice } from '@/store/slices/notesSlice'
import type { Note, Notebook } from '@/types'

// 模拟 Zustand 的 set 和 get 函数
function createMockSetGet() {
  let state: Record<string, unknown> = {}
  const set = (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
    if (typeof partial === 'function') {
      state = { ...state, ...partial(state) }
    } else {
      state = { ...state, ...partial }
    }
  }
  const get = () => state
  return { set, get, state }
}

describe('notesSlice', () => {
  let set: (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
  let get: () => Record<string, unknown>
  let state: Record<string, unknown>

  beforeEach(() => {
    const mock = createMockSetGet()
    set = mock.set
    get = mock.get
    state = mock.state
    Object.assign(state, createNotesSlice(set as never, get as never))
  })

  describe('notes operations', () => {
    it('should initialize with empty notes array', () => {
      expect(get().notes).toEqual([])
    })

    it('should add a note', () => {
      const note: Note = {
        id: '1',
        title: 'Test Note',
        content: 'Test Content',
        tags: [],
        isFavorite: false,
        isEncrypted: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().addNote(note)
      expect(get().notes).toHaveLength(1)
      expect(get().notes[0]).toEqual(note)
    })

    it('should update a note', () => {
      const note: Note = {
        id: '1',
        title: 'Test Note',
        content: 'Original',
        tags: [],
        isFavorite: false,
        isEncrypted: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().addNote(note)
      get().updateNote('1', { content: 'Updated' })
      expect(get().notes[0].content).toBe('Updated')
      expect(get().notes[0].updatedAt).not.toBe('2024-01-01')
    })

    it('should delete a note', () => {
      const note1: Note = {
        id: '1',
        title: 'Note 1',
        content: 'Content 1',
        tags: [],
        isFavorite: false,
        isEncrypted: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      const note2: Note = {
        id: '2',
        title: 'Note 2',
        content: 'Content 2',
        tags: [],
        isFavorite: false,
        isEncrypted: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().setNotes([note1, note2])
      get().deleteNote('1')
      expect(get().notes).toHaveLength(1)
      expect(get().notes[0].id).toBe('2')
    })

    it('should clear activeNoteId when deleting active note', () => {
      const note: Note = {
        id: '1',
        title: 'Test Note',
        content: 'Content',
        tags: [],
        isFavorite: false,
        isEncrypted: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().addNote(note)
      get().setActiveNoteId('1')
      expect(get().activeNoteId).toBe('1')
      get().deleteNote('1')
      expect(get().activeNoteId).toBeNull()
    })
  })

  describe('notebook operations', () => {
    it('should initialize with empty notebooks array', () => {
      expect(get().notebooks).toEqual([])
    })

    it('should add a notebook', () => {
      const notebook: Notebook = {
        id: 'nb1',
        name: 'Work',
        sortOrder: 0,
        createdAt: '2024-01-01',
      }
      get().addNotebook(notebook)
      expect(get().notebooks).toHaveLength(1)
      expect(get().notebooks[0]).toEqual(notebook)
    })

    it('should update a notebook', () => {
      const notebook: Notebook = {
        id: 'nb1',
        name: 'Work',
        sortOrder: 0,
        createdAt: '2024-01-01',
      }
      get().addNotebook(notebook)
      get().updateNotebook('nb1', { name: 'Personal' })
      expect(get().notebooks[0].name).toBe('Personal')
    })

    it('should delete a notebook', () => {
      const notebook1: Notebook = {
        id: 'nb1',
        name: 'Work',
        sortOrder: 0,
        createdAt: '2024-01-01',
      }
      const notebook2: Notebook = {
        id: 'nb2',
        name: 'Personal',
        sortOrder: 1,
        createdAt: '2024-01-01',
      }
      get().setNotebooks([notebook1, notebook2])
      get().deleteNotebook('nb1')
      expect(get().notebooks).toHaveLength(1)
      expect(get().notebooks[0].id).toBe('nb2')
    })
  })

  describe('search operations', () => {
    it('should set search query', () => {
      get().setSearchQuery('test query')
      expect(get().searchQuery).toBe('test query')
    })

    it('should set active note id', () => {
      get().setActiveNoteId('note-123')
      expect(get().activeNoteId).toBe('note-123')
    })

    it('should set active notebook id', () => {
      get().setActiveNotebookId('nb-456')
      expect(get().activeNotebookId).toBe('nb-456')
    })
  })
})
