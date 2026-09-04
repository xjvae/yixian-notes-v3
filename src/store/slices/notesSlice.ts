import { StateCreator } from 'zustand';
import type { Note, Notebook } from '@/types';

/**
 * Notes Slice - 笔记和笔记本相关状态管理
 * 职责：笔记CRUD、笔记本管理、激活笔记状态
 */
export interface NotesSlice {
  // State
  notes: Note[];
  notebooks: Notebook[];
  activeNoteId: string | null;
  activeNotebookId: string | null;
  searchQuery: string;

  // Note actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  setActiveNoteId: (id: string | null) => void;

  // Notebook actions
  setNotebooks: (notebooks: Notebook[]) => void;
  addNotebook: (notebook: Notebook) => void;
  updateNotebook: (id: string, updates: Partial<Notebook>) => void;
  deleteNotebook: (id: string) => void;
  setActiveNotebookId: (id: string | null) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
}

export const createNotesSlice: StateCreator<NotesSlice> = (set) => ({
  // Initial state
  notes: [],
  notebooks: [],
  activeNoteId: null,
  activeNotebookId: null,
  searchQuery: '',

  // Note actions
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    })),
  deleteNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
    })),
  setActiveNoteId: (id) => set({ activeNoteId: id }),

  // Notebook actions
  setNotebooks: (notebooks) => set({ notebooks }),
  addNotebook: (notebook) => set((state) => ({ notebooks: [...state.notebooks, notebook] })),
  updateNotebook: (id, updates) =>
    set((state) => ({
      notebooks: state.notebooks.map((nb) => (nb.id === id ? { ...nb, ...updates } : nb)),
    })),
  deleteNotebook: (id) =>
    set((state) => ({ notebooks: state.notebooks.filter((nb) => nb.id !== id) })),
  setActiveNotebookId: (id) => set({ activeNotebookId: id }),

  // Search actions
  setSearchQuery: (query) => set({ searchQuery: query }),
});
