// 快捷新建笔记弹窗面板
// 默认富文本编辑（contenteditable + execCommand，与主窗口一致），
// 工具栏提供一按钮切换到 Markdown 源码（复用主窗口 MarkdownEditorPane）。
// 保存：写入后端 SQLite，并 emit popup:note-created 让主窗口刷新并选中新笔记。
import { useEffect, useRef, useState } from "react";
import {
  Check,
  FilePlus2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  FileType,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MarkdownEditorPane from "@/pages/NotesWorkspace/MarkdownEditor";
import { markdownToHtml, markdownToPlainText, htmlToMarkdown } from "@/lib/markdown";
import { plainTextToExcerpt } from "@/lib/text";
import { NOTES_STORAGE_KEY, ACTIVE_WORKSPACE_KEY } from "@/hooks/useWorkspaceStorage";
import { wsKey, loadJSON, saveJSON } from "@/hooks/useLocalStorage";

// 把新笔记追加进主窗口当前工作区的 localStorage 笔记列表（触发跨窗口 storage 事件）。
function appendNoteToLocalWorkspace(
  note: {
    id: string;
    title: string;
    content: string;
    notebook_id: string | null;
    tags: string[];
    is_encrypted: boolean;
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown>;
  },
  excerpt: string,
): void {
  try {
    if (typeof window === "undefined") return;
    const workspaceId = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || "ws1";
    const key = wsKey(NOTES_STORAGE_KEY, workspaceId);
    const list = loadJSON<{
      id: string;
      title: string;
      content: string;
      notebookId: string;
      excerpt?: string;
      tags: string[];
      isFavorite: boolean;
      isEncrypted: boolean;
      isDeleted: boolean;
      isPinned: boolean;
      sortOrder: number;
      createdAt: number;
      updatedAt: number;
      metadata?: Record<string, unknown>;
    }[]>(key, []);
    if (list.some((n) => n.id === note.id)) return;
    saveJSON(key, [
      {
        id: note.id,
        title: note.title,
        content: note.content,
        notebookId: note.notebook_id || "nb1",
        excerpt,
        tags: note.tags,
        isFavorite: false,
        isEncrypted: note.is_encrypted,
        isDeleted: false,
        isPinned: false,
        sortOrder: Number(note.metadata?.sortOrder ?? Date.now()),
        createdAt: new Date(note.created_at).getTime(),
        updatedAt: new Date(note.updated_at).getTime(),
        metadata: note.metadata,
      },
      ...list,
    ]);
  } catch {
    // 非关键路径：localStorage 写入失败不影响 SQLite 已保存
  }
}

type Mode = "rich" | "markdown";

// 富文本格式按钮：与主窗口工具栏同一套 execCommand 机制
const RICH_TOOLS: { cmd: string; value?: string; icon: typeof Bold; title: string }[] = [
  { cmd: "bold", icon: Bold, title: "加粗" },
  { cmd: "italic", icon: Italic, title: "斜体" },
  { cmd: "underline", icon: Underline, title: "下划线" },
  { cmd: "strikeThrough", icon: Strikethrough, title: "删除线" },
  { cmd: "formatBlock", value: "<h2>", icon: Heading2, title: "标题" },
  { cmd: "insertUnorderedList", icon: List, title: "无序列表" },
  { cmd: "insertOrderedList", icon: ListOrdered, title: "有序列表" },
  { cmd: "formatBlock", value: "<blockquote>", icon: Quote, title: "引用" },
  { cmd: "formatBlock", value: "<pre>", icon: Code, title: "代码" },
];

export default function NewNotePane() {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("rich");
  // 富文本模式保存 HTML；Markdown 模式保存 markdown 源码（保存时转 HTML 写库）。
  const [richHtml, setRichHtml] = useState("<p><br></p>");
  const [mdSource, setMdSource] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ id: string; title: string; contentHtml: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const richRef = useRef<HTMLDivElement>(null);
  const mdRef = useRef<HTMLTextAreaElement>(null);

  // 返回“始终可用的唯一 id”（Tauri WebView2 的 crypto.randomUUID 若缺失则回退）
  const genId = () =>
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // 首次挂载：聚焦标题
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // 富文本格式命令（与主窗口一致，保留选区）
  const execRich = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (richRef.current) richRef.current.focus();
  };

  // 切换到 Markdown：把当前富文本内容转为源码；反向则渲染回富文本
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "markdown") {
      setMdSource((prev) => (prev || htmlToMarkdown(richHtml)));
    } else {
      setRichHtml((prev) => (mdSource ? markdownToHtml(mdSource) : prev));
    }
    setMode(next);
  };

  // 保存：Markdown 转 HTML 存库，弹窗写 SQLite 后通知主窗口刷新/选中
  const save = async () => {
    if (saving) return;
    const finalContent = mode === "markdown" ? markdownToHtml(mdSource) : richHtml;
    const plainText =
      mode === "markdown"
        ? markdownToPlainText(mdSource)
        : (richRef.current?.innerText ?? "").trim();
    if (!title.trim() && !plainText) return;
    setError("");
    setSaving(true);
    const now = Date.now();
    const plain = plainTextToExcerpt(plainText, 80, { ellipsis: false });
    const note = {
      id: genId(),
      title: title.trim() || "未命名笔记",
      content: finalContent,
      notebook_id: null,
      tags: [] as string[],
      is_favorite: false,
      is_encrypted: false,
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      metadata: {
        excerpt: plain,
        isPinned: false,
        isDeleted: false,
        sortOrder: now,
      },
    };
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_note", { note }).catch(() => {
        // save_note 失败时不阻断：转为主窗口 localStorage 缓存（重启仍可恢复）
      });
      // 同步写入主窗口的 localStorage 笔记列表（触发 storage 事件让主窗口即时刷新，
      // 与 Tauri 事件双保险，保证多窗口同源下新笔记立即可见）。
      appendNoteToLocalWorkspace(note, plain);
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("popup:note-created", { id: note.id, title: note.title });
      } catch {
        // 事件通知失败不影响：storage 事件已兜底
      }
      setSaved(true);
      setPreview({ id: note.id, title: note.title, contentHtml: finalContent });
      setTitle("");
      setRichHtml("<p><br></p>");
      setMdSource("");
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const resetPanel = () => {
    setPreview(null);
    setError("");
    titleRef.current?.focus();
  };

  return (
    <div className="relative flex h-full flex-col p-3">
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        onKeyDown={(e) => e.key === "Enter" && void save()}
        className="mb-2 h-9 w-full rounded-lg border border-border/50 bg-muted/30 px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      />

      {/* 工具栏：富文本格式 + 富文本/Markdown 切换 */}
      <div className="mb-1.5 flex items-center gap-0.5 border-b border-border/40 pb-1.5">
        {mode === "rich"
          ? RICH_TOOLS.map((t) => (
              <button
                key={t.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  execRich(t.cmd, t.value);
                }}
                title={t.title}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/80 hover:bg-muted hover:text-foreground"
              >
                <t.icon className="size-3.5" />
              </button>
            ))
          : null}
        <span className="mx-1 h-4 w-px bg-border/60" />
        {/* 富文本 / Markdown 切换按钮（与主窗口工具栏同款图标与语义） */}
        <button
          onClick={() => switchMode(mode === "rich" ? "markdown" : "rich")}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium",
            mode === "markdown"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/80 hover:bg-muted hover:text-foreground",
          )}
          title={mode === "markdown" ? "切换到富文本编辑" : "切换到 Markdown 编辑"}
        >
          {mode === "markdown" ? <Code className="size-3.5" /> : <FileType className="size-3.5" />}
          <span>{mode === "markdown" ? "富文本" : "Markdown"}</span>
        </button>
      </div>

      {/* 正文 / 源码 */}
      {mode === "rich" ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm"
          onMouseDown={() => richRef.current?.focus()}
        >
          <div
            ref={richRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setRichHtml(e.currentTarget.innerHTML)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            className={cn(
              "h-full w-full max-w-none outline-none",
              "prose prose-sm prose-headings:font-bold prose-headings:text-foreground",
              "prose-p:my-2 prose-ul:my-2 prose-ol:my-2",
              "prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:my-3 prose-blockquote:text-muted-foreground",
              "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs",
            )}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/50 bg-muted/10">
          <MarkdownEditorPane
            value={mdSource}
            onChange={setMdSource}
            textRef={mdRef}
            placeholder="在此输入 Markdown 语法…"
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/70">
          {mode === "rich" ? "富文本编辑" : "支持 Markdown 语法"}，Ctrl+Enter 保存
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="size-3.5" /> 已保存
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-xs text-red-500">{error}</span>
          )}
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <FilePlus2 className="size-4" /> {saving ? "保存中…" : "保存笔记"}
          </button>
        </div>
      </div>

      {/* 保存后预览：立即展示刚新建的笔记，便于确认 */}
      {preview && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background/95 p-3 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <Check className="size-4" /> 已创建笔记
            </h3>
            <button
              onClick={resetPanel}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              继续新建
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/10 p-3">
            <div className="mb-2 border-b border-border/40 pb-2 text-base font-bold">{preview.title}</div>
            <div
              className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
              dangerouslySetInnerHTML={{ __html: preview.contentHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}