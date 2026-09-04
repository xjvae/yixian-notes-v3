// ============================================================
// 通用错误处理工具
// ============================================================

/** 统一把 unknown 转成可读错误信息 */
export function errMsg(e: unknown, fallback = '发生未知错误'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}

/**
 * 统一 try/catch + fallback 包装，替代散落的 `try { ... } catch { return fallback; }`。
 */
export function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}