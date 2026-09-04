// Sync 同步仓库 — 包装后端 sync_state 与对象同步命令（阶段1基础能力）
import { getInvoke } from "@/lib/backend";

/** 记录同步记账键（如 `note:{id}`、`webdav:last_sync`） */
export async function putSyncState(key: string, value: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("put_sync_state", { key, value });
  } catch {
    /* 静默降级 */
  }
}

/** 读取同步记账 */
export async function getSyncState(key: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const res = (await invoke("get_sync_state", { key })) as { value?: string } | null;
    return res?.value ?? null;
  } catch {
    return null;
  }
}

/** 读取全部同步记账（供 WebDAV 增量比对） */
export async function getAllSyncStates(): Promise<Record<string, string>> {
  const invoke = await getInvoke();
  if (!invoke) return {};
  try {
    const rows = (await invoke("get_all_sync_states")) as Array<{ key: string; value: string }>;
    return Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}