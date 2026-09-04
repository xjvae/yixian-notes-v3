// 应用功能模块 Hook — 闪卡、闪念、通知
import { useState, useCallback, useEffect } from "react";
import {
  MOCK_FLASHCARDS,
  MOCK_FLASH_THOUGHTS,
  MOCK_NOTIFICATIONS,
  type IFlashcard,
  type IFlashThought,
  type INotification,
} from "@/data/notes";
import {
  FLASHCARDS_STORAGE_KEY,
  FLASH_STORAGE_KEY,
  NOTIFICATIONS_STORAGE_KEY,
  getStorageKey,
} from "./useWorkspaceStorage";
import { loadJSON, saveJSONDebounced } from "./useLocalStorage";

export function useAppFeatures(activeWorkspaceId: string) {
  // === 全局功能（不随工作区切换） ===
  const [flashcards, setFlashcards] = useState<IFlashcard[]>(() => loadJSON(FLASHCARDS_STORAGE_KEY, MOCK_FLASHCARDS));

  // === 工作区隔离功能 ===
  const [flashThoughts, setFlashThoughts] = useState<IFlashThought[]>(() => loadJSON(getStorageKey(FLASH_STORAGE_KEY, activeWorkspaceId), MOCK_FLASH_THOUGHTS));
  const [notifications, setNotifications] = useState<INotification[]>(() => loadJSON(getStorageKey(NOTIFICATIONS_STORAGE_KEY, activeWorkspaceId), MOCK_NOTIFICATIONS));

  // 持久化 — 全局（防抖合并高频写入，减少 localStorage 频繁同步）
  useEffect(() => saveJSONDebounced(FLASHCARDS_STORAGE_KEY, flashcards), [flashcards]);

  // 持久化 — 工作区隔离
  useEffect(() => saveJSONDebounced(getStorageKey(FLASH_STORAGE_KEY, activeWorkspaceId), flashThoughts), [flashThoughts, activeWorkspaceId]);
  useEffect(() => saveJSONDebounced(getStorageKey(NOTIFICATIONS_STORAGE_KEY, activeWorkspaceId), notifications), [notifications, activeWorkspaceId]);

  // === 闪卡 ===
  const handleAddFlashcard = useCallback((card: Omit<IFlashcard, "id" | "createdAt">) => {
    const newCard: IFlashcard = { ...card, id: `fc${Date.now()}`, createdAt: Date.now() };
    setFlashcards((prev) => [...prev, newCard]);
    return newCard;
  }, []);
  const handleUpdateFlashcard = useCallback((id: string, updates: Partial<IFlashcard>) => {
    setFlashcards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);
  const handleReviewFlashcard = useCallback((id: string, quality: number) => {
    setFlashcards((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      let ease = c.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      ease = Math.max(1.3, ease);
      let interval = 1;
      let repetitions = c.repetitions + 1;
      if (quality < 3) { repetitions = 0; interval = 1; }
      else if (repetitions === 1) { interval = 1; }
      else if (repetitions === 2) { interval = 6; }
      else { interval = Math.round(c.interval * ease); }
      const dueDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const status: IFlashcard["status"] = quality >= 4 && repetitions >= 8 ? "mastered" : repetitions >= 3 ? "review" : "learning";
      return { ...c, ease, interval, repetitions, dueDate, lastReviewedAt: Date.now(), status };
    }));
  }, []);
  const handleDeleteFlashcard = useCallback((id: string) => {
    setFlashcards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // === 闪念 ===
  const handleAddFlashThought = useCallback((f: Partial<IFlashThought>) => {
    const newFlash: IFlashThought = { id: `ft${Date.now()}`, content: f.content ?? "", status: f.status ?? "pending", createdAt: Date.now() };
    setFlashThoughts((prev) => [newFlash, ...prev]);
  }, []);
  const handleUpdateFlashThought = useCallback((id: string, updates: Partial<IFlashThought>) => {
    setFlashThoughts((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);
  const handleDeleteFlashThought = useCallback((id: string) => {
    setFlashThoughts((prev) => prev.filter((f) => f.id !== id));
  }, []);
  const handleClearFlashThoughts = useCallback((ids?: string[]) => {
    setFlashThoughts((prev) => (ids && ids.length ? prev.filter((f) => !ids.includes(f.id)) : []));
  }, []);

  // === 提醒（统一真源已移入 zustand store；此处不再维护并行列表）===

  // === 通知 ===
  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);
  const handleClearNotifications = useCallback(() => { setNotifications([]); }, []);
  const handleMarkAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);
  const handleDeleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    // 状态
    flashcards, setFlashcards,
    flashThoughts, setFlashThoughts,
    notifications, setNotifications,
    // 操作
    handleAddFlashcard, handleUpdateFlashcard, handleReviewFlashcard, handleDeleteFlashcard,
    handleAddFlashThought, handleUpdateFlashThought,
    handleDeleteFlashThought, handleClearFlashThoughts,
    handleMarkNotificationRead, handleClearNotifications, handleMarkAllNotificationsRead,
    handleDeleteNotification,
  };
}
