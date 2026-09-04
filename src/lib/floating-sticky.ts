// ══════════════════════════════════════════════════════════════
// 统一便签（便签墙 + 浮动便签）常量与工具
//   - STICKY_THEMES  统一主题色板
//   - STICKY_PAPERS  纸张背景模板
//   - getPaperStyle  按纸张模板与主题生成 CSS 样式
//   - 统一存储读写（localStorage，按工作区隔离）与旧数据迁移
// ══════════════════════════════════════════════════════════════
import type { CSSProperties } from "react";
import type { StickyNote, StickyPaper } from "@/shared/types";
import { genId } from "@/lib/id";

// ── 统一便签存储 key（按工作区隔离；与 useWorkspaceStorage 的 wsKey 一致）──
export const UNIFIED_STICKIES_KEY = "yixian_unified_stickies";
/** 旧便签墙数据 key（useNoteOperations） */
export const LEGACY_STICKY_KEY = "yixian_sticky_notes";
/** 旧浮动便签数据 key（use-floating-notes，子带 :{ws} 后缀） */
export const LEGACY_FLOATING_KEY_PREFIX = "__app_yixian_floating_notes";

const wsSuffix = (ws?: string) => (ws ? `::ws::${ws}` : "");
/** 统一便签存储 key（含工作区维度） */
export const unifiedStickiesStorageKey = (ws?: string) =>
  `${UNIFIED_STICKIES_KEY}${wsSuffix(ws)}`;
/** 旧便签墙存储 key（含工作区维度，与 useNoteOperations/wsKey 一致） */
export const legacyStickyStorageKey = (ws?: string) =>
  `${LEGACY_STICKY_KEY}${wsSuffix(ws)}`;
/**
 * 旧浮动便签存储 key（含工作区维度）。
 * 注意：use-floating-notes 使用 `base + ':' + ws`（单冒号）隔离，
 * 与 wsKey 的 `::ws::` 不同，迁移时必须对齐旧格式。
 */
export const legacyFloatingStorageKey = (ws?: string) =>
  ws ? `${LEGACY_FLOATING_KEY_PREFIX}:${ws}` : LEGACY_FLOATING_KEY_PREFIX;

// ══════════════════════════════════════════════════════════════
// 统一主题色板（对齐参考仓库：yellow/pink/blue/green/purple/orange）
// ══════════════════════════════════════════════════════════════
/** 颜色关键词 → 十六进制背景色（供网格/主题选择渲染） */
export const STICKY_COLORS: Record<string, string> = {
  yellow: "#FEF3C7",
  pink: "#FCE7F3",
  blue: "#DBEAFE",
  green: "#D1FAE5",
  purple: "#EDE9FE",
  orange: "#FED7AA",
};

export const STICKY_THEMES = [
  { id: "yellow", label: "柠檬黄", color: "#FEF3C7", glass: "linear-gradient(165deg, rgba(250, 204, 120, 0.42), rgba(186, 138, 58, 0.26))", tape: "rgba(250, 204, 120, 0.88)" },
  { id: "pink", label: "樱花粉", color: "#FCE7F3", glass: "linear-gradient(165deg, rgba(244, 164, 200, 0.40), rgba(176, 98, 148, 0.25))", tape: "rgba(244, 164, 200, 0.88)" },
  { id: "blue", label: "天空蓝", color: "#DBEAFE", glass: "linear-gradient(165deg, rgba(140, 180, 250, 0.38), rgba(88, 118, 198, 0.25))", tape: "rgba(140, 180, 250, 0.88)" },
  { id: "green", label: "薄荷绿", color: "#D1FAE5", glass: "linear-gradient(165deg, rgba(134, 218, 194, 0.38), rgba(66, 148, 128, 0.24))", tape: "rgba(134, 218, 194, 0.90)" },
  { id: "purple", label: "薰衣紫", color: "#EDE9FE", glass: "linear-gradient(165deg, rgba(167, 139, 250, 0.52), rgba(108, 78, 198, 0.32))", tape: "rgba(139, 111, 240, 0.92)" },
  { id: "orange", label: "蜜橘橙", color: "#FED7AA", glass: "linear-gradient(165deg, rgba(242, 166, 90, 0.50), rgba(188, 110, 42, 0.30))", tape: "rgba(242, 166, 90, 0.92)" },
];

/** 十六进制 → 主题 key（旧便签墙 hex 配色映射；未知回退黄色） */
export function themeKeyByColor(hex?: string): string {
  if (!hex) return "yellow";
  const h = hex.trim().toLowerCase();
  const hit = STICKY_THEMES.find((t) => t.color.toLowerCase() === h);
  if (hit) return hit.id;
  const legacy: Record<string, string> = {
    "#fef9c3": "yellow", "#fffbeb": "yellow", "#fef3c7": "yellow", "#ffe89a": "yellow",
    "#dcfce7": "green", "#ccfbf1": "green", "#d4f3de": "green", "#d1fae5": "green",
    "#fce7f3": "pink", "#fecdd3": "pink", "#fee2e2": "pink", "#ffd4e2": "pink",
    "#dbeafe": "blue", "#d6ecff": "blue",
    "#ede9fe": "purple", "#e0e7ff": "purple", "#e7e0ff": "purple",
    "#ffedd5": "orange", "#ffdcc7": "orange",
  };
  return legacy[h] ?? "yellow";
}

/** 主题 key → 背景色 */
export function themeColor(id?: string): string {
  return STICKY_THEMES.find((t) => t.id === id)?.color || STICKY_THEMES[0].color;
}
/** 主题 key → 深色玻璃渐变 */
export function themeGlass(id?: string): string {
  return STICKY_THEMES.find((t) => t.id === id)?.glass || STICKY_THEMES[0].glass;
}
/** 主题 key → 顶部胶带色 */
export function themeTape(id?: string): string {
  return STICKY_THEMES.find((t) => t.id === id)?.tape || STICKY_THEMES[0].tape;
}

// ══════════════════════════════════════════════════════════════
// 纸张模板系统
// ══════════════════════════════════════════════════════════════
export const STICKY_PAPERS = [
  { id: "blank", label: "空白纸", desc: "纯净无纹理" },
  { id: "ruled", label: "横线本", desc: "水平横线" },
  { id: "grid", label: "方格本", desc: "方格网格" },
  { id: "dot", label: "点阵本", desc: "点阵网格" },
  { id: "kraft", label: "牛皮纸", desc: "复古质感" },
  { id: "letter", label: "信纸", desc: "淡雅信纸" },
] as const;

/** 根据纸张模板与主题颜色生成 CSS 样式 */
export function getPaperStyle(
  paper: StickyPaper | string | undefined,
  themeColor: string,
): CSSProperties {
  const p = paper ?? "blank";
  const lineColor = "rgba(0,0,0,0.08)";
  switch (p) {
    case "ruled":
      return {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 27px, ${lineColor} 27px, ${lineColor} 28px)`,
        backgroundSize: "100% 28px",
        backgroundPosition: "0 8px",
      };
    case "grid":
      return {
        backgroundImage: `
          repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent 20px),
          repeating-linear-gradient(to bottom, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent 20px)
        `,
        backgroundSize: "20px 20px",
      };
    case "dot":
      return {
        backgroundImage: `radial-gradient(${lineColor} 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 8px",
      };
    case "kraft":
      return {
        background: "#E8DCC8",
        backgroundImage: `repeating-linear-gradient(45deg, rgba(180,150,100,0.03) 0, rgba(180,150,100,0.03) 1px, transparent 1px, transparent 4px)`,
      };
    case "letter":
      return {
        backgroundColor: "#FFFBF0",
        backgroundImage: `
          repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(150,100,50,0.1) 27px, rgba(150,100,50,0.1) 28px),
          linear-gradient(to right, rgba(200,50,50,0.15) 0, rgba(200,50,50,0.15) 1px, transparent 1px)
        `,
        backgroundSize: "100% 28px, 40px 100%",
        backgroundPosition: "0 8px, 0 0",
      };
    default:
      return { background: themeColor };
  }
}

// ══════════════════════════════════════════════════════════════
// 默认值 / 工厂
// ══════════════════════════════════════════════════════════════
export const STICKY_DEFAULTS = {
  // 宽度容纳标题栏全部操作按钮的同时，与"卷起(最小化)状态"保持一致 (卷起时裁切为 260px)
  width: 260,
  height: 220,
  theme: "yellow",
  opacity: 1.0,
  always_on_top: true,
  pin_mode: "always" as const,
  paper: "blank" as const,
};

/** 生成新便签 id */
export function genStickyId(): string {
  return genId("sticky", 5);
}

/** 创建一张全新的统一便签（默认在网格中） */
export function createDefaultSticky(partial?: Partial<StickyNote>): StickyNote {
  const now = Date.now();
  return {
    id: genStickyId(),
    title: "",
    items: [""],
    theme: "yellow",
    pinned: false,
    x: null,
    y: null,
    width: STICKY_DEFAULTS.width,
    height: STICKY_DEFAULTS.height,
    collapsed: false,
    private: false,
    floating: false,
    content_type: "todo",
    body: "",
    order: now,
    opacity: STICKY_DEFAULTS.opacity,
    always_on_top: STICKY_DEFAULTS.always_on_top,
    pin_mode: STICKY_DEFAULTS.pin_mode,
    deleted: false,
    paper: STICKY_DEFAULTS.paper,
    capsule_collapsed: false,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

// ══════════════════════════════════════════════════════════════
// 统一存储读写（浮动独立窗口与主窗通过同一份 localStorage 同步）
// ══════════════════════════════════════════════════════════════
export function readUnifiedStickies(ws?: string): StickyNote[] {
  try {
    const raw = localStorage.getItem(unifiedStickiesStorageKey(ws));
    if (raw) {
      const parsed = JSON.parse(raw) as StickyNote[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function writeUnifiedStickies(ws: string | undefined, stickies: StickyNote[]): void {
  try {
    localStorage.setItem(unifiedStickiesStorageKey(ws), JSON.stringify(stickies));
  } catch {
    /* ignore */
  }
}

export function readUnifiedSticky(ws: string | undefined, id: string): StickyNote | null {
  return readUnifiedStickies(ws).find((n) => n.id === id) ?? null;
}

/** 单条更新并写回（浮动独立窗口编辑时用），返回最新数组 */
export function updateUnifiedStickyInStorage(
  ws: string | undefined,
  id: string,
  updates: Partial<StickyNote>,
): StickyNote[] {
  const list = readUnifiedStickies(ws);
  const next = list.map((n) =>
    n.id === id ? { ...n, ...updates, updated_at: Date.now() } : n,
  );
  writeUnifiedStickies(ws, next);
  return next;
}

// ══════════════════════════════════════════════════════════════
// 旧数据迁移
// ══════════════════════════════════════════════════════════════

/** 判断是否为已统一的新格式 */
export function isUnifiedSticky(n: unknown): boolean {
  return !!n && typeof (n as Record<string, unknown>).content_type === "string";
}

/** 由一行文本生成待办项 string；旧浮动 todo 正文可能用 "- [ ] text" 或 "✓/○" 标记 */
export function lineToItem(line: string, forceChecked?: boolean): string {
  const cleaned = line.replace(/^-\s+\[[ xX]\]\s+/, "").replace(/^[✓○]\s*/, "").replace(/^[-*•]\s*/, "").trim();
  const checked =
    forceChecked !== undefined
      ? forceChecked
      : /^-\s+\[x\]\s+/.test(line) || /^-\s+\[X\]\s+/.test(line) || line.startsWith("✓ ");
  return checked ? `[x] ${cleaned}` : `[ ] ${cleaned}`;
}

/** 旧浮动便签 color（可能是 key 或 hex）→ 统一主题 key */
export function themeKeyByLegacy(color?: string): string {
  if (!color) return "yellow";
  const known = STICKY_THEMES.find((t) => t.id === color);
  if (known) return known.id;
  return themeKeyByColor(color);
}

/**
 * 旧浮动便签（IFloatingNote）→ 统一便签
 * 旧的 type 为 note/quote/text/todo；旧 floating 语义为 popped（已弹出独立窗口）
 */
export function fromLegacyFloating(l: {
  id?: string; content?: string; color?: string;
  type?: string; x?: number; y?: number; width?: number; height?: number;
  opacity?: number; pinned?: boolean; popped?: boolean;
  minimized?: boolean; createdAt?: number; updatedAt?: number;
}): StickyNote {
  const legacyType = l.type ?? "note";
  const isTodo = legacyType === "todo";
  const body = l.content ?? "";
  const m = createDefaultSticky();
  return {
    ...m,
    id: l.id || m.id,
    theme: themeKeyByLegacy(l.color ?? "yellow"),
    pinned: Boolean(l.pinned),
    x: typeof l.x === "number" ? l.x : null,
    y: typeof l.y === "number" ? l.y : null,
    width: typeof l.width === "number" && l.width > 0 ? l.width : m.width,
    height: typeof l.height === "number" && l.height > 0 ? l.height : m.height,
    collapsed: Boolean(l.minimized),
    floating: Boolean(l.popped),
    content_type: isTodo ? "todo" : "text",
    body: isTodo ? undefined : body,
    opacity: typeof l.opacity === "number" ? l.opacity : STICKY_DEFAULTS.opacity,
    created_at: l.createdAt ?? Date.now(),
    updated_at: l.updatedAt ?? Date.now(),
  };
}

/** 旧便签墙（IStickyNote，color 为 hex）→ 统一便签 */
export function fromLegacySticky(s: {
  id?: string; color?: string; pinned?: boolean;
  width?: number; height?: number; content?: string;
  createdAt?: number; updatedAt?: number;
}): StickyNote {
  const m = createDefaultSticky();
  const body = s.content ?? "";
  return {
    ...m,
    id: s.id || m.id,
    theme: themeKeyByLegacy(s.color),
    pinned: Boolean(s.pinned),
    width: typeof s.width === "number" && s.width > 0 ? s.width : m.width,
    height: typeof s.height === "number" && s.height > 0 ? s.height : m.height,
    content_type: "text",
    body,
    created_at: s.createdAt ?? Date.now(),
    updated_at: s.updatedAt ?? Date.now(),
  };
}