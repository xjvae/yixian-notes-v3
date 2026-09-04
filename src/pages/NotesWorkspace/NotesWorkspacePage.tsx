import { useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoteListPane from './NoteListPane';
import EditorPane from './EditorPane';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { toast } from 'sonner';

interface WorkspaceContext {
  notes: any[];
  tags: any[];
  notebooks: any[];
  todos: any[];
  flashcards: any[];
  activeNoteId: string;
  activeFilter: string;
  setActiveNoteId: (id: string) => void;
  setActiveFilter: (filter: string) => void;
  updateNote: (id: string, updates: Partial<any>) => void;
  newNote: () => void;
  encryptNote: (id: string, password: string) => Promise<boolean>;
  decryptNote: (id: string, password: string) => Promise<boolean>;
  batchUpdate: (ids: string[], updates: Partial<any>) => void;
  batchUpdateMeta: (ids: string[], updates: Partial<any>) => void;
  batchDelete: (ids: string[], permanent?: boolean) => void;
  batchRestore: (ids: string[]) => void;
  reorderNotes: (orderedIds: string[]) => void;
  noteCounts: Record<string, number>;
  activeWorkspace?: { id: string; name: string; color: string; icon: string };
  activeWorkspacePersonality?: any;
}

export default function NotesWorkspacePage() {
  const context = useOutletContext<WorkspaceContext>();
  const {
    notes,
    tags,
    notebooks,
    todos,
    flashcards,
    activeNoteId,
    activeFilter,
    setActiveNoteId,
    updateNote,
    newNote,
    encryptNote,
    decryptNote,
    batchUpdate,
    batchUpdateMeta,
    batchDelete,
    batchRestore,
    reorderNotes,
    activeWorkspace,
    activeWorkspacePersonality,
  } = context;

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      updateNote(id, { isFavorite: !note.isFavorite });
    },
    [notes, updateNote],
  );

  const handleDelete = useCallback(
    (id: string) => {
      updateNote(id, { isDeleted: true });
      // 删除后选上一条
      const currentIdx = notes.findIndex((n) => n.id === id);
      if (currentIdx >= 0) {
        const nextNote = notes.find((n, i) => i < currentIdx && !n.isDeleted);
        const prevNote = notes.find((n, i) => i > currentIdx && !n.isDeleted);
        if (nextNote) setActiveNoteId(nextNote.id);
        else if (prevNote) setActiveNoteId(prevNote.id);
      }
    },
    [notes, updateNote, setActiveNoteId],
  );

  const handleRestore = useCallback(
    (id: string) => {
      updateNote(id, { isDeleted: false });
    },
    [updateNote],
  );

  const handleBatchDelete = useCallback(
    (ids: string[]) => {
      batchDelete(ids, false);
    },
    [batchDelete],
  );

  const handleTogglePin = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      updateNote(id, { isPinned: !note.isPinned });
    },
    [notes, updateNote],
  );

  // 手动排序：按拖拽后的顺序重写 sortOrder（专用通道，不触碰 updatedAt）
  const handleReorder = useCallback(
    (orderedIds: string[]) => {
      reorderNotes(orderedIds);
      toast.success('已更新排序');
    },
    [reorderNotes],
  );

  return (
    <div className="h-full w-full flex">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={32} minSize={24} maxSize={40} className="h-full">
          <NoteListPane
            notes={notes}
            activeNoteId={activeNoteId}
            onSelect={setActiveNoteId}
            onNewNote={newNote}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
            filter={activeFilter}
            tags={tags}
            batchUpdate={batchUpdate}
            batchUpdateMeta={batchUpdateMeta}
            batchDelete={handleBatchDelete}
            batchRestore={batchRestore}
            onTogglePin={handleTogglePin}
            onReorder={handleReorder}
            notebooks={notebooks}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={68} className="h-full">
          <EditorPane
            note={activeNote}
            onUpdate={updateNote}
            onEncrypt={encryptNote}
            onDecrypt={decryptNote}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
            onRestore={handleRestore}
            workspaceName={activeWorkspace?.name}
            workspaceColor={activeWorkspace?.color}
            workspace={activeWorkspace}
            workspacePersonality={activeWorkspacePersonality}
            notes={notes}
            notebooks={notebooks}
            tags={tags}
            todos={todos}
            flashcards={flashcards}
            onNewNote={newNote}
            onOpenNote={setActiveNoteId}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
