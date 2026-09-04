// ══════════════════════════════════════════════════════════════
// crossSearchLocal.ts — 跨对象搜索的本地聚合（阶段2）
//
// SearchPage 无论是否在 Tauri 环境都会命中：把前端本地已有的
// 待办 / 剪贴板按关键词 Like 聚合为统一的 CrossHit 列表。
// Tauri 环境下 SearchPage 会额外并入后端 cross_search 的结果，
// 两者都用 CrossHit 结构，前端渲染一次即可。
// ══════════════════════════════════════════════════════════════
import type { CrossHit } from "@/lib/backend";

export interface CrossSearchLocalSources {
  todos: Array<{ id: string; title: string; description?: string }>;
  clipboard?: Array<{ id: string; content: string; createdAt?: number }>;
}

/** 本地关键词聚合（大小写不敏感 Like），返回统一 CrossHit 列表 */
export function aggregateLocalCrossSearch(
  query: string,
  sources: CrossSearchLocalSources,
): CrossHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: CrossHit[] = [];
  sources.todos.forEach((t) => {
    if (t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)) {
      hits.push({ source: "todo", object_id: t.id, title: t.title, snippet: t.description ?? "", sort_key: "" });
    }
  });
  (sources.clipboard ?? []).forEach((c) => {
    if (c.content.toLowerCase().includes(q)) {
      hits.push({ source: "captured", object_id: c.id, title: c.content.slice(0, 40), snippet: c.content, sort_key: String(c.createdAt ?? "") });
    }
  });
  return hits;
}