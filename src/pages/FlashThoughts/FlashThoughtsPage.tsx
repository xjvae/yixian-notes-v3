// ══════════════════════════════════════════════════════════════
// FlashThoughtsPage — 闪念（独立页）
//
// 把「闪念」从采集中心的统一时间线中拆出，成为独立专属页面。
// 提供：
//   - 顶部快捷输入框（回车或点保存即落库）
//   - 筛选：全部 / 待整理 / 已整理 / 已置顶 + 关键词搜索
//   - 一键转对象（笔记 / 待办 / 提醒 / 闪卡）+ 复制
//   - 置顶收藏、标记已整理、删除
//   - 批量操作：批量整理 / 批量删除 / 清空
// ══════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Zap,
  Search,
  CheckCheck,
  Trash2,
  Copy,
  Pin,
  PinOff,
  Sparkles,
  Plus,
  ListTodo,
  BellRing,
  FilePlus2,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { processText } from "@/lib/ai";
import { plainTextToExcerpt } from "@/lib/text";
import type { IFlashThought, INote } from "@/data/notes";
import { CaptureActionMenu, type CaptureActions } from "@/components/actions/CaptureActionMenu";

interface FlashContext {
  notes: INote[];
  importNotes: (imported: INote[]) => number;
  flashThoughts: IFlashThought[];
  addFlashThought: (f: Partial<IFlashThought>) => void;
  updateFlashThought: (id: string, updates: Partial<IFlashThought>) => void;
  deleteFlashThought: (id: string) => void;
  clearFlashThoughts: (ids?: string[]) => void;
  todoCreate: CaptureActions["todoCreate"];
  addReminder: CaptureActions["addReminder"];
  addFlashcard: CaptureActions["addFlashcard"];
}

type FilterKey = "all" | "pending" | "organized" | "pinned";

const FILTER_CONFIG: Record<FilterKey, { label: string }> = {
  all: { label: "全部" },
  pending: { label: "待整理" },
  organized: { label: "已整理" },
  pinned: { label: "已置顶" },
};

export default function FlashThoughtsPage() {
  const ctx = useOutletContext<FlashContext>();
  const { flashThoughts } = ctx;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [keyword, setKeyword] = useState("");
  const [input, setInput] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  // 批量选择
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 过滤
  const filtered = useMemo(() => {
    let list = [...flashThoughts];
    if (filter === "pending") list = list.filter((f) => f.status === "pending");
    else if (filter === "organized") list = list.filter((f) => f.status === "organized");
    else if (filter === "pinned") list = list.filter((f) => f.pinned);
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      list = list.filter((f) => f.content.toLowerCase().includes(kw));
    }
    // 置顶优先 + 时间倒序
    return list.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [flashThoughts, filter, keyword]);

  const pendingCount = flashThoughts.filter((f) => f.status === "pending").length;
  const pinnedCount = flashThoughts.filter((f) => f.pinned).length;

  const allChecked = filtered.length > 0 && filtered.every((f) => selected.has(f.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((f) => next.delete(f.id));
      else filtered.forEach((f) => next.add(f.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveQuickThought = () => {
    const text = input.trim();
    if (!text) return;
    ctx.addFlashThought({ content: text, status: "pending" });
    setInput("");
    setInputOpen(false);
    toast.success("闪念已记录");
  };

  const handlePin = (f: IFlashThought) => {
    ctx.updateFlashThought(f.id, { pinned: !f.pinned });
    toast.success(f.pinned ? "已取消置顶" : "已置顶");
  };

  const copyThought = (content: string) => {
    navigator.clipboard?.writeText(content).catch(() => {});
    toast.success("已复制");
  };

  /** 一键转笔记：含内容 + AI 摘要/标签（离线引擎） */
  const toNote = (f: IFlashThought) => {
    const noteId = "fl-note-" + Date.now();
    const autoTags = f.content
      ? String(processText(f.content, "tags"))
          .split(/[，,、\s]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const aiExcerpt = f.content ? processText(f.content.slice(0, 120), "summary").trim() : "";
    ctx.importNotes([
      {
        id: noteId,
        title: f.content.slice(0, 40) || "闪念",
        content: `<p>${f.content}</p>`,
        excerpt: aiExcerpt || plainTextToExcerpt(f.content, 80),
        notebookId: "nb1",
        tags: autoTags,
        isFavorite: false,
        isDeleted: false,
        isPinned: false,
        sortOrder: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    ctx.updateFlashThought(f.id, { status: "organized" });
    toast.success("已转为笔记");
  };

  const captureCtx: CaptureActions = {
    newNote: () => {},
    todoCreate: ctx.todoCreate,
    addReminder: ctx.addReminder,
    addFlashcard: ctx.addFlashcard,
  };

  const batchOrganize = () => {
    selected.forEach((id) => ctx.updateFlashThought(id, { status: "organized" }));
    toast.success(`已将 ${selected.size} 条整理`);
    setSelected(new Set());
  };

  const batchDelete = () => {
    ctx.clearFlashThoughts(Array.from(selected));
    toast.success(`已删除 ${selected.size} 条闪念`);
    setSelected(new Set());
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="size-5 text-violet-600" />
              闪念
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {flashThoughts.length} 条闪念 · {pendingCount} 条待整理 · {pinnedCount} 条置顶
            </p>
          </div>
          <Button size="sm" className="text-xs" onClick={() => setInputOpen(true)}>
            <Plus className="size-3.5 mr-1" /> 记录闪念
          </Button>
        </motion.div>

        {/* 快捷输入框 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-violet-600" />
                </div>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="随手记下一个想法、灵感或待办…（Ctrl+Enter 保存）"
                  className="min-h-[44px] flex-1 resize-none"
                  rows={input.length > 60 ? 3 : 1}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); saveQuickThought(); }
                    if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); saveQuickThought(); }
                  }}
                />
                <Button size="icon" className="size-9 shrink-0" onClick={saveQuickThought} title="保存闪念">
                  <Send className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 搜索 + 筛选 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="space-y-3"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索闪念内容..."
              className="pl-9 h-10"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <TabsList className="grid grid-cols-4 h-9 w-full md:w-auto">
              {(Object.keys(FILTER_CONFIG) as FilterKey[]).map((k) => (
                <TabsTrigger key={k} value={k} className="text-xs">{FILTER_CONFIG[k].label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* 批量操作栏 */}
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border bg-muted/40 px-3 py-2 flex items-center gap-3 flex-wrap"
          >
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="全选" />
            <span className="text-xs text-muted-foreground">已选 {selected.size} 条</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={batchOrganize}>
                <CheckCheck className="size-3.5" /> 批量整理
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 hover:text-destructive" onClick={batchDelete}>
                <Trash2 className="size-3.5" /> 批量删除
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                取消
              </Button>
            </div>
          </motion.div>
        )}

        {/* 列表 */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-16 text-center">
                <Zap className="size-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">还没有闪念</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                whileHover={{ x: 2 }}
              >
                <Card className={cn("border-border/50 transition-all group overflow-hidden", f.pinned && "border-primary/30")}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selected.has(f.id)}
                        onCheckedChange={() => toggleOne(f.id)}
                        aria-label="选择"
                      />
                    </div>
                    <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Zap className="size-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={cn("text-[10px] h-4 px-1.5 font-normal", f.status === "organized" && "bg-muted")}>
                          {f.status === "pending" ? "待整理" : "已整理"}
                        </Badge>
                        {f.pinned && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-amber-600">
                            <Pin className="size-2.5 mr-0.5" /> 置顶
                          </Badge>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true, locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-all">{f.content}</p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => toNote(f)}>
                          <FilePlus2 className="size-3.5 text-primary" /> 转笔记
                        </Button>
                        {f.content && (
                          <CaptureActionMenu
                            text={f.content}
                            title={f.content.slice(0, 40)}
                            ctx={captureCtx}
                            variant="icon"
                            onDone={() => ctx.updateFlashThought(f.id, { status: "organized" })}
                          />
                        )}
                        <div className="ml-auto flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="size-7" title="设为待办" onClick={() => ctx.todoCreate({ title: f.content.slice(0, 40) })}>
                            <ListTodo className="size-4 text-emerald-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="设为提醒" onClick={() => ctx.addReminder({ targetType: "note", targetId: f.id, title: f.content.slice(0, 40), time: Date.now() + 24 * 3600 * 1000, repeat: "none" })}>
                            <BellRing className="size-4 text-amber-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="复制" onClick={() => copyThought(f.content)}>
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("size-7", f.pinned && "text-amber-500")}
                            title={f.pinned ? "取消置顶" : "置顶"}
                            onClick={() => handlePin(f)}
                          >
                            {f.pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" title={f.status === "pending" ? "标记已整理" : "取消已整理"}
                            onClick={() => ctx.updateFlashThought(f.id, { status: f.status === "pending" ? "organized" : "pending" })}>
                            <CheckCheck className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" title="删除"
                            onClick={() => { ctx.deleteFlashThought(f.id); toast.success("已删除"); }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* 记录闪念弹窗 */}
      <Dialog open={inputOpen} onOpenChange={setInputOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-4 text-violet-600" /> 记录闪念
            </DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="随手记下一个想法、灵感…"
            className="min-h-[120px]"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveQuickThought(); } }}
          />
          <DialogFooter>
            <Button size="sm" onClick={saveQuickThought}>
              <Send className="size-3.5 mr-1" /> 保存
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">取消</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}