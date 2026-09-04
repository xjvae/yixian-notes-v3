// ============================================================
// 通用 ID 生成工具
// ============================================================

/**
 * 生成形如 `${prefix}_${Date.now()}_${随机36进制}` 的短 ID。
 * 与历史实现保持同一格式，保证不重复。
 */
export function genId(prefix = 'id', len = 7): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 2 + len)}`;
}

/** 生成 UUID（依赖 crypto.randomUUID，可用时优先） */
export function uuid(): string {
  return crypto.randomUUID();
}