// ============================================================
// GlobalShortcutSettings — 设置页「全局快捷键」编辑区
// 每项支持：启用开关、改键（点击后按新组合）、双击Ctrl预设、重置该项。
// 变更即写入设置并实时调用后端 apply_global_shortcuts 生效。
// ============================================================
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  GLOBAL_SHORTCUT_DEFS,
  type GlobalShortcut,
  readGlobalShortcuts,
  writeGlobalShortcuts,
  applyGlobalShortcuts,
  eventToGlobalKey,
} from "@/lib/globalShortcuts";

export default function GlobalShortcutSettings() {
  const [items, setItems] = useState<GlobalShortcut[]>(() => readGlobalShortcuts());
  const [capturing, setCapturing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const persistAndApply = (next: GlobalShortcut[]) => {
    setItems(next);
    writeGlobalShortcuts(next);
    setBusy(true);
    applyGlobalShortcuts(next)
      .catch(() => {})
      .then(() => {
        setBusy(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1200);
      });
  };

  const setItem = (action: string, patch: Partial<GlobalShortcut>) => {
    const next = items.map((it) => (it.action === action ? { ...it, ...patch } : it));
    persistAndApply(next);
  };

  const toggle = (action: string, enabled: boolean) => setItem(action, { enabled });
  const reset = (action: string) => {
    const def = GLOBAL_SHORTCUT_DEFS.find((d) => d.action === action);
    if (def) setItem(action, { key: def.defaultKey, enabled: true });
  };
  const useDouble = (action: string) => setItem(action, { key: 'DoubleCtrl' });

  // 捕获按键
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 忽略仅按下修饰键
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      setCapturing(null);
      setItem(capturing, { key: eventToGlobalKey(e) });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          以下快捷键在<b>任何应用</b>前台都能触发（无需先打开软件）。点击“捕获”后按下新组合即可改键。
        </p>
        <div className="flex items-center gap-2">
          {busy && <span className="text-xs text-muted-foreground">应用快捷键…</span>}
          {saved && <span className="text-xs text-green-600">已生效</span>}
        </div>
      </div>

      {GLOBAL_SHORTCUT_DEFS.map((def) => {
        const it = items.find((x) => x.action === def.action);
        const value = it?.key ?? def.defaultKey;
        const keyLabel = value === 'DoubleCtrl' ? '双击 Ctrl' : value;
        const isCapturing = capturing === def.action;
        return (
          <div key={def.action} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{def.name}</span>
                <span className="text-[11px] text-muted-foreground">{def.desc}</span>
              </div>
            </div>

            {value === 'DoubleCtrl' && (
              <button
                onClick={() => useDouble(def.action)}
                className="shrink-0 rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                title="使用双击 Ctrl"
              >
                双击 Ctrl
              </button>
            )}

            <button
              disabled={!it?.enabled}
              onClick={() => (isCapturing ? setCapturing(null) : setCapturing(def.action))}
              className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-xs ${
                isCapturing
                  ? 'border-primary bg-primary/10 text-primary'
                  : it?.enabled
                    ? 'border-border/60 text-foreground hover:bg-muted'
                    : 'cursor-not-allowed border-border/40 text-muted-foreground/50'
              }`}
            >
              {isCapturing ? '按下新的组合键…' : keyLabel}
            </button>

            <button
              onClick={() => reset(def.action)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="重置该项"
            >
              <RotateCcw className="size-4" />
            </button>

            <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={it?.enabled ?? true}
                onChange={(e) => toggle(def.action, e.target.checked)}
                className="accent-primary"
              />
              <span className="text-xs text-muted-foreground">启用</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}