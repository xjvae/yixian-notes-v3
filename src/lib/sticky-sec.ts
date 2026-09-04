// ══════════════════════════════════════════════════════════════
// 便签数据加解密：单便签独立口令加密
//   - 内容（标题 + 待办 + 正文）序列化为 JSON，经 AES-256-GCM 加密成密文
//   - 密文存入 StickyNote.enc_data，明文标题/正文置空
//   - 使用便签自身的口令（与全局加密无关），口令不落盘
// ══════════════════════════════════════════════════════════════
import { encryptText, decryptText } from "./crypto";
import type { StickyNote, StickyContentType } from "@/shared/types";

/** 参与加密的便签内容子集 */
export interface StickySecContent {
  title: string;
  items: string[];
  body: string;
  content_type: StickyContentType;
}

/** 从便签提取需加密的内容（加密时明文已被清空，需从 enc_data 还原后合并） */
export function extractSecContent(note: StickyNote): StickySecContent {
  return {
    title: note.title ?? "",
    items: note.items ?? [],
    body: note.body ?? "",
    content_type: note.content_type ?? "todo",
  };
}

export function serializeSec(c: StickySecContent): string {
  return JSON.stringify({ v: 1, ...c });
}

export function deserializeSec(json: string): StickySecContent | null {
  try {
    const o = JSON.parse(json) as Partial<StickySecContent> & { v?: number };
    if (!o || typeof o !== "object") return null;
    return {
      title: o.title ?? "",
      items: Array.isArray(o.items) ? o.items : [],
      body: o.body ?? "",
      content_type: o.content_type === "text" ? "text" : "todo",
    };
  } catch {
    return null;
  }
}

/** 用独立口令加密便签内容 → 返回密文（供存入 enc_data） */
export async function encryptSecContent(
  password: string,
  content: StickySecContent,
): Promise<string> {
  return encryptText(password, serializeSec(content));
}

/** 用独立口令解密密文 → 明文内容；口令错误返回 null */
export async function decryptSecContent(
  password: string,
  encData: string,
): Promise<StickySecContent | null> {
  const plain = await decryptText(password, encData);
  if (!plain) return null;
  return deserializeSec(plain);
}

/** 判断便签是否处于“加密”状态（已加密且含密文） */
export function isNoteEncrypted(note: StickyNote): boolean {
  return !!note.encrypted && !!note.enc_data;
}

/** 判断便签是否处于锁定状态 */
export function isNoteLocked(note: StickyNote): boolean {
  return !!note.locked;
}