// AI 助手页面 — 独立的 AI 写作工作台
// 支持：续写、润色、总结、翻译、扩写、简化、解释等 11 种模式
// 使用本地文本处理引擎（离线模式），无需 API Key 即可使用

import { useMemo, useState } from "react";
import {
  Sparkles,
  ClipboardPaste,
  FileInput,
  Wand2,
  Copy,
  Replace,
  Trash2,
  History,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { INote } from "@/data/notes";
import { AI_MODES, processText, aiComplete, getAiConfig } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface AiHistoryItem {
  id: string;
  mode: string;
  input: string;
  output: string;
  createdAt: number;
}

// 临时历史存储（使用 localStorage，后续可迁移到 store）
const HISTORY_KEY = "yixian-ai-history";
function loadHistory(): AiHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveHistory(items: AiHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AiView() {
  const { notes, activeNoteId } = useOutletContext<{
    notes: INote[];
    activeNoteId: string | null;
  }>();

  const [mode, setMode] = useState<string>("continue");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AiHistoryItem[]>(loadHistory);

  const wordCount = useMemo(() => input.replace(/\s/g, "").length, [input]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      toast.success(`已粘贴 ${text.length} 字`);
    } catch {
      toast.error("粘贴失败，请手动 Ctrl+V");
    }
  };

  const handleImportNote = () => {
    if (!activeNoteId) {
      toast.error("请先在笔记视图选中一篇笔记");
      return;
    }
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    setInput(note.content || "");
    toast.success(`已导入：${note.title || "无标题"}`);
  };

  const handleGenerate = async () => {
    const text = input.trim();
    if (!text) {
      toast.error("请先输入原文");
      return;
    }
    setBusy(true);
    try {
      const cfg = getAiConfig();
      const aiMode = currentMode;
      let result = "";
      let usedRemote = false;
      if (cfg.apiKey && aiMode) {
        // 已配置 API Key：用该模式的 systemPrompt + buildPrompt 调用真实大模型
        try {
          const res = await aiComplete(aiMode.buildPrompt(text), {
            systemPrompt: aiMode.systemPrompt,
          });
          result = res.text;
           usedRemote = true;
        } catch (e) {
          // 真实调用失败时回退本地处理，前台给出提示
          result = processText(text, mode);
          toast.warning("联网生成失败，已切换为本地文本处理");
        }
      } else {
        result = processText(text, mode);
      }
      setOutput(result);
      const item: AiHistoryItem = {
        id: `ai_${Date.now()}`,
        mode,
        input: text.slice(0, 200),
        output: result.slice(0, 200),
        createdAt: Date.now(),
      };
      const updated = [item, ...history].slice(0, 50);
      setHistory(updated);
      saveHistory(updated);
      toast.success(usedRemote ? "已生成（AI 在线生成）" : "已生成（本地文本处理）");
    } catch {
      toast.error("生成失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!output) {
      toast.error("暂无可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const handleReplace = () => {
    if (!output) {
      toast.error("暂无可替换的内容");
      return;
    }
    setInput(output);
    toast.success("已替换原文");
  };

  const handleClearHistory = async () => {
    const confirmed = await confirmDialog({
      title: "确定清空 AI 历史记录？",
      description: "此操作不可恢复",
      confirmText: "清空",
      cancelText: "取消",
      danger: true,
    });
    if (!confirmed) return;
    setHistory([]);
    saveHistory([]);
    toast.success("已清空历史记录");
  };

  const currentMode = AI_MODES.find((m) => m.id === mode);

  // 是否已配置 API Key（决定是本地离线处理还是联网 AI 生成）
  const aiEnabled = useMemo(() => !!getAiConfig().apiKey, []);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 头部 */}
      <header
        className="flex shrink-0 items-center gap-2 px-6 border-b border-border/60"
        style={{ height: 56 }}
      >
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">AI 助手</h1>
        <span className="text-xs text-muted-foreground">
          {aiEnabled ? "· 已配置 API Key，联网生成" : "· 本地文本处理引擎（未配置 API Key）"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 主区域 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 模式选择 */}
          <div className="flex shrink-0 items-center gap-1 px-4 py-2 border-b border-border/60 bg-card/50 overflow-x-auto">
            {AI_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="rounded px-3 py-1 text-xs transition-colors shrink-0"
                style={{
                  background: mode === m.id ? "hsl(var(--primary) / 0.1)" : "transparent",
                  color: mode === m.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              >
                {m.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={handlePaste}>
                <ClipboardPaste className="h-3.5 w-3.5" />
                粘贴
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImportNote}>
                <FileInput className="h-3.5 w-3.5" />
                导入笔记
              </Button>
            </div>
          </div>

          {/* 输入 + 输出 */}
          <div className="flex min-h-0 flex-1">
            <div className="flex flex-1 flex-col min-w-0 border-r border-border/60">
              <div className="shrink-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                原文 · {wordCount} 字
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="在此输入或粘贴文本…"
                spellCheck={false}
                className="min-h-0 flex-1 resize-none border-0 bg-transparent px-5 py-4 text-sm outline-none text-foreground leading-relaxed"
              />
            </div>
            <div className="flex flex-1 flex-col min-w-0">
              <div className="shrink-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                结果 · {currentMode?.label || mode}模式
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-card/30">
                {busy ? (
                  <span className="text-muted-foreground">处理中…</span>
                ) : output ? (
                  output
                ) : (
                  <span className="text-muted-foreground">
                    点击「生成」后，结果将在此处显示
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 操作栏 */}
          <div className="flex shrink-0 items-center gap-2 px-4 py-2 border-t border-border/60 bg-card/50">
            <Button variant="default" size="sm" onClick={handleGenerate} disabled={busy}>
              <Wand2 className="h-3.5 w-3.5" />
              {busy ? "处理中…" : "生成"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!output}>
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReplace} disabled={!output}>
              <Replace className="h-3.5 w-3.5" />
              替换原文
            </Button>
          </div>
        </div>

        {/* 历史侧栏 */}
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-border/60 bg-card/30">
          <div className="flex shrink-0 items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="h-3 w-3" />
              历史记录
            </span>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="rounded p-1 transition-colors hover:bg-muted text-destructive"
                title="清空"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              暂无历史记录
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {history.map((item) => (
                <div key={item.id} className="rounded p-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                    >
                      {AI_MODES.find((m) => m.id === item.mode)?.label || item.mode}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {fmtTime(item.createdAt)}
                    </span>
                  </div>
                  <p
                    className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {item.output}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
