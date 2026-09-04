// 编辑器同步逻辑 Hook
//
// 管理自动保存定时器、保存状态和字数统计。
// 从 EditorPane 中提取的 triggerSave / handleContentInput 逻辑。

import { useCallback, useRef, useState } from 'react';
import { plainTextToExcerpt } from '@/lib/text';

interface UseEditorSyncOptions {
  noteId: string | undefined;
  onSave: (updates: { title: string; content: string; excerpt: string }) => void;
  getEditorHtml: () => string;
  getEditorText: () => string;
  title: string;
}

interface UseEditorSyncReturn {
  saved: boolean;
  lastSavedAt: number | null;
  wordCount: number;
  saveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  triggerSave: () => void;
  handleContentInput: (recordFn: (type: string, content: string) => void) => void;
  setWordCount: (count: number) => void;
  setSaved: (saved: boolean) => void;
  setLastSavedAt: (ts: number | null) => void;
  resetSaveState: () => void;
}

export function useEditorSync({
  noteId,
  onSave,
  getEditorHtml,
  getEditorText,
  title,
}: UseEditorSyncOptions): UseEditorSyncReturn {
  const [saved, setSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    if (!noteId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaved(false);
    saveTimerRef.current = setTimeout(() => {
      const html = getEditorHtml();
      const plain = getEditorText();
      const excerpt = plainTextToExcerpt(plain, 80);
      onSave({
        title,
        content: html,
        excerpt,
      });
      setWordCount(plain.replace(/\s/g, '').length);
      setSaved(true);
      setLastSavedAt(Date.now());
    }, 400);
  }, [noteId, title, onSave, getEditorHtml, getEditorText]);

  const handleContentInput = useCallback(
    (recordFn: (type: string, content: string) => void) => {
      const currentContent = getEditorHtml();
      recordFn('edit', currentContent);
      triggerSave();
    },
    [triggerSave, getEditorHtml],
  );

  const resetSaveState = useCallback(() => {
    setSaved(true);
    setLastSavedAt(noteId ? Date.now() : null);
  }, [noteId]);

  return {
    saved,
    lastSavedAt,
    wordCount,
    saveTimerRef,
    triggerSave,
    handleContentInput,
    setWordCount,
    setSaved,
    setLastSavedAt,
    resetSaveState,
  };
}
