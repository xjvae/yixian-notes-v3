// ============================================================
// useCtrlDoublePress — 短时间连按两次 Ctrl / Cmd 触发回调
// ============================================================
import { useEffect, useRef } from 'react';

const WINDOW_MS = 400;

/**
 * 在约 400ms 内连按两次 Ctrl（macOS 为 Cmd）触发 handler。
 * - 监听 keydown 捕获阶段，仅在事件中包含 ctrlKey/metaKey 且主键为
 *   Control/Meta 修饰键本身时计数（避免与 Ctrl+C 等组合冲突）。
 * - 返回 start 后不建议手动卸载；在组件卸载时自动清理。
 */
export function useCtrlDoublePress(
  handler: () => void,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const lastPressRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // 主键必须是 Ctrl 或 Meta 本身（不是其它键附带 ctrl 修饰）
      const isCtrl = e.key === 'Control';
      const isMeta = e.key === 'Meta';
      const modActive = e.ctrlKey || e.metaKey;
      if (!isCtrl && !isMeta) return;
      if (!modActive) return;

      const now = Date.now();
      if (now - lastPressRef.current <= WINDOW_MS) {
        lastPressRef.current = 0; // 触发后复位，避免三连触发
        e.preventDefault();
        e.stopPropagation();
        handlerRef.current();
      } else {
        lastPressRef.current = now;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}