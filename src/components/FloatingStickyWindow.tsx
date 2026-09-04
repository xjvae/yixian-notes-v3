// ══════════════════════════════════════════════════════════════
// 浮动便签独立 OS 窗口（基于统一 StickyNote 模型）
//
// 数据方案：主窗与独立窗共用同一份统一 localStorage（按工作区隔离）。
//   - 主窗（StickyWall/FloatingStickyManager）在"浮动"时标记 floating=true
//     并调用 create_floating_sticky 创建本窗口；
//   - 本窗口按 window.__STICKY_ID__ / __STICKY_WS__ 从统一存储读取 StickyNote，
//     编辑后写回统一存储，主窗通过 storage 事件实时感知；
//   - "收回到主窗" 将 floating 置回 false 并关闭窗口，便签重新出现在便签墙网格。
// ══════════════════════════════════════════════════════════════
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import {
  X,
  CornerDownLeft,
  GripHorizontal,
  Minus,
  Pin,
  PinOff,
  Droplet,
  ListChecks,
  AlignLeft,
  Check,
  Palette,
  ChevronUp,
  Lock,
  LockOpen,
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import {
  STICKY_THEMES,
  readUnifiedSticky,
  readUnifiedStickies,
  writeUnifiedStickies,
  createDefaultSticky,
  updateUnifiedStickyInStorage,
} from "@/lib/floating-sticky";
import {
  extractSecContent,
  encryptSecContent,
  decryptSecContent,
  isNoteEncrypted,
  type StickySecContent,
} from "@/lib/sticky-sec";
import type { StickyNote, StickyContentType, StickyPinMode } from "@/shared/types";
import { windowScale } from "@/components/WindowChromeHook";

// 从窗口注入的全局变量 + label 读取便签 id / 工作区 id
function getStickyMeta(): { id: string; ws: string } | null {
  const win = window as unknown as {
    __STICKY_WS__?: string;
    __STICKY_ID__?: unknown;
  };
  const ws = win.__STICKY_WS__;
  try {
    const label = getCurrentWindow().label;
    if (label.startsWith("sticky-")) {
      return { id: label.slice("sticky-".length), ws: ws ?? "" };
    }
  } catch {
    // ignore
  }
  const val = win.__STICKY_ID__;
  if (typeof val === "string" && val) {
    return { id: val, ws: ws ?? "" };
  }
  return null;
}

const themeColor = (id?: string) =>
  STICKY_THEMES.find((t) => t.id === id)?.color || STICKY_THEMES[0].color;

// 待办进度
function getProgress(st: StickyNote): { done: number; total: number } {
  const total = st.items.length;
  const done = st.items.filter((i) => i.startsWith("[x] ")).length;
  return { done, total };
}

export default function FloatingStickyWindow() {
  const meta = useMemo(() => getStickyMeta(), []);
  const stickyId = meta?.id ?? null;
  const ws = meta?.ws ?? undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<StickyNote | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [opacityPanelOpen, setOpacityPanelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [secPrompt, setSecPrompt] = useState<"lock" | "encrypt" | "decrypt" | null>(null);
  const [secError, setSecError] = useState<string | null>(null);
  const [secPw, setSecPw] = useState("");
  // 内存中解开的便签明文（仅本次会话内展示，不写回加密存储；持口令以便编辑后同口令重加密）
  const [revealed, setRevealed] = useState<{ content: StickySecContent; pw: string } | null>(null);
  // 私密便签正文遮罩：true=临时显示正文（可查看/编辑），false=遮罩隐藏
  const [revealedPrivate, setRevealedPrivate] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // 运行时错误浮层（独立窗口无 devtools，直接把错误显示到屏幕）
  useEffect(() => {
    const onErr = (e: ErrorEvent) =>
      setBootError((p) => (p ? `${p}\n\n${e.message}` : e.message));
    const onRej = (e: PromiseRejectionEvent) =>
      setBootError((p) => (p ? `${p}\n\n[async] ${String(e.reason)}` : `[async] ${String(e.reason)}`));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  // 独立窗口：锁死 html/body 溢出，避免出现第二个(页面级)滚动条
  useEffect(() => {
    const el = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      elO: el.style.overflow, elH: el.style.height,
      bO: body.style.overflow, bH: body.style.height,
      rO: root ? root.style.overflow : "", rH: root ? root.style.height : "",
    };
    el.style.overflow = "hidden";
    el.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.margin = "0";
    if (root) { root.style.overflow = "hidden"; root.style.height = "100%"; }
    return () => {
      el.style.overflow = prev.elO; el.style.height = prev.elH;
      body.style.overflow = prev.bO; body.style.height = prev.bH; body.style.margin = "0";
      if (root) { root.style.overflow = prev.rO; root.style.height = prev.rH; }
    };
  }, []);

  const noteRef = useRef<StickyNote | null>(null);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);
  const saveTimerRef = useRef<number | null>(null);
  const confirmTimerRef = useRef<number | null>(null);
  const origSizeRef = useRef<{ w: number; h: number } | null>(null);
  const suppressPersistRef = useRef(false);
  const dragRef = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const minimizedRef = useRef(minimized);
  useEffect(() => {
    minimizedRef.current = minimized;
  }, [minimized]);
  useEffect(() => (() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
  })(), []);

  // 初始加载
  useEffect(() => {
    if (!stickyId) {
      setError("缺少便签 id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fn = readUnifiedSticky(ws, stickyId);
    if (cancelled) return;
    if (!fn || fn.deleted) {
      setError("便签不存在，可能已被删除");
      setLoading(false);
      getCurrentWindow().close().catch(() => {});
      return;
    }
    setNote(fn);
    setLoading(false);
    // 应用初始置顶
    const pinMode = fn.pin_mode ?? "always";
    const onTop = pinMode === "always" ? true : pinMode === "none" ? false : (fn.always_on_top ?? false);
    getCurrentWindow().setAlwaysOnTop(onTop).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stickyId]);

  // 跨窗同步：主窗/其他窗口修改统一存储后，本窗口刷新
  useEffect(() => {
    if (!stickyId) return;
    const onStorage = (e: StorageEvent) => {
      const key = `${ "yixian_unified_stickies" }${ws ? `::ws::${ws}` : ""}`;
      if (e.key !== key) return;
      const fresh = readUnifiedStickies(ws).find((n) => n.id === stickyId);
      if (!fresh || fresh.deleted) {
        getCurrentWindow().close().catch(() => {});
        return;
      }
      setNote(fresh);
      noteRef.current = fresh;
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [stickyId, ws]);

  // 监听窗口移动/缩放，防抖持久化位置
  useEffect(() => {
    if (!stickyId) return;
    const win = getCurrentWindow();
    let timer: number | null = null;
    const persist = () => {
      if (suppressPersistRef.current) return; // 程序化调整大小时不写回，避免覆盖用户尺寸
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const latest = noteRef.current;
        if (!latest) return;
        Promise.allSettled([win.outerPosition(), win.outerSize(), win.scaleFactor()]).then(
          ([p, s, sc]) => {
            const scale = sc.status === "fulfilled" ? sc.value : 1;
            const pos = p.status === "fulfilled" ? p.value : null;
            const size = s.status === "fulfilled" ? s.value : null;
            if (!pos || !size) return;
            updateUnifiedStickyInStorage(ws, stickyId, {
              x: Math.round(pos.x / scale),
              y: Math.round(pos.y / scale),
              width: Math.round(size.width / scale),
              height: Math.round(size.height / scale),
            });
          },
        );
      }, 400);
    };
    let unMoved: (() => void) | undefined;
    let unResized: (() => void) | undefined;
    win.onMoved(persist).then((fn) => (unMoved = fn));
    win.onResized(persist).then((fn) => (unResized = fn));
    return () => {
      if (timer) window.clearTimeout(timer);
      unMoved?.();
      unResized?.();
    };
  }, [stickyId, ws]);

  // 最小化状态：靠近屏幕边缘自动贴边
  useEffect(() => {
    const win = getCurrentWindow();
    let timer: number | null = null;
    let un: (() => void) | undefined;
    const snap = async () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (!minimizedRef.current) return;
        try {
          const scale = (await win.scaleFactor()) || 1;
          const pos = await win.outerPosition(); // 物理像素
          const size = await win.outerSize(); // 物理像素
          // 使用 Web 屏幕信息（CSS 像素）判定边界（主屏原点为 0,0）
          const sL = 0;
          const sT = 0;
          const sW = window.screen.width;
          const sH = window.screen.height;
          const px = pos.x / scale; // CSS 像素
          const py = pos.y / scale;
          const pw = size.width / scale;
          const ph = size.height / scale;
          const T = 60;
          let nx = pos.x;
          let ny = pos.y;
          if (Math.abs(px - sL) <= T) nx = Math.round(sL * scale); // 左
          else if (Math.abs(sL + sW - (px + pw)) <= T) nx = Math.round((sL + sW - pw) * scale); // 右
          if (Math.abs(py - sT) <= T) ny = Math.round(sT * scale); // 上
          else if (Math.abs(sT + sH - (py + ph)) <= T) ny = Math.round((sT + sH - ph) * scale); // 下
          if (nx !== pos.x || ny !== pos.y) {
            suppressPersistRef.current = true;
            await win.setPosition(new PhysicalPosition(nx, ny));
            suppressPersistRef.current = false;
          }
        } catch {
          // ignore
        }
      }, 200);
    };
    win.onMoved(snap).then((fn) => (un = fn));
    return () => {
      if (un) un();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  /** 防抖写回统一存储 */
  const persist = useCallback(
    (updates: Partial<StickyNote>) => {
      if (!stickyId) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        const latest = noteRef.current;
        if (latest) updateUnifiedStickyInStorage(ws, stickyId, updates);
      }, 300);
      // 立即同步本地 state 以获得流畅响应
      setNote((prev) => (prev ? { ...prev, ...updates, updated_at: Date.now() } : prev));
    },
    [stickyId, ws],
  );

  // 收回到主窗
  const handleRecall = useCallback(() => {
    if (!stickyId) return;
    updateUnifiedStickyInStorage(ws, stickyId, { floating: false, x: null, y: null });
    getCurrentWindow().close().catch(() => {});
  }, [stickyId, ws]);

  // 最小化/展开：步进改变窗口高度，让整张便签(非仅顶部栏)呈现纸张卷起/展开
  const applyMinimized = useCallback((toMinimized: boolean) => {
    const win = getCurrentWindow();
    suppressPersistRef.current = true;
    const delay = (ms: number) => new Promise<number>((r) => window.setTimeout(r, ms));
    (async () => {
      try {
        const scale = (await win.scaleFactor()) || 1;
        const size = await win.outerSize(); // 物理像素
        const lw = Math.round(size.width / scale);
        const lh = Math.round(size.height / scale);
        const TARGET_H = 44;
        if (toMinimized) {
          origSizeRef.current = { w: lw, h: lh };
          const steps = Math.max(10, Math.round((lh - TARGET_H) / 45));
          for (let i = 1; i <= steps; i++) {
            await win.setSize(new LogicalSize(Math.min(lw, 260), Math.round(lh - (lh - TARGET_H) * (i / steps))));
            await delay(10);
          }
          // 动画结束才切换为“卷起条”（保持展开内容在收缩中被裁切，产生卷纸感）
          setMinimized(true);
        } else if (origSizeRef.current) {
          const o = origSizeRef.current;
          setMinimized(false); // 立即展开内容，配合窗口生长
          const steps = Math.max(10, Math.round((o.h - TARGET_H) / 45));
          for (let i = 1; i <= steps; i++) {
            await win.setSize(new LogicalSize(o.w, Math.round(TARGET_H + (o.h - TARGET_H) * (i / steps))));
            await delay(10);
          }
          origSizeRef.current = null;
        }
      } catch {
        if (toMinimized) setMinimized(true);
        else { setMinimized(false); origSizeRef.current = null; }
      } finally {
        suppressPersistRef.current = false;
      }
    })();
  }, []);

  // 卷起条自定义拖动(含贴边)：用画布外的绝对屏幕坐标(screenX/Y)计算位移，
  // 这样窗口跟随鼠标移动、不因窗口自身位置变化而失效
  const stripDown = async (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // 展开按钮不触发拖动
    const win = getCurrentWindow();
    try {
      const pos = await win.outerPosition();
      dragRef.current = { sx: e.screenX, sy: e.screenY, wx: pos.x, wy: pos.y };
      suppressPersistRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
  };
  const stripMove = async (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const win = getCurrentWindow();
    try {
      const scale = (await win.scaleFactor()) || 1;
      let nx = d.wx + Math.round((e.screenX - d.sx) * scale);
      let ny = d.wy + Math.round((e.screenY - d.sy) * scale);
      // 边缘贴边
      const sW = window.screen.width;
      const sH = window.screen.height;
      const T = 60;
      const px = nx / scale;
      const py = ny / scale;
      const pw = (await win.outerSize()).width / scale;
      const ph = (await win.outerSize()).height / scale;
      if (Math.abs(px - 0) <= T) nx = 0; // 左
      else if (Math.abs(sW - (px + pw)) <= T) nx = Math.round((sW - pw) * scale); // 右
      if (Math.abs(py - 0) <= T) ny = 0; // 上
      else if (Math.abs(sH - (py + ph)) <= T) ny = Math.round((sH - ph) * scale); // 下
      await win.setPosition(new PhysicalPosition(nx, ny));
    } catch { /* ignore */ }
  };
  const stripUp = () => {
    dragRef.current = null;
    suppressPersistRef.current = false;
  };

  // 删除（软删除，可恢复）
  // 删除：两次点击确认，防止误删（原生 window.confirm 在 WebView2 中常被抑制，改为应用内两步确认）
  const doDelete = useCallback(() => {
    if (!stickyId) return;
    updateUnifiedStickyInStorage(ws, stickyId, { deleted: true });
    getCurrentWindow().close().catch(() => {});
  }, [stickyId, ws]);

  const handleDelete = useCallback(() => {
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
    setConfirmDelete((c) => {
      if (c) {
        // 二次点击确认删除
        setConfirmDelete(false);
        doDelete();
        return false;
      }
      // 首次点击进入确认态，3 秒后自动复位
      confirmTimerRef.current = window.setTimeout(() => setConfirmDelete(false), 3000);
      return true;
    });
  }, [doDelete]);

  // ── 锁定 / 独立加密 ──
  const handleToggleLock = useCallback(() => {
    if (!stickyId || !noteRef.current) return;
    const locked = !noteRef.current.locked;
    persist({ locked });
  }, [stickyId, persist]);

  /** 加密当前便签内容（需要用户先在弹层输入独立口令） */
  const doEncrypt = useCallback(
    async (pw: string) => {
      if (!stickyId || !noteRef.current) return false;
      const cur = noteRef.current;
      if (isNoteEncrypted(cur)) {
        setSecError("该便签已加密");
        return false;
      }
      if (!pw) {
        setSecError("请输入口令");
        return false;
      }
      const encData = await encryptSecContent(pw, extractSecContent(cur));
      if (!encData) {
        setSecError("加密失败");
        return false;
      }
      updateUnifiedStickyInStorage(ws, stickyId, {
        encrypted: true,
        enc_data: encData,
        title: "🔒 已加密",
        items: [],
        body: "",
        locked: true,
      });
      setNote((p) =>
        p
          ? { ...p, encrypted: true, enc_data: encData, title: "🔒 已加密", items: [], body: "", locked: true, updated_at: Date.now() }
          : p,
      );
      return true;
    },
    [stickyId, ws],
  );

  /** 查看加密便签：解密到内存（仅本次会话展示，不写回存储，保持加密态） */
  const doDecrypt = useCallback(
    async (pw: string) => {
      if (!stickyId || !noteRef.current) return false;
      const cur = noteRef.current;
      if (!cur.enc_data) return false;
      const sec = await decryptSecContent(pw, cur.enc_data);
      if (!sec) {
        setSecError("口令错误或数据损坏");
        return false;
      }
      setRevealed({ content: sec, pw });
      return true;
    },
    [stickyId],
  );

  /** 永久解除加密：校验口令并把明文写回（之后可正常编辑，不再加密） */
  const doRemoveEncryption = useCallback(
    async (pw: string) => {
      if (!stickyId || !noteRef.current) return false;
      const cur = noteRef.current;
      if (!cur.enc_data) return false;
      const sec = await decryptSecContent(pw, cur.enc_data);
      if (!sec) {
        setSecError("口令错误或数据损坏");
        return false;
      }
      updateUnifiedStickyInStorage(ws, stickyId, {
        encrypted: false,
        enc_data: undefined,
        title: sec.title,
        items: sec.items,
        body: sec.body,
        content_type: sec.content_type,
        locked: false,
      });
      setNote((p) =>
        p
          ? {
              ...p,
              encrypted: false,
              enc_data: undefined,
              title: sec.title,
              items: sec.items,
              body: sec.body,
              content_type: sec.content_type,
              locked: false,
              updated_at: Date.now(),
            }
          : p,
      );
      setRevealed(null);
      return true;
    },
    [stickyId, ws],
  );

  /** 编辑已解密的加密便签：本地即时更新 + 延时用同一口令重加密写回（存储始终为密文） */
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRevContent = useCallback(
    (next: StickySecContent) => {
      setRevealed((p) => (p ? { ...p, content: next } : p));
      if (revTimer.current) clearTimeout(revTimer.current);
      revTimer.current = setTimeout(async () => {
        const pw = revealed?.pw;
        if (!stickyId || !pw) return;
        const encData = await encryptSecContent(pw, next);
        if (encData) updateUnifiedStickyInStorage(ws, stickyId, { enc_data: encData, updated_at: Date.now() });
      }, 600);
    },
    [stickyId, ws],
  );

  /** 通用口令弹层提交 */
  const submitSec = useCallback(
    async (pw: string) => {
      setSecError(null);
      let ok = false;
      if (secPrompt === "encrypt") ok = await doEncrypt(pw);
      else if (secPrompt === "decrypt") ok = await doDecrypt(pw);
      else {
        // 永久解除加密：校验口令并把明文写回（之后可正常编辑）
        ok = await doRemoveEncryption(pw);
      }
      if (ok) setSecPrompt(null);
    },
    [secPrompt, doEncrypt, doDecrypt, doRemoveEncryption],
  );

  // 切换 content_type
  const handleChangeType = useCallback(
    (next: StickyContentType) => {
      if (!note || !stickyId) return;
      if (note.locked) return; // 锁定后不可再改内容类型
      if (next === note.content_type) return;
      if (next === "text") {
        const body =
          (note.body ?? "").trim().length > 0
            ? note.body
            : note.items
                .map((i) => i.replace(/^\[x\] /, "✓ ").replace(/^\[ \] /, "○ "))
                .join("\n");
        persist({ content_type: "text", body });
      } else {
        const existingItems = note.items ?? [];
        const items =
          existingItems.length > 0 && existingItems.some((i) => i.trim().length > 0)
            ? existingItems
            : (note.body ?? "")
                .split("\n")
                .filter((l) => l.trim().length > 0)
                .map((l) => {
                  const checked = l.startsWith("✓ ");
                  return checked ? `[x] ${l.replace(/^[✓○]\s*/, "")}` : `[ ] ${l.replace(/^[✓○]\s*/, "")}`;
                });
        persist({ content_type: "todo", items: items.length === 0 ? [""] : items });
      }
    },
    [note, stickyId, persist],
  );

  const handleChangeTheme = useCallback(
    (theme: string) => {
      if (!stickyId) return;
      persist({ theme });
      setPaletteOpen(false);
    },
    [stickyId, persist],
  );

  const handleOpacityChange = useCallback(
    (opacity: number) => {
      if (!stickyId) return;
      // 透明度由 root 的 CSS opacity 呈现（Tauri 原生 opacity API 在此版本不可用）
      persist({ opacity });
    },
    [stickyId, persist],
  );

  // 置顶三态循环 always → dynamic → none → always
  const handleTogglePinMode = useCallback(() => {
    if (!note || !stickyId) return;
    const cur = note.pin_mode ?? "always";
    const next = cur === "always" ? "dynamic" : cur === "dynamic" ? "none" : "always" as StickyPinMode;
    const onTop = next === "always" ? true : next === "none" ? false : (note.always_on_top ?? false);
    persist({ pin_mode: next, always_on_top: onTop });
    getCurrentWindow().setAlwaysOnTop(onTop).catch(() => {});
  }, [note, stickyId, persist]);

  // ── 内容编辑 ──
  const handleTitleChange = (value: string) => persist({ title: value });
  const handleBodyChange = (value: string) => persist({ body: value });
  const handleItemChange = (idx: number, value: string) => {
    if (!note) return;
    const items = [...note.items];
    items[idx] = value;
    persist({ items });
  };
  const handleToggleItem = (idx: number, checked: boolean) => {
    if (!note) return;
    const text = note.items[idx].replace(/^\[x\] /, "").replace(/^\[ \] /, "");
    const items = [...note.items];
    items[idx] = checked ? `[x] ${text}` : `[ ] ${text}`;
    persist({ items });
  };
  const handleRemoveItem = (idx: number) => {
    if (!note) return;
    const items = note.items.filter((_, i) => i !== idx);
    persist({ items: items.length === 0 ? [""] : items });
  };
  const handleAddItem = () => {
    if (!note) return;
    persist({ items: [...note.items, ""] });
  };

  // 新建一张浮动便签（写入统一存储 + 创建独立窗口，位置偏移到当前窗口旁）
  const handleNewSticky = useCallback(async () => {
    // 以当前窗口位置为基础，向右下偏移，避免与当前便签重叠
    let nx = 80;
    let ny = 100;
    try {
      const scale = await windowScale();
      const pos = await getCurrentWindow().outerPosition();
      nx = Math.round(pos.x / scale) + 24;
      ny = Math.round(pos.y / scale) + 24;
    } catch {
      /* 使用默认位置 */
    }
    const placed = createDefaultSticky({ floating: true, x: nx, y: ny });
    writeUnifiedStickies(ws, [...readUnifiedStickies(ws), placed]);
    // 通知后端为主进程创建一个新便签窗口（独立窗口自身也可以创建 sibling 窗口）
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("create_floating_sticky", {
        id: placed.id,
        x: nx,
        y: ny,
        w: placed.width ?? 260,
        h: placed.height ?? 280,
        alwaysOnTop: true,
        workspaceId: ws ?? null,
      });
    } catch {
      /* 创建窗口失败时仅保留便签数据 */
    }
  }, [ws]);

  if (loading) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center text-xs"
        style={{ color: "rgba(0,0,0,0.5)", background: "#FEF3C7", width: "100vw", height: "100vh" }}
      >
        加载中…
      </div>
    );
  }

  if (error || !note) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center p-4 text-center text-xs"
        style={{ color: "rgba(0,0,0,0.5)", background: "#FEF3C7", width: "100vw", height: "100vh" }}
      >
        {error || "便签数据加载中…"}
      </div>
    );
  }

  const themeBg = themeColor(note.theme);
  const isText = (note.content_type ?? "todo") === "text";
  const { done, total } = getProgress(note);
  const allDone = total > 0 && done === total;
  const pinMode = note.pin_mode ?? "always";
  const isLocked = !!note.locked;
  const isEnc = isNoteEncrypted(note);

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: themeBg,
        borderRadius: 8,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        maxHeight: "100vh",
        opacity: note.opacity ?? 1,
      }}
    >
      {/* ======= 最小化：卷起的纸张条，仅显示标题；可拖动，靠边自动贴边 ======= */}
      {minimized ? (
        <div
          className="yx-prp-chip relative flex h-full w-full shrink-0 items-center gap-1 pl-2 pr-1.5"
          style={{
            background: themeBg,
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            userSelect: "none",
            cursor: "move",
            touchAction: "none",
          }}
          onDoubleClick={() => {
            if (confirmDelete) setConfirmDelete(false);
            applyMinimized(false);
          }}
          onPointerDown={stripDown}
          onPointerMove={stripMove}
          onPointerUp={stripUp}
          onPointerCancel={stripUp}
        >
          {/* 卷起的纸张边缘（卷轴） */}
          <div
            className="yx-prp-curl h-5 w-0.5 shrink-0 rounded-full"
            style={{ background: "rgba(0,0,0,0.18)", boxShadow: "0 0 2px rgba(0,0,0,0.25)" }}
          />
          {/* 仅显示标题（点击不展开） */}
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" title={note.title || "浮动便签"}>
            {note.title || "浮动便签"}
          </span>
          {/* 展开按钮 */}
          <button
            title="展开"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDelete) setConfirmDelete(false);
              applyMinimized(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-[var(--muted)]"
            style={{ color: "rgba(0,0,0,0.45)" }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          {/* 新建一张浮动便签 */}
          <button
            title="新建浮动便签"
            onClick={(e) => {
              e.stopPropagation();
              handleNewSticky();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-[var(--muted)]"
            style={{ color: "rgba(0,0,0,0.45)" }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* ======= 展开态：顶部拖拽手柄 + 操作按钮 ======= */
      <div
        data-tauri-drag-region
        onDoubleClick={() => applyMinimized(!minimized)}
        className="yx-prp-panel-roll flex shrink-0 items-center justify-between px-2 py-2"
        style={{
          userSelect: "none",
          cursor: "move",
          touchAction: "none",
          minHeight: 36,
          borderBottom: minimized ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex min-w-0 items-center gap-1" data-tauri-drag-region>
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(0,0,0,0.4)" }} />
          <span
            className="max-w-[200px] truncate text-[10px] font-medium"
            style={{ color: "rgba(0,0,0,0.55)" }}
            title={note.title || "浮动便签"}
          >
            {note.title || "浮动便签"}
          </span>
          {total > 0 && !isText && (
            <span
              className="shrink-0 rounded-full px-1.5 text-[9px] font-semibold"
              style={{
                background: allDone ? "rgba(22,163,74,0.18)" : "rgba(0,0,0,0.08)",
                color: allDone ? "#15803D" : "rgba(0,0,0,0.6)",
              }}
            >
              {done}/{total}
            </span>
          )}
          <Check className="h-3 w-3 shrink-0" style={{ color: "rgba(22,163,74,0.5)" }} />
        </div>
        <div className="min-w-0 flex-1" data-tauri-drag-region />
        <div
            className="flex shrink-0 items-center gap-0.5 relative"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
          {/* 新建一张浮动便签 */}
          <button
            title="新建浮动便签"
            onClick={handleNewSticky}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--muted)]"
            style={{ color: "rgba(0,0,0,0.55)" }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {/* 私密 / 取消私密 */}
          <button
            title={note.private ? "取消私密" : "标记私密"}
            onClick={() => {
              persist({ private: !note.private });
              // 切换私密后回到"默认遮罩隐藏"态
              setRevealedPrivate(false);
            }}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--muted)]"
            style={{ color: note.private ? "#B45309" : "rgba(0,0,0,0.5)" }}
          >
            {note.private ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {/* 最小化 */}
          <button
            title={minimized ? "展开" : "最小化"}
            onClick={() => applyMinimized(!minimized)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--muted)]"
            style={{ color: "rgba(0,0,0,0.5)" }}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          {/* 锁定 / 解锁 */}
          <button
            title={isLocked ? "解锁" : "锁定（锁定后无法操作）"}
            onClick={handleToggleLock}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--muted)]"
            style={{ color: isLocked ? "var(--primary)" : "rgba(0,0,0,0.5)" }}
          >
            {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
          {/* 删除（两步确认防误删） */}
          <button
            title={confirmDelete ? "再次点击确认删除" : "删除便签"}
            onClick={handleDelete}
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
              confirmDelete ? "bg-red-500 hover:bg-red-600" : "hover:bg-[var(--muted)]"
            }`}
            style={{ color: confirmDelete ? "#fff" : "rgba(0,0,0,0.5)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* 更多：其余操作折叠到这里 */}
          <div className="relative">
            <button
              title="更多"
              onClick={() => setMoreOpen((o) => !o)}
              className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--muted)]"
              style={{ color: "rgba(0,0,0,0.5)" }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {moreOpen && (
              <div
                className="absolute right-0 top-full z-30 mt-1 flex min-w-[160px] flex-col rounded-md p-1 shadow-lg"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)" }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  title="切换内容类型"
                  disabled={isLocked}
                  onClick={() => {
                    if (!isLocked) handleChangeType(isText ? "todo" : "text");
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                >
                  {isText ? (
                    <ListChecks className="h-3.5 w-3.5" />
                  ) : (
                    <AlignLeft className="h-3.5 w-3.5" />
                  )}
                  切换内容类型
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                  onClick={() => {
                    if (isEnc) setSecPrompt("decrypt");
                    else setSecPrompt("encrypt");
                    setMoreOpen(false);
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {isEnc ? "解除加密" : "独立加密"}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                  onClick={() => {
                    setPaletteOpen(true);
                    setOpacityPanelOpen(false);
                    setMoreOpen(false);
                  }}
                >
                  <Palette className="h-3.5 w-3.5" />
                  主题色
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                  onClick={() => {
                    setOpacityPanelOpen(true);
                    setPaletteOpen(false);
                    setMoreOpen(false);
                  }}
                >
                  <Droplet className="h-3.5 w-3.5" />
                  透明度
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                  onClick={() => {
                    handleTogglePinMode();
                    setMoreOpen(false);
                  }}
                >
                  {pinMode === "none" ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                  置顶
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                  onClick={() => {
                    handleRecall();
                  }}
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  收回到主界面
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 主题色板 */}
      {paletteOpen && !minimized && (
        <div
          className="absolute right-2 top-9 z-10 flex gap-1 rounded-md p-1.5"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
        >
          {STICKY_THEMES.map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => handleChangeTheme(t.id)}
              className="h-5 w-5 rounded-full transition-transform hover:scale-110"
              style={{ background: t.color, outline: note.theme === t.id ? "2px solid #555" : "none", outlineOffset: 1 }}
            />
          ))}
        </div>
      )}

      {/* 透明度面板 */}
      {opacityPanelOpen && !minimized && (
        <div
          className="absolute right-2 top-9 z-10 flex items-center gap-2 rounded-md p-2"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
        >
          <span className="text-[10px]" style={{ color: "rgba(0,0,0,0.5)" }}>透明</span>
          <input
            type="range"
            min={0.3}
            max={1.0}
            step={0.1}
            value={note.opacity ?? 1.0}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="w-8 text-[10px] font-medium" style={{ color: "rgba(0,0,0,0.6)" }}>
            {Math.round((note.opacity ?? 1.0) * 100)}%
          </span>
        </div>
      )}

      {/* 加密便签·未在会话内解开：请输入口令查看（仅内存，不写回存储） */}
      {!minimized && isEnc && !revealed && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4" style={{ overflow: "hidden" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
            <KeyRound className="h-5 w-5" style={{ color: "rgba(0,0,0,0.55)" }} />
          </div>
          <div className="text-center text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
            此便签已用独立口令加密
          </div>
          <button
            onClick={() => {
              setSecPw("");
              setSecPrompt("decrypt");
            }}
            className="mt-1 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium"
            style={{ background: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.7)" }}
          >
            <KeyRound className="h-3.5 w-3.5" /> 输入口令查看
          </button>
        </div>
      )}

      {/* 加密便签·已解开且锁定时：只读展示明文（不可编辑） */}
      {!minimized && isEnc && revealed && isLocked && (
        <div className="pointer-events-none flex min-h-0 flex-1 flex-col px-3 pb-2" style={{ overflow: "hidden", opacity: 0.9 }}>
          <div className="mt-1 mb-1 flex items-center gap-1 text-xs font-semibold" style={{ color: "rgba(0,0,0,0.85)" }}>
            {revealed.content.title || "浮动便签"}
            <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px]" style={{ background: "rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.55)" }}>
              <Lock className="h-2.5 w-2.5" /> 已锁定
            </span>
          </div>
          {revealed.content.content_type === "text" ? (
            <div className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap text-[13px]" style={{ color: "rgba(0,0,0,0.8)" }}>
              {revealed.content.body}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
              {revealed.content.items.map((it, idx) => {
                const itDone = it.startsWith("[x] ");
                return (
                  <div key={idx} className="text-[13px]" style={{ color: itDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)", textDecoration: itDone ? "line-through" : "none" }}>
                    {it.replace(/^\[x\] /, "").replace(/^\[ \] /, "")}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "rgba(0,0,0,0.5)" }}>
            <button onClick={() => setRevealed(null)} className="rounded px-2 py-0.5 hover:bg-black/5">
              收起
            </button>
          </div>
        </div>
      )}

      {/* 加密便签·已解开且解锁：明文可编辑（改动以同一口令重加密写回，存储始终为密文） */}
      {!minimized && isEnc && revealed && !isLocked && (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-1">
          <input
            value={revealed.content.title}
            onChange={(e) => updateRevContent({ ...revealed.content, title: e.target.value })}
            placeholder="便签标题"
            className="mb-1 mt-1 bg-transparent text-sm font-semibold outline-none"
            style={{ color: "rgba(0,0,0,0.85)" }}
          />
          {revealed.content.content_type === "text" ? (
            <textarea
              value={revealed.content.body}
              onChange={(e) => updateRevContent({ ...revealed.content, body: e.target.value })}
              placeholder="开始输入…"
              className="min-h-0 flex-1 resize-none bg-transparent text-[13px] outline-none"
              style={{ color: "rgba(0,0,0,0.8)" }}
            />
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {revealed.content.items.map((it, idx) => {
                const txt = it.replace(/^\[x\] /, "").replace(/^\[ \] /, "");
                const itDone = it.startsWith("[x] ");
                return (
                  <li key={idx} className="flex items-start gap-1">
                    <input
                      type="checkbox"
                      checked={itDone}
                      onChange={(e) => {
                        const next = [...revealed.content.items];
                        next[idx] = `${e.target.checked ? "[x] " : "[ ] "}${txt}`;
                        updateRevContent({ ...revealed.content, items: next });
                      }}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <input
                      value={txt}
                      onChange={(e) => {
                        const next = [...revealed.content.items];
                        next[idx] = `${itDone ? "[x] " : "[ ] "}${e.target.value}`;
                        updateRevContent({ ...revealed.content, items: next });
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                      style={{ color: itDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)", textDecoration: itDone ? "line-through" : "none" }}
                    />
                    <button
                      onClick={() =>
                        updateRevContent({ ...revealed.content, items: revealed.content.items.filter((_, i) => i !== idx) })
                      }
                      className="text-[11px] opacity-50 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
              <li className="flex items-center gap-1">
                <button
                  onClick={() => updateRevContent({ ...revealed.content, items: [...revealed.content.items, "[ ] "] })}
                  className="text-[11px] opacity-50 hover:opacity-100"
                >
                  + 添加
                </button>
              </li>
            </ul>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "rgba(0,0,0,0.5)" }}>
            <button onClick={() => setRevealed(null)} className="rounded px-2 py-0.5 hover:bg-black/5">
              收起
            </button>
            <button
              onClick={() => {
                setSecPw("");
                setSecPrompt("lock");
              }}
              className="rounded px-2 py-0.5 hover:bg-black/5"
              title="把明文写回存储，之后不再加密（谨慎）"
            >
              解除加密
            </button>
          </div>
        </div>
      )}

      {/* 纯锁定（未加密）：只读展示，可读不可编辑 */}
      {!minimized && !isEnc && isLocked && (
        <div className="pointer-events-none flex min-h-0 flex-1 flex-col px-3 pb-2" style={{ overflow: "hidden", opacity: 0.9 }}>
          <div className="mt-1 mb-1 flex items-center gap-1 text-xs font-semibold" style={{ color: "rgba(0,0,0,0.85)" }}>
            {note.title || "浮动便签"}
            <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px]" style={{ background: "rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.55)" }}>
              <Lock className="h-2.5 w-2.5" /> 已锁定
            </span>
          </div>
          {isText ? (
            <div className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap text-[13px]" style={{ color: "rgba(0,0,0,0.8)" }}>
              {note.body}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden" style={{ pointerEvents: "none" }}>
              {note.items.map((item, idx) => {
                const itDone = item.startsWith("[x] ");
                return (
                  <div key={idx} className="text-[13px]" style={{ color: itDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)", textDecoration: itDone ? "line-through" : "none" }}>
                    {item.replace(/^\[x\] /, "").replace(/^\[ \] /, "")}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 可编辑正文 */}
      {!minimized && !isLocked && !isEnc && (() => {
        const masked = note.private && !revealedPrivate;
        return (
        <>
          {/* 私密遮罩：私密且未临时查看时盖住正文（不可读写） */}
          {masked && (
            <div
              className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-2 px-4"
              style={{ overflow: "hidden", background: "rgba(0,0,0,0.04)", userSelect: "none" }}
              onClick={() => setRevealedPrivate(true)}
              title="点击查看内容"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
                <EyeOff className="h-5 w-5" style={{ color: "rgba(0,0,0,0.55)" }} />
              </div>
              <div className="text-center text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
                此便签已标记为私密
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setRevealedPrivate(true); }}
                className="mt-1 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium"
                style={{ background: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.7)" }}
              >
                <Eye className="h-3.5 w-3.5" /> 点击查看
              </button>
            </div>
          )}
          {/* 标题 */}
          <input
            value={note.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="便签标题"
            className="mx-3 mt-2 mb-1 bg-transparent text-base font-semibold outline-none"
            style={{ color: "rgba(0,0,0,0.85)" }}
          />
          {isText ? (
            <textarea
              value={note.body ?? ""}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="在此输入文本内容…"
              className="mx-3 mb-3 min-h-0 flex-1 resize-none bg-transparent text-[13px] outline-none"
              style={{ color: "rgba(0,0,0,0.8)" }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-2" style={{ overflowY: "auto" }}>
              {note.items.map((item, idx) => {
                const checked = item.startsWith("[x] ");
                const text = item.replace(/^\[x\] /, "").replace(/^\[ \] /, "");
                return (
                  <div key={idx} className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleToggleItem(idx, e.target.checked)}
                      className="mt-1"
                    />
                    <textarea
                      value={text}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      onInput={(e) => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = "auto";
                        t.style.height = t.scrollHeight + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = "auto";
                          el.style.height = el.scrollHeight + "px";
                        }
                      }}
                      placeholder="待办内容… (Enter 添加)"
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-[13px] outline-none"
                      style={{
                        color: checked ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.8)",
                        textDecoration: checked ? "line-through" : "none",
                        minHeight: "1.5rem",
                        lineHeight: "1.5",
                        overflow: "hidden",
                        wordBreak: "break-word",
                      }}
                    />
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="mt-0.5 shrink-0 rounded p-0.5 transition-opacity hover:bg-[var(--muted)]"
                      style={{ color: "rgba(0,0,0,0.4)" }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={handleAddItem}
                className="mt-1 flex items-center gap-1 text-xs opacity-60 transition-opacity hover:opacity-100"
                style={{ color: "rgba(0,0,0,0.6)" }}
              >
                <ListChecks className="h-3 w-3" /> 添加条目
              </button>
            </div>
          )}
          {/* 私密但临时查看时：在正文末尾提供"重新隐藏"的开关 */}
          {!masked && note.private && (
            <div
              className="flex justify-end px-3 pb-1"
              style={{ color: "#B45309" }}
            >
              <button
                onClick={() => setRevealedPrivate(false)}
                className="flex items-center gap-1 text-[11px] opacity-80 transition-opacity hover:opacity-100"
                title="重新隐藏内容"
              >
                <EyeOff className="h-3.5 w-3.5" /> 重新隐藏
              </button>
            </div>
          )}
        </>
        );
        })()}

      {/* 底部时间戳 */}
      {!minimized && (
        <div
          className="flex shrink-0 items-center gap-1 px-3 py-1 text-[9px]"
          style={{ color: "rgba(0,0,0,0.35)", borderTop: "1px solid rgba(0,0,0,0.05)" }}
        >
          {!isText && total > 0 && allDone && (
            <span style={{ color: "#16A34A", fontWeight: 600 }}>已完成</span>
          )}
          <Check className="h-2.5 w-2.5" />
          <span>
            {new Date(note.updated_at).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {pinMode !== "none" && (
            <span className="ml-auto opacity-60">
              {pinMode === "dynamic" ? "动态置顶" : "置顶"}
            </span>
          )}
        </div>
      )}

      {/* 四角隐形 resize 手柄 */}
      {(
        [
          { d: "NorthWest", c: "top-0 left-0 cursor-nwse-resize", s: "w-6 h-6" },
          { d: "NorthEast", c: "top-0 right-0 cursor-nesw-resize", s: "w-4 h-4" },
          { d: "SouthWest", c: "bottom-0 left-0 cursor-nesw-resize", s: "w-6 h-6" },
          { d: "SouthEast", c: "bottom-0 right-0 cursor-nwse-resize", s: "w-4 h-4" },
        ] as const
      ).map((h) => (
        <div
          key={h.d}
          onMouseDown={(e) => {
            e.stopPropagation();
            getCurrentWindow()
              .startResizeDragging(h.d)
              .then(() => {})
              .catch(() => {});
          }}
          className={`absolute ${h.s} opacity-0 ${h.c}`}
        />
      ))}

      {/* 运行错误浮层 */}
      {bootError && (
        <pre
          className="absolute inset-0 z-50 overflow-auto whitespace-pre-wrap p-4 text-[11px]"
          style={{ background: "#7F1D1D", color: "#FEE2E2" }}
        >
          {bootError}
        </pre>
      )}

      {/* 锁定 / 加解密口令弹层 */}
      {secPrompt && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.25)" }}>
          <div
            className="w-[260px] rounded-md p-3"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}
          >
            <div className="mb-2 text-xs font-semibold" style={{ color: "rgba(0,0,0,0.8)" }}>
              {secPrompt === "encrypt"
                ? "设置独立加密口令"
                : secPrompt === "lock"
                  ? "输入口令并解除加密（写回明文）"
                  : "输入口令查看（只读）"}
            </div>
            <input
              type="password"
              autoFocus
              value={secPw}
              onChange={(e) => {
                setSecPw(e.target.value);
                setSecError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSec(secPw);
              }}
              placeholder={secPrompt === "encrypt" ? "仅本便签使用，请牢记" : "口令"}
              className="w-full rounded border px-2 py-1.5 text-sm outline-none"
              style={{
                borderColor: "rgba(0,0,0,0.15)",
                color: "rgba(0,0,0,0.85)",
              }}
            />
            {secError && (
              <div className="mt-1 text-[11px]" style={{ color: "#DC2626" }}>
                {secError}
              </div>
            )}
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                onClick={() => setSecPrompt(null)}
                className="rounded px-2.5 py-1 text-xs hover:bg-black/5"
                style={{ color: "rgba(0,0,0,0.6)" }}
              >
                取消
              </button>
              <button
                onClick={() => submitSec(secPw)}
                className="rounded px-3 py-1 text-xs font-medium text-white"
                style={{ background: "#333" }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}