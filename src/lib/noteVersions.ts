// 笔记版本历史存储层
//
// 统一管理「多条历史版本」的读写：
// - 本地 localStorage 为权威快照源（内容去重 + 时间窗口节流合并 + 保留上限）；
// - Tauri 后端可用时尽力镜像到 SQLite note_versions 表；
// - 否则（Web / Vite 预览等非 Tauri 环境）仅用 localStorage。
//
// 版本类型说明：
// - auto：自动保存快照，内容去重 + 窗口内节流合并，数量受保留策略约束；
// - milestone：手动命名的里程碑版本，不被节流合并、不受保留策略裁剪。

import {
  getNoteVersionsFromBackend,
  saveNoteVersionToBackend,
  restoreVersionFromBackend,
  clearVersionsFromBackend,
} from './backend';

export interface NoteVersionRecord {
  id: string;
  noteId: string;
  title: string;
  content: string;
  createdAt: number;
  label: string;
  /** true 表示手动命名的里程碑版本（不被节流合并/裁剪） */
  milestone: boolean;
}

/** 时间窗口（毫秒）：auto 在该窗口内合并到最近一条 */
export const MERGE_WINDOW_MS = 10_000;

/** 每篇笔记最多保留的版本条数（仅影响 auto 快照，里程碑永远保留） */
export const MAX_VERSIONS = 8;

function storageKey(noteId: string): string {
  return `yixian.noteVersions.${noteId}`;
}

function readLocal(noteId: string): NoteVersionRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(noteId));
    return raw ? (JSON.parse(raw) as NoteVersionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(noteId: string, list: NoteVersionRecord[]): void {
  try {
    localStorage.setItem(storageKey(noteId), JSON.stringify(list));
  } catch {
    /* 忽略写入失败 */
  }
}

/**
 * 规范化：auto 快照按内容去重（同内容只留一条），里程碑始终保留；
 * 随后应用保留策略（里程碑优先，再塞入最近的 auto），并按时间倒序。
 */
function canonicalLocal(recs: NoteVersionRecord[], max: number): NoteVersionRecord[] {
  const seen = new Map<string, NoteVersionRecord>();
  const milestones: NoteVersionRecord[] = [];
  for (const r of [...recs].sort((a, b) => a.createdAt - b.createdAt)) {
    if (r.milestone) milestones.push(r);
    else seen.set(r.content, r);
  }
  const all = [...milestones, ...seen.values()].sort((a, b) => b.createdAt - a.createdAt);

  // 保留策略：里程碑最优先，剩余的预算给最新的 auto
  const milestonesNewest = all.filter((r) => r.milestone).sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
  const autoBudget = Math.max(0, max - milestonesNewest.length);
  const autoNewest = all.filter((r) => !r.milestone).slice(0, autoBudget);
  return [...milestonesNewest, ...autoNewest].sort((a, b) => b.createdAt - a.createdAt);
}

/** 读取某篇笔记的历史版本（时间倒序、内容去重、已应用保留策略）。后端可用时以后端为准并回写本地缓存。 */
export async function listNoteVersions(noteId: string): Promise<NoteVersionRecord[]> {
  // 后端可用：以后端为权威源
  const backend = await getNoteVersionsFromBackend(noteId);
  if (backend !== null) {
    const mapped: NoteVersionRecord[] = backend.map((v) => ({
      id: v.id,
      noteId,
      title: v.title,
      content: v.content,
      createdAt: new Date(v.created_at).getTime(),
      label: v.label ?? '历史版本',
      milestone: false,
    }));
    const canonical = canonicalLocal(mapped, MAX_VERSIONS);
    writeLocal(noteId, canonical);
    return canonical;
  }
  // 后端不可用：回退本地缓存
  return canonicalLocal(readLocal(noteId), MAX_VERSIONS);
}

export interface SaveVersionResult {
  record: NoteVersionRecord;
  /** true 表示本次属于「节流合并」，更新到了窗口内最近一条而非新增 */
  merged: boolean;
}

/**
 * 保存一条「自动」历史版本。
 * - 相同内容：已存在同内容记录则丢弃（返回 null）；
 * - 不同内容：窗口内合并到最近一条；否则新增。
 */
export async function saveNoteVersion(rec: NoteVersionRecord): Promise<SaveVersionResult | null> {
  let local = readLocal(rec.noteId);

  // 内容完全重复：丢弃本次自动保存（里程碑由 createMilestoneVersion 单独处理）
  if (local.some((x) => !x.milestone && x.content === rec.content)) {
    return null;
  }

  const newest = [...local].sort((a, b) => b.createdAt - a.createdAt)[0];
  let merged = false;
  let record: NoteVersionRecord = { ...rec, milestone: false };
  if (newest && !newest.milestone && record.createdAt - newest.createdAt < MERGE_WINDOW_MS) {
    // 节流合并到最近一条 auto
    record = { ...newest, title: rec.title, content: rec.content, createdAt: rec.createdAt, label: rec.label, milestone: false };
    local = local.map((x) => (x.id === newest.id ? record : x));
    merged = true;
  } else {
    local = [...local, record];
  }

  const next = canonicalLocal(local, MAX_VERSIONS);
  writeLocal(rec.noteId, next);

  // 后端可用时，将规范化后的完整列表（去重/合并/保留后）同步到后端
  await persistAllToBackend(rec.noteId, next);
  return { record, merged };
}

/**
 * 保存一条命名「里程碑」版本：总是新增独立一条（不节流合并、不做内容去重）。
 * 里程碑不参与自动快照的保留策略裁剪。
 */
export async function saveMilestoneVersion(rec: NoteVersionRecord): Promise<NoteVersionRecord> {
  const milestone: NoteVersionRecord = {
    ...rec,
    milestone: true,
    label: rec.label || '里程碑',
  };
  const next = canonicalLocal([...readLocal(rec.noteId), milestone], MAX_VERSIONS);
  writeLocal(rec.noteId, next);
  await persistAllToBackend(rec.noteId, next);
  return milestone;
}

/**
 * 将某篇笔记的规范化历史列表整表同步到后端（clear + 重插）。
 * 后端不可用（非 Tauri / 调用失败）时静默跳过，仅保留本地。
 */
async function persistAllToBackend(noteId: string, list: NoteVersionRecord[]): Promise<void> {
  const reachable = await clearVersionsFromBackend(noteId);
  if (!reachable) return;
  for (const r of list) {
    await saveNoteVersionToBackend({
      id: r.id,
      note_id: r.noteId,
      content: r.content,
      title: r.title,
      created_at: new Date(r.createdAt).toISOString(),
      label: r.label,
    });
  }
}

/** 恢复某条版本：后端可用时走后端命令，否则仅本地回填（由调用方直接写内容）。 */
export async function restoreNoteVersion(noteId: string, versionId: string): Promise<boolean> {
  await restoreVersionFromBackend(noteId, versionId);
  return true;
}

/** 删除单条历史版本。更新本地缓存，并可同步后端。 */
export async function deleteVersionRecord(noteId: string, versionId: string): Promise<void> {
  const next = canonicalLocal(
    readLocal(noteId).filter((x) => x.id !== versionId),
    MAX_VERSIONS,
  );
  writeLocal(noteId, next);
  await persistAllToBackend(noteId, next);
}

/** 清空某篇笔记的全部历史版本（仅清除历史，不影响当前内容），并同步后端。 */
export async function clearVersionRecords(noteId: string): Promise<void> {
  writeLocal(noteId, []);
  await clearVersionsFromBackend(noteId);
}