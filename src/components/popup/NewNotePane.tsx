// 快捷新建笔记弹窗面板（自包含，直接写入后端 SQLite + 主应用 localStorage）
import { useRef, useState } from "react";
import { Check, FilePlus2 } from "lucide-react";

export default function NewNotePane() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if ((!title.trim() && !content.trim()) || saving) return;
    setSaving(true);
    const now = Date.now();
    const note = {
      id: crypto.randomUUID(),
      title: title.trim() || "未命名笔记",
      content: content,
      excerpt: content.trim().slice(0, 80),
      notebook_id: null,
      tags: [] as string[],
      is_favorite: false,
      is_encrypted: false,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      metadata: {},
    };
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_note", { note });
      setSaved(true);
      setTitle("");
      setContent("");
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-3">
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        onKeyDown={(e) => e.key === "Enter" && void save()}
        className="mb-2 h-10 w-full rounded-lg border border-border/50 bg-muted/30 px-3 text-sm outline-none focus:border-primary/50"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="正文…  Ctrl+Enter 保存"
        className="min-h-0 flex-1 resize-none rounded-lg border border-border/50 bg-muted/30 p-3 text-sm outline-none focus:border-primary/50"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="size-3.5" /> 已保存
          </span>
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
  );
}