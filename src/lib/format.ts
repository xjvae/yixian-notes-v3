// ============================================================
// 通用格式化工具
// ============================================================

/**
 * 文件大小格式化（B/KB/MB/GB）。
 * 统一 noteImport.formatFileSize 与 LocalSearch.formatBytes 三版。
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const size = (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

/** 两位补零（用于 HH:mm 等） */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}