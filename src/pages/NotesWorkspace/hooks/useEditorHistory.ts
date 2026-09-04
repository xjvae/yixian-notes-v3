// 编辑器撤销/重做历史 Hook
//
// 封装 useUndoRedo，管理编辑器内容的撤销/重做栈。
// 从 EditorPane 中提取的撤销重做逻辑。

import { useCallback, useEffect } from 'react';
import { useUndoRedo } from '@/hooks/use-undo-redo';

interface UseEditorHistoryOptions {
  maxHistory?: number;
  mergeWindowMs?: number;
  getSnapshot: () => string;
  applySnapshot: (snapshot: string) => void;
}

interface UseEditorHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  record: (type: string, content: string) => void;
  undo: () => void;
  redo: () => void;
}

export function useEditorHistory({
  maxHistory = 50,
  mergeWindowMs = 2000,
  getSnapshot,
  applySnapshot,
}: UseEditorHistoryOptions): UseEditorHistoryReturn {
  const {
    canUndo,
    canRedo,
    record,
    undo: baseUndo,
    redo: baseRedo,
  } = useUndoRedo<string>({
    maxHistory,
    mergeWindowMs,
    getSnapshot,
    applySnapshot,
  });

  const undo = useCallback(() => {
    if (!canUndo) return;
    baseUndo();
  }, [canUndo, baseUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    baseRedo();
  }, [canRedo, baseRedo]);

  // 全局键盘快捷键：撤销重做（仅在编辑器焦点时拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // 获取当前焦点元素
      const activeEl = document.activeElement;
      const isEditable =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // 仅在内容可编辑区（编辑器）拦截快捷键
      if (!isEditable) return;

      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    record,
    undo,
    redo,
  };
}
