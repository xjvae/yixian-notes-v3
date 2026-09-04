// 通用 localStorage Hook — 支持 workspace 隔离的 key 和 JSON 序列化
import { useState, useCallback } from "react";

/**
 * 生成 workspace 隔离的 storage key
 */
export function wsKey(base: string, workspaceId?: string): string {
  return workspaceId ? `${base}::ws::${workspaceId}` : base;
}

/**
 * 安全读取 JSON，失败时返回 fallback
 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * 安全写入 JSON
 */
export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

// ---------- 防抖持久化（文档§七：减少高频 localStorage 写入） ----------
// 同一 key 在一次安静窗口内的多次写入会被合并成一次；页面隐藏/关闭时立即刷盘，
// 避免高频编辑造成同步多写、卡顿，同时不丢数据。
const DEBOUNCE_MS = 250;
const pendingWrites = new Map<string, { timer: number; value: unknown }>();

function flushKey(key: string): void {
  const entry = pendingWrites.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingWrites.delete(key);
  saveJSON(key, entry.value);
}

function flushAll(): void {
  const keys = Array.from(pendingWrites.keys());
  keys.forEach(flushKey);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
}

/**
 * 防抖版写入：高频更新合并为一次磁盘写入，并触发一次调度器实现文档的“本地调度写入”
 */
export function saveJSONDebounced<T>(key: string, value: T): void {
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = window.setTimeout(() => flushKey(key), DEBOUNCE_MS);
  pendingWrites.set(key, { timer, value });
}

/**
 * 立即把某 key 的挂起写入刷出（如关键操作后调用）
 */
export function flushSync(key: string): void {
  flushKey(key);
}

/**
 * 通用 localStorage state hook
 * 自动序列化/反序列化 JSON，支持 workspace 隔离
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  workspaceId?: string
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = wsKey(key, workspaceId);

  const [storedValue, setStoredValue] = useState<T>(() =>
    loadJSON(storageKey, initialValue)
  );

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue =
          value instanceof Function ? value(prev) : value;
        saveJSON(storageKey, nextValue);
        return nextValue;
      });
    },
    [storageKey]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setStoredValue(initialValue);
    } catch {
      // ignore
    }
  }, [storageKey, initialValue]);

  return [storedValue, setValue, removeValue];
}
