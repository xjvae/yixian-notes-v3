import { useCallback, useEffect, useRef, useState } from 'react';
// 本地版本：使用 localStorage 替代 scopedStorage

export interface HistoryAction<T> {
  id: string;
  type: string;
  timestamp: number;
  previous: T;
  next: T;
}

interface UseUndoRedoOptions<T> {
  maxHistory?: number;
  /** 相同 type 且间隔 < mergeWindowMs 的操作合并为一条 */
  mergeWindowMs?: number;
  storageKey?: string;
  getSnapshot: () => T;
  applySnapshot: (snapshot: T) => void;
}

/**
 * 通用撤销重做 Hook
 * T 为快照类型（可以是任何可序列化的状态快照）
 */
export function useUndoRedo<T>({
  maxHistory = 50,
  mergeWindowMs = 2000,
  storageKey,
  getSnapshot,
  applySnapshot,
}: UseUndoRedoOptions<T>) {
  const pastRef = useRef<HistoryAction<T>[]>([]);
  const futureRef = useRef<HistoryAction<T>[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateStates = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  // 记录一次操作（操作完成后调用）
  const recordAction = useCallback(
    (type: string, previous: T, next: T) => {
      const now = Date.now();
      const lastPast = pastRef.current[pastRef.current.length - 1];

      // 合并：同 type 且在时间窗口内
      if (
        lastPast &&
        lastPast.type === type &&
        now - lastPast.timestamp < mergeWindowMs
      ) {
        lastPast.next = next;
        lastPast.timestamp = now;
        // 合并后清空未来栈
        futureRef.current = [];
        updateStates();
        return;
      }

      const action: HistoryAction<T> = {
        id: `${type}-${now}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        timestamp: now,
        previous,
        next,
      };

      pastRef.current.push(action);
      if (pastRef.current.length > maxHistory) {
        pastRef.current.shift();
      }
      // 新操作清空未来栈
      futureRef.current = [];
      updateStates();

      // 持久化（可选）
      if (storageKey) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              past: pastRef.current,
              future: futureRef.current,
            }),
          );
        } catch (e) {
          console.error('undo/redo persist failed:', String(e));
        }
      }
    },
    [maxHistory, mergeWindowMs, storageKey, updateStates],
  );

  // 便捷记录：传入 type 和新值，previous 自动取当前快照
  const record = useCallback(
    (type: string, next: T) => {
      const previous = getSnapshot();
      recordAction(type, previous, next);
    },
    [getSnapshot, recordAction],
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const action = pastRef.current.pop()!;
    futureRef.current.unshift(action);
    applySnapshot(action.previous);
    updateStates();
    console.log('undo:', action.type);
  }, [applySnapshot, updateStates]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const action = futureRef.current.shift()!;
    pastRef.current.push(action);
    applySnapshot(action.next);
    updateStates();
    console.log('redo:', action.type);
  }, [applySnapshot, updateStates]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    updateStates();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, updateStates]);

  // 从 localStorage 恢复历史
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.past)) pastRef.current = parsed.past;
        if (Array.isArray(parsed.future)) futureRef.current = parsed.future;
        updateStates();
      }
    } catch (e) {
      console.warn('undo/redo load failed:', String(e));
    }
  }, [storageKey, updateStates]);

  // 全局键盘监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';

      if (isZ && !e.shiftKey) {
        // Ctrl+Z / Cmd+Z 撤销
        // 如果焦点在输入框内，交给浏览器原生撤销，仅在非编辑区拦截
        const target = e.target as HTMLElement;
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isEditable) {
          e.preventDefault();
          undo();
        }
      } else if ((isZ && e.shiftKey) || isY) {
        // Ctrl+Shift+Z / Ctrl+Y / Cmd+Shift+Z / Cmd+Y 重做
        const target = e.target as HTMLElement;
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isEditable) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    record,
    recordAction,
    clearHistory,
    pastCount: pastRef.current.length,
    futureCount: futureRef.current.length,
  };
}
