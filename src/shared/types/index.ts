// ============================================================
// 一闲笔记 v3 — 统一便签模型（便签墙 + 浮动便签共用）
// 历史版本曾在此文件"按领域"复制 data/notes.ts 的类型，但真实使用时
// 全部改为从 @/data/notes import；本文件现仅保留 6 处仍在引用的便签族类型。
// ============================================================

/** 便签内容类型：todo=待办清单 / text=纯文本 */
export type StickyContentType = "todo" | "text";
/** 置顶模式（浮动窗口） */
export type StickyPinMode = "always" | "dynamic" | "none";
/** 纸张背景模板 */
export type StickyPaper =
  | "blank"
  | "ruled"
  | "grid"
  | "dot"
  | "kraft"
  | "letter";

export interface StickyNote {
  id: string;
  /** 标题 */
  title: string;
  /** 待办内容：每项形如 "[ ] 文本" / "[x] 文本"（content_type="todo" 时使用） */
  items: string[];
  /** 主题色 key（yellow/pink/blue/green/purple/orange） */
  theme: string;
  /** 是否置顶（便签墙网格内置顶） */
  pinned: boolean;
  /** 位置（浮动窗口使用；网格内无意义） */
  x: number | null;
  y: number | null;
  /** 宽度/高度（px，可为 null） */
  width: number | null;
  height: number | null;
  /** 是否折叠（网格内仅显示标题行） */
  collapsed: boolean;
  /** 是否私密 */
  private: boolean;
  /** 是否以桌面浮动窗口形式展示（脱离网格、置顶、可拖拽） */
  floating: boolean;
  /** 内容类型：todo=待办清单 / text=纯文本 */
  content_type: StickyContentType;
  /** 纯文本正文（content_type="text" 时使用） */
  body?: string;
  /** 排序顺序（越小越靠前） */
  order?: number;
  /** 浮动窗口透明度 0.3~1.0（默认 1.0） */
  opacity?: number;
  /** 浮动窗口是否始终置顶（默认 true） */
  always_on_top?: boolean;
  /** 置顶模式：always/dynamic/none */
  pin_mode?: StickyPinMode;
  /** 软删除标记 */
  deleted?: boolean;
  /** 锁定：锁定后无法编辑/操作（仅展示解锁） */
  locked?: boolean;
  /** 单便签独立加密（与全局加密无关，使用独立口令） */
  encrypted?: boolean;
  /** 加密后的内容密文（encryptText 产物；锁定或加密时明文标题/正文会被置空） */
  enc_data?: string;
  /** 纸张模板 */
  paper?: StickyPaper;
  /** 胶囊折叠状态 */
  capsule_collapsed?: boolean;
  /** 便签墙"自由钉放"模式下的画布 X 坐标（px，相对画布左上角；undefined=未放置自动排布） */
  wallX?: number;
  /** 便签墙"自由钉放"模式下的画布 Y 坐标（px） */
  wallY?: number;
  /** 便签墙"自由钉放"模式下的旋转角度（度，可为任意角度） */
  wallRotation?: number;
  created_at: number;
  updated_at: number;
}