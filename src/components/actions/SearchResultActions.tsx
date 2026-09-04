// ══════════════════════════════════════════════════════════════
// SearchResultActions — 搜索结果动作化（阶段1）
//
// 目标：找到对象后直接在搜索结果上完成【收藏 / 设提醒 / 转待办 / 加标签】，
//      减少「先进详情页再做」的跨页操作。
// 组件从调用方注入的 action handler 中工作，不依赖全局上下文耦合。
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { Star, BellRing, Check, List } from "lucide-react";
import type { INote } from "@/data/notes";
import type { ReminderRepeat } from "@/lib/reminderTypes";
import { InlineReminderPicker, type ReminderSelection } from "@/components/actions/InlineReminderPicker";
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
import { toast } from "sonner";

export interface WorkspaceActions {
  addReminder: (r: {
    targetType: "note" | "todo";
    targetId: string;
    title: string;
    time: number;
    repeat: ReminderRepeat;
  }) => void;
  todoCreate: (t: {
    title: string;
    description?: string;
    relatedNoteId?: string;
    priority?: string;
    dueDate?: number | null;
  }) => void;
  addTag: (t: { id: string; name: string; color?: string }) => void;
  batchUpdate: (ids: string[], patch: Partial<INote>) => void;
  tags: Array<{ id: string; name: string; color?: string }>;
}
export type WorkspaceContextWithActions = WorkspaceActions;

export function SearchResultActions({
  note,
  ctx,
}: {
  note: INote;
  ctx: WorkspaceActions;
}) {
  const [open, setOpen] = useState(false);
  const [draftTag, setDraftTag] = useState("");

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.batchUpdate([note.id], { isFavorite: !note.isFavorite });
    toast.success(note.isFavorite ? "已取消收藏" : "已收藏");
  };

  const createTodo = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.todoCreate({
      title: note.title,
      description: note.excerpt ?? "",
      relatedNoteId: note.id,
      priority: "medium",
    });
    toast.success("已生成待办");
  };

  const setReminder = (sel: ReminderSelection) => {
    ctx.addReminder({
      targetType: "note",
      targetId: note.id,
      title: note.title,
      time: sel.remindAt,
      repeat: sel.repeat,
    });
    toast.success("提醒已设置");
    setOpen(false);
  };

  const attachTag = (tagId: string, adding: boolean) => {
    ctx.batchUpdate(
      [note.id],
      adding
        ? { tags: [...note.tags, tagId] }
        : { tags: note.tags.filter((t) => t !== tagId) },
    );
  };

  const createTag = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draftTag.trim();
    if (!name) return;
    const tagId = `tag_${Date.now()}`;
    ctx.addTag({ id: tagId, name, color: "#3b82f6" });
    ctx.batchUpdate([note.id], { tags: [...note.tags, tagId] });
    setDraftTag("");
    toast.success(`已添加标签「${name}」`);
  };

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        title={note.isFavorite ? "取消收藏" : "收藏"}
        onClick={toggleFavorite}
        aria-label={note.isFavorite ? "取消收藏" : "收藏"}
      >
        <Star className={`size-3.5 ${note.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        title="转为待办"
        onClick={createTodo}
        aria-label="转为待办"
      >
        <Check className="size-3.5 text-muted-foreground" />
      </Button>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            title="设提醒 / 打标签"
            aria-label="设提醒 / 打标签"
          >
            <BellRing className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>提醒</DropdownMenuLabel>
          <div className="px-2 pb-1">
            <InlineReminderPicker onSubmit={setReminder} />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1">
            <List className="size-3" />
            打标签
          </DropdownMenuLabel>
          <div className="px-2 py-1 max-h-48 overflow-y-auto space-y-1">
            {ctx.tags.slice(0, 12).map((t) => {
              const active = note.tags.includes(t.id);
              return (
                <DropdownMenuItem
                  key={t.id}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                  onSelect={(ev) => {
                    ev.preventDefault();
                    attachTag(t.id, !active);
                  }}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.color ?? "#3b82f6" }}
                  />
                  <span className="flex-1 truncate">{t.name}</span>
                  {active && <Star className="size-3 fill-primary text-primary" />}
                </DropdownMenuItem>
              );
            })}
            <form onSubmit={createTag} className="flex gap-1 pt-1">
              <Input
                value={draftTag}
                onChange={(e) => setDraftTag(e.target.value)}
                placeholder="新建标签..."
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs">
                添加
              </Button>
            </form>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}