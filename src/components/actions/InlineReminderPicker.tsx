// ══════════════════════════════════════════════════════════════
// InlineReminderPicker — 内联提醒选择器（文档§6「最应新增的通用组件」）
//
// 在任意「当前上下文」（搜索结果、笔记详情、待办）直接设提醒，无需跳转
// 提醒页。选择器保持受控：父级传入 onSubmit(remindAt, repeat) 即可落动作。
// 组件自身只负责选择 UI，不绑定全局 store，方便在多处复用。
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ReminderRepeat } from "@/lib/reminderTypes";

/** picker 提交的输出：提醒时间戳（毫秒）+ 重复规则 */
export interface ReminderSelection {
  remindAt: number;
  repeat: ReminderRepeat;
}

export function InlineReminderPicker({
  defaultRemindAt,
  defaultRepeat = "none",
  onSubmit,
  buttonLabel = "设提醒",
  className,
}: {
  /** 可选默认提醒时间戳（毫秒）；缺省时用「明天该时刻」 */
  defaultRemindAt?: number;
  defaultRepeat?: ReminderRepeat;
  /** 提交回调：返回提醒时间戳与重复规则 */
  onSubmit: (selection: ReminderSelection) => void;
  buttonLabel?: string;
  className?: string;
}) {
  const initial = defaultRemindAt
    ? (() => {
        const d = new Date(defaultRemindAt);
        return {
          remindDate: d.toISOString().slice(0, 10),
          remindTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        };
      })()
    : { remindDate: "", remindTime: "09:00" };
  const [remindDate, setRemindDate] = useState<string>(initial.remindDate);
  const [remindTime, setRemindTime] = useState<string>(initial.remindTime);
  const [repeat, setRepeat] = useState<ReminderRepeat>(defaultRepeat);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let remindAt = Date.now() + 24 * 3600 * 1000; // 默认明天
    if (remindDate) {
      const base = new Date(remindDate + "T" + (remindTime || "09:00"));
      const ts = base.getTime();
      if (!Number.isNaN(ts)) remindAt = ts;
    }
    onSubmit({ remindAt, repeat });
  };

  return (
    <form className={`space-y-2 ${className ?? ""}`} onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <Input
          type="date"
          value={remindDate}
          onChange={(e) => setRemindDate(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          type="time"
          value={remindTime}
          onChange={(e) => setRemindTime(e.target.value)}
          className="h-8 text-xs w-[84px]"
        />
      </div>
      <div className="flex gap-2 items-center">
        <Select value={repeat} onValueChange={(v) => setRepeat(v as ReminderRepeat)}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不重复</SelectItem>
            <SelectItem value="daily">每天</SelectItem>
            <SelectItem value="weekly">每周</SelectItem>
            <SelectItem value="monthly">每月</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="h-8 gap-1 text-xs">
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}