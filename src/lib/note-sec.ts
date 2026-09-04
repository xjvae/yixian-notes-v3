// ══════════════════════════════════════════════════════════════
// 笔记数据加解密：单笔记独立口令加密
//   - 内容（标题 + 正文 + 摘要）序列化为 JSON，经 AES-256-GCM 加密成密文
//   - 密文存入 INote.enc_data，明文标题/正文置空
//   - 使用笔记自身的口令（与全局加密无关），口令不落盘
//   - 与便签加密 sticky-sec.ts 共用同一套 crypto.ts，仅在“参与加密的
//     字段”上有差异，其它结构保持一致，便于后续统一抽层。
// ══════════════════════════════════════════════════════════════
import { encryptText, decryptText } from "./crypto";

/** 参与加密的笔记内容子集 */
export interface NoteSecContent {
  title: string;
  content: string;
  excerpt: string;
}

/** 从笔记提取需加密的内容（加密时明文已被清空，需从 enc_data 还原后合并） */
export function extractNoteSecContent(note: {
  title?: string;
  content?: string;
  excerpt?: string;
}): NoteSecContent {
  return {
    title: note.title ?? "",
    content: note.content ?? "",
    excerpt: note.excerpt ?? "",
  };
}

export function serializeNoteSec(c: NoteSecContent): string {
  return JSON.stringify({ v: 1, ...c });
}

export function deserializeNoteSec(json: string): NoteSecContent | null {
  try {
    const o = JSON.parse(json) as Partial<NoteSecContent> & { v?: number };
    if (!o || typeof o !== "object") return null;
    return {
      title: o.title ?? "",
      content: o.content ?? "",
      excerpt: o.excerpt ?? "",
    };
  } catch {
    return null;
  }
}

/** 用独立口令加密笔记内容 → 返回密文（供存入 enc_data） */
export async function encryptNoteSec(
  password: string,
  content: NoteSecContent,
): Promise<string> {
  return encryptText(password, serializeNoteSec(content));
}

/** 用独立口令解密密文 → 明文内容；口令错误返回 null */
export async function decryptNoteSec(
  password: string,
  encData: string,
): Promise<NoteSecContent | null> {
  const plain = await decryptText(password, encData);
  if (!plain) return null;
  return deserializeNoteSec(plain);
}

/** 判断笔记是否处于“加密”状态（已加密且含密文） */
export function isNoteEncrypted(note: { encrypted?: boolean; enc_data?: string }): boolean {
  return !!note.encrypted && !!note.enc_data;
}

/** 判断笔记是否处于锁定状态 */
export function isNoteLocked(note: { locked?: boolean }): boolean {
  return !!note.locked;
}