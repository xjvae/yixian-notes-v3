// ============================================================
// 后端持久化桥接层（渐进式 Tauri SQLite 同步）
//
// 仅在 Tauri 桌面运行时生效；纯 Web / Vite 环境自动静默降级，
// 不会抛错、不影响前端内存态与 localStorage 数据流。
// 前端 `INote` 中的一些字段（excerpt / isPinned / isDeleted）在后端
// `Note` 无对应列，统一塞入 `metadata` JSON 字段往返保存。
// ============================================================

import type { INote, IStickyNote, ITodo } from "@/data/notes";
import type { Reminder } from "@/types";
import { genId } from "@/lib/id";

export type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

let cachedInvoke: InvokeFn | null | undefined;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 获取缓存化的 Tauri invoke（供 backend.ts 内部与 syncRepository 等复用） */
export async function getInvoke(): Promise<InvokeFn | null> {
  if (cachedInvoke !== undefined) return cachedInvoke;
  if (!isTauri()) {
    cachedInvoke = null;
    return null;
  }
  try {
    const mod = await import("@tauri-apps/api/core");
    const invoke = mod.invoke as InvokeFn;
    cachedInvoke = invoke;
    return invoke;
  } catch {
    cachedInvoke = null;
    return null;
  }
}

/** 当前是否处于可用的 Tauri 后端环境 */
export async function isBackendAvailable(): Promise<boolean> {
  return (await getInvoke()) !== null;
}

// ─── 模型映射 ────────────────────────────────────────────────

/** 后端 Note 结构（需与 Rust 端 models::Note 对应） */
interface BackendNote {
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  tags: string[];
  is_favorite: boolean;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

function toBackendNote(note: INote): BackendNote {
  return {
    id: note.id,
    title: note.title,
    content: note.content ?? "",
    notebook_id: note.notebookId ?? null,
    tags: note.tags ?? [],
    is_favorite: note.isFavorite ?? false,
    is_encrypted: false,
    created_at: new Date(note.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(note.updatedAt ?? Date.now()).toISOString(),
    metadata: {
      excerpt: note.excerpt ?? "",
      isPinned: note.isPinned ?? false,
      isDeleted: note.isDeleted ?? false,
      sortOrder: note.sortOrder ?? Date.now(),
    },
  };
}

/** 后端 Note -> 前端 INote 反向映射（从 metadata 恢复扩展字段） */
export function fromBackendNote(b: BackendNote): INote {
  const meta = b.metadata ?? {};
  return {
    id: b.id,
    title: b.title,
    content: b.content ?? "",
    excerpt: typeof meta.excerpt === "string" ? meta.excerpt : undefined,
    notebookId: b.notebook_id ?? undefined,
    tags: b.tags ?? [],
    isFavorite: b.is_favorite ?? false,
    isDeleted: meta.isDeleted === true,
    isPinned: meta.isPinned === true,
    sortOrder: typeof meta.sortOrder === "number" ? meta.sortOrder : Date.now(),
    createdAt: new Date(b.created_at).getTime(),
    updatedAt: new Date(b.updated_at).getTime(),
  } as INote;
}

/**
 * 从 SQLite 加载全部笔记（SQLite 接管主链路后的真实源读取）。
 * 仅 Tauri 环境生效；不可用或失败时返回 null，调用方回退到 localStorage。
 */
export async function loadNotesFromBackend(): Promise<INote[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("get_notes", {})) as BackendNote[];
    if (!Array.isArray(rows)) return null;
    return rows.map(fromBackendNote);
  } catch {
    return null;
  }
}

// ─── 跨对象搜索（阶段2） ─────────────────────────────────

export interface CrossHit {
  source: "note" | "todo" | "captured" | "tag";
  object_id: string;
  title: string;
  snippet: string;
  sort_key: string;
}

/** 调用后端 cross_search：在笔记/待办/采集项/标签上做全局 LIKE 搜索。
 *  仅 Tauri 生效；调用失败或非桌面环境返回 null（由调用方回退到本地聚合）。 */
export async function crossSearchFromBackend(query: string): Promise<CrossHit[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("cross_search", { query, limit: 30 })) as CrossHit[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// ─── 本地文件系统搜索（local_search） ─────────────────────────

export interface LocalFileHit {
  path: string;
  name: string;
  rel_path: string;
  size: number;
  modified: number;
  name_match: boolean;
  content_match: boolean;
  snippet: string;
  /** 内容命中的多个上下文片段 */
  snippets?: string[];
  /** 内容命中的总次数 */
  content_hits?: number;
}

/** 在用户选择的根目录内搜索本地文件（文件名 + 文本内容）。仅 Tauri 生效；否则 null。 */
export async function localSearchFromBackend(
  root: string,
  query: string,
  limit = 200,
  opts?: { mode?: 'name' | 'content' | 'all'; maxDepth?: number },
): Promise<LocalFileHit[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke('local_search', { root, query, limit, ...opts })) as LocalFileHit[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/** 用系统默认程序打开本地文件。仅桌面端；返回是否成功发起。 */
export async function openLocalFile(path: string): Promise<boolean> {
  const invoke = await getInvoke();
  if (!invoke) return false;
  try {
    return (await invoke('open_local_file', { path })) as boolean;
  } catch {
    return false;
  }
}

/** 在资源管理器中定位/显示文件。仅桌面端。 */
export async function revealLocalFile(path: string): Promise<boolean> {
  const invoke = await getInvoke();
  if (!invoke) return false;
  try {
    return (await invoke('reveal_local_file', { path })) as boolean;
  } catch {
    return false;
  }
}

/** 将文本写入本地文件（供导出搜索结果等使用）。仅桌面端。 */
export async function saveTextFile(path: string, content: string): Promise<boolean> {
  const invoke = await getInvoke();
  if (!invoke) return false;
  try {
    return (await invoke('save_text_file', { path, content })) as boolean;
  } catch {
    return false;
  }
}

/** Rust 侧原生目录选择器（不受 webview dialog 权限限制）。取消返回 null。 */
export async function pickSearchFolder(): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const p = (await invoke('pick_search_folder')) as string | null;
    return typeof p === 'string' ? p : null;
  } catch {
    return null;
  }
}

/** Rust 侧原生保存对话框选导出路径。取消返回 null。 */
export async function pickSaveFile(fileName: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const p = (await invoke('pick_save_file', { fileName })) as string | null;
    return typeof p === 'string' ? p : null;
  } catch {
    return null;
  }
}

// ─── 笔记双链（双向笔记引用） ───────────────────────────────

export interface BackendNoteLink {
  note_id: string;
  target_note_id: string;
}

/** 读取全部笔记双链真实边（get_all_note_links）。仅 Tauri 生效；失败返回 null。 */
export async function getAllNoteLinksFromBackend(): Promise<BackendNoteLink[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("get_all_note_links")) as BackendNoteLink[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// ─── 备份恢复基础能力（阶段3） ───────────────────────────────

export interface BackupRecord {
  id: string;
  name: string;
  path: string;
  size: number;
  created_at: string;
}

/** 创建一次数据库备份（返回备份记录）；仅 Tauri 生效。 */
export async function createBackup(): Promise<BackupRecord | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rec = (await invoke("create_backup", {})) as BackupRecord;
    return rec ?? null;
  } catch {
    return null;
  }
}

/** 列出全部备份记录 */
export async function listBackups(): Promise<BackupRecord[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  try {
    const rows = (await invoke("list_backups", {})) as BackupRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** 删除指定备份（传入备份 id 或文件名） */
export async function deleteBackup(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("delete_backup", { id });
  } catch {
    /* 静默 */
  }
}

/** 恢复指定备份（覆盖当前库），须用户二次确认后调用 */
export async function restoreBackup(id: string): Promise<boolean> {
  const invoke = await getInvoke();
  if (!invoke) return false;
  try {
    await invoke("restore_backup", { id });
    return true;
  } catch {
    return false;
  }
}

interface BackendSticky {
  id: string;
  content: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

function toBackendSticky(s: IStickyNote): BackendSticky {
  return {
    id: s.id,
    content: s.content ?? "",
    color: s.color ?? "#fef3c7",
    x: s.x ?? 0,
    y: s.y ?? 0,
    width: 220,
    height: 180,
    is_pinned: false,
    created_at: new Date(s.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(s.updatedAt ?? Date.now()).toISOString(),
  };
}

// ─── Notes 同步 ──────────────────────────────────────────────

/** 将整批笔记全量同步到后端（优先走批量命令；仅 Tauri 环境生效） */
export async function syncNotesToBackend(notes: INote[]): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  if (notes.length === 0) return;
  // 单条批量优于逐条循环：单次 IPC + 后端事务，显著减少热路径写入次数
  try {
    await invoke("save_notes_batch", { notes: notes.map(toBackendNote) });
    return;
  } catch {
    // 批量失败时逐个兜底，保证至少不丢数据
  }
  for (const note of notes) {
    try {
      await invoke("save_note", { note: toBackendNote(note) });
    } catch {
      // 单条失败不阻断
    }
  }
}

/** 将单条笔记同步到后端（新增 / 更新场景） */
export async function syncNoteToBackend(note: INote): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("save_note", { note: toBackendNote(note) });
  } catch {
    // ignore
  }
}

/** 批量物理删除后端笔记（幂等；用于把前端被永久删除的笔记从 SQLite 镜像中移除） */
export async function deleteNotesFromBackend(ids: string[]): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke || ids.length === 0) return;
  try {
    await invoke("delete_notes", { ids });
  } catch {
    // ignore
  }
}

/** 将整批便签全量同步到后端（仅 Tauri 生效，供防抖批量调度复用） */
export async function syncStickiesToBackend(stickies: IStickyNote[]): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke || stickies.length === 0) return;
  for (const s of stickies) await syncStickyToBackend(s);
}

/** 将单条便签同步到后端 */
export async function syncStickyToBackend(sticky: IStickyNote): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("save_sticky", { sticky: toBackendSticky(sticky) });
  } catch {
    // ignore
  }
}

// ─── 采集项（资源域）同步 ─────────────────────────────────────

/** 采集处理目标：记录采集项被转成笔记 / 待办 / 提醒 / 闪卡后的去向 */
export interface BackendCaptureTarget {
  id: string;
  captured_item_id: string;
  target_type: "note" | "todo" | "reminder" | "flashcard";
  target_id: string;
  created_at: string;
}

/** 采集项（映射后端 CapturedItem 结构） */
export interface BackendCapturedItem {
  id: string;
  source: "clipboard" | "clipper" | "voice" | "thought" | "attachment";
  kind: string;
  content: string;
  preview: string;
  status: "pending" | "processed";
  processed_at: string | null;
  created_at: string;
  targets: BackendCaptureTarget[];
}

/** 生成采集项 id 与 RFC3339 时间（Rust 端 save_captured_item 不自动补 id/created_at） */
export function newCapturedItemId(): string {
  return genId("ci", 7);
}

/** 从 SQLite 加载全部采集项（含处理目标，按时间倒序）；仅 Tauri 生效 */
export async function loadCapturedItemsFromBackend(): Promise<BackendCapturedItem[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("get_captured_items", {})) as BackendCapturedItem[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/** 将单条采集项写入 SQLite（INSERT OR REPLACE，事务内全量替换 targets）；仅 Tauri 生效，静默降级 */
export async function saveCapturedItemToBackend(item: BackendCapturedItem): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("save_captured_item", { item });
  } catch {
    // 忽略：失败不阻断前端时间线展示
  }
}

/** 批量写入多条采集项（逐个静默降级） */
export async function syncCapturedItemsToBackend(items: BackendCapturedItem[]): Promise<void> {
  for (const item of items) await saveCapturedItemToBackend(item);
}

/** 删除指定采集项；仅 Tauri 生效，静默降级 */
export async function deleteCapturedItemFromBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("delete_captured_item", { id });
  } catch {
    // ignore
  }
}

// ─── 待办（计划域）同步 ─────────────────────────────────────

/** 后端 Todo 结构（映射 Rust models::Todo） */
export interface BackendTodo {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  notebook_id: string | null;
  related_note_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function toBackendTodo(t: ITodo): BackendTodo {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    priority: t.priority ?? "medium",
    status: t.status ?? "pending",
    due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    notebook_id: t.notebookId ?? null,
    related_note_id: t.relatedNoteId ?? null,
    tags: t.tags ?? [],
    created_at: new Date(t.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(t.updatedAt ?? Date.now()).toISOString(),
  };
}

function fromBackendTodo(b: BackendTodo): ITodo {
  return {
    id: b.id,
    title: b.title,
    description: b.description ?? "",
    priority: (b.priority as ITodo["priority"]) || "medium",
    status: (b.status as ITodo["status"]) === "completed" ? "completed" : "pending",
    dueDate: b.due_date ? new Date(b.due_date).getTime() : null,
    notebookId: b.notebook_id ?? "",
    tags: b.tags ?? [],
    relatedNoteId: b.related_note_id ?? null,
    createdAt: new Date(b.created_at).getTime(),
    updatedAt: new Date(b.updated_at).getTime(),
  } as ITodo;
}

/** 从 SQLite 加载全部待办；仅 Tauri 生效，失败/不可用时返回 null */
export async function loadTodosFromBackend(): Promise<ITodo[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("get_todos", {})) as BackendTodo[];
    return Array.isArray(rows) ? rows.map(fromBackendTodo) : null;
  } catch {
    return null;
  }
}

/** 将整批待办全量同步到后端（逐条静默降级） */
export async function syncTodosToBackend(todos: ITodo[]): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  for (const t of todos) {
    try {
      await invoke("save_todo", { item: toBackendTodo(t) });
    } catch {
      // ignore
    }
  }
}

// ─── 提醒（计划域）────────────────────────────────────────

/** 后端 Reminder 结构（需与 Rust 端 models::Reminder 对应，snake_case） */
interface BackendReminder {
  id: string;
  note_id: string | null;
  title: string;
  description: string | null;
  remind_at: string;
  is_completed: boolean;
  repeat: string | null;
  created_at: string;
}

/** 后端 Reminder -> store Reminder */
function mapBackendReminder(r: BackendReminder): Reminder {
  return {
    id: r.id,
    noteId: r.note_id ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    remindAt: r.remind_at,
    isCompleted: r.is_completed,
    repeat: r.repeat ?? undefined,
    createdAt: r.created_at,
  };
}

/** store Reminder -> 后端 Reminder（snake_case） */
function toBackendReminder(r: Reminder): BackendReminder {
  return {
    id: r.id,
    note_id: r.noteId ?? null,
    title: r.title,
    description: r.description ?? null,
    remind_at: r.remindAt,
    is_completed: r.isCompleted,
    repeat: r.repeat ?? null,
    created_at: r.createdAt,
  };
}

/** 从 SQLite 加载全部提醒（映射为 store Reminder）；非 Tauri 环境返回 null */
export async function loadRemindersFromBackend(): Promise<Reminder[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    const rows = (await invoke("get_reminders", {})) as BackendReminder[];
    return Array.isArray(rows) ? rows.map(mapBackendReminder) : null;
  } catch {
    return null;
  }
}

/** 将单条提醒同步到后端（新增/更新，upsert） */
export async function saveReminderToBackend(reminder: Reminder): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("save_reminder", { item: toBackendReminder(reminder) });
  } catch {
    // ignore
  }
}

/** 将提醒标记为已完成（后端） */
export async function completeReminderToBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("complete_reminder", { id });
  } catch {
    // ignore
  }
}

/** 删除提醒（后端） */
export async function deleteReminderFromBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("delete_reminder", { id });
  } catch {
    // ignore
  }
}