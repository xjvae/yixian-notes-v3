// ══════════════════════════════════════════════════════════════
// CaptureActionMenu — 采集一键转对象（阶段1）
//
// 作用：把剪贴板/OCR 等采集到的文本，用单次菜单操作直接转为
//      笔记 / 待办 / 提醒 / 闪卡，避免「复制 → 切页 → 粘贴」。
// 由调用方传入动作 handler（来自 Outlet 上下文），保持低耦合。
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { FilePlus2, ListTodo, Layers, BellRing, MoreVertical, StickyNote } from "lucide-react";
import type { ReminderRepeat } from "@/lib/reminderTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export interface CaptureActions {
  newNote: (opts?: { notebookId?: string }) => void;
  todoCreate: (t: {
    title: string;
    description?: string;
    relatedNoteId?: string;
    priority?: string;
    dueDate?: number | null;
    tags?: string[];
  }) => void;
  addReminder: (r: {
    targetType: "note" | "todo";
    targetId: string;
    title: string;
    time: number;
    repeat: ReminderRepeat;
  }) => void;
  addFlashcard: (c: {
    deck: string;
    front: string;
    back: string;
    tags?: string[];
    dueDate: string;
    status: string;
  }) => void;
}

export function CaptureActionMenu({
  text,
  title,
  ctx,
  onDone,
  variant = "icon",
}: {
  text: string;
  title?: string;
  ctx: CaptureActions;
  onDone?: (kind: "note" | "todo" | "reminder" | "flashcard") => void;
  variant?: "icon" | "full";
}) {
  const [open, setOpen] = useState(false);
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("09:00");
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const cleanTitle = (title ?? "速记").slice(0, 40);

  const toNote = () => {
    ctx.newNote({ notebookId: undefined });
    toast.success("已转为笔记");
    setOpen(false);
    onDone?.("note");
  };
  const toTodo = () => {
    ctx.todoCreate({ title: cleanTitle, description: text.slice(0, 500), priority: "medium" });
    toast.success("已生成待办");
    setOpen(false);
    onDone?.("todo");
  };
  const toReminder = (e: React.FormEvent) => {
    e.preventDefault();
    let remindAt = Date.now() + 24 * 3600 * 1000;
    if (remindDate) {
      const t = new Date(remindDate + "T" + (remindTime || "09:00")).getTime();
      if (!Number.isNaN(t)) remindAt = t;
    }
    ctx.addReminder({
      targetType: "note",
      targetId: "capture-" + Date.now(),
      title: cleanTitle,
      time: remindAt,
      repeat,
    });
    toast.success("提醒已设置");
    setOpen(false);
    onDone?.("reminder");
  };
  const toFlashcard = () => {
    ctx.addFlashcard({
      deck: "速记",
      front: cleanTitle,
      back: text,
      tags: ["速记"],
      dueDate: new Date().toISOString(),
      status: "new",
    });
    toast.success("已转为闪卡");
    setOpen(false);
    onDone?.("flashcard");
  };

  const items = (
    <>
      <Button variant={variant === "icon" ? "default" : "outline"} size={variant === "icon" ? "icon" : "sm"}
        className={variant === "icon" ? "size-7 shrink-0" : "text-xs"} onClick={toNote} title="一键转笔记"
        aria-label="转为笔记">
        <FilePlus2 className="size-4" />
        {variant === "full" && <span className="ml-1">转笔记</span>}
      </Button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" title="更多操作（待办/提醒/闪卡）" aria-label="更多操作">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="truncate">{cleanTitle}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={(ev) => { ev.preventDefault(); toNote(); }}>
            <StickyNote className="size-4 text-primary" /> 转为笔记
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(ev) => { ev.preventDefault(); toTodo(); }}>
            <ListTodo className="size-4 text-emerald-500" /> 转为待办
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(ev) => { ev.preventDefault(); toFlashcard(); }}>
            <Layers className="size-4 text-indigo-500" /> 转为闪卡
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1 text-xs text-muted-foreground">
            <BellRing className="size-3" /> 设为提醒
          </DropdownMenuLabel>
          <form className="px-2 pb-1 space-y-2" onSubmit={toReminder}>
            <div className="flex gap-2">
              <Input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} className="h-8 text-xs" />
              <Input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} className="h-8 text-xs w-[84px]" />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={repeat} onValueChange={(v) => setRepeat(v as ReminderRepeat)}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不重复</SelectItem>
                  <SelectItem value="daily">每天</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                  <SelectItem value="monthly">每月</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-8 gap-1 text-xs">
                <BellRing className="size-3" /> 设提醒
              </Button>
            </div>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return variant === "full" ? <div className="flex items-center gap-1">{items}</div> : <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{items}</div>;
}