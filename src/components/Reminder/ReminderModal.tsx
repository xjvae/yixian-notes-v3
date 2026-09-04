import { useState, useEffect } from 'react';
import { X, Calendar, Repeat, FileText, Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Reminder } from '@/store/useStore';

interface ReminderModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (data: {
    title: string;
    description: string;
    remindAt: string;
    noteId?: string;
    repeat: string;
  }) => void;
  /** 编辑的提醒项，为空则为创建模式 */
  reminder?: Reminder | null;
  /** 可选的关联笔记列表 */
  notes?: { id: string; title: string }[];
}

/** 重复选项 */
const repeatOptions = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'weekdays', label: '工作日' },
];

/** 快速时间选项 */
const quickTimeOptions = [
  { label: '5 分钟后', minutes: 5 },
  { label: '15 分钟后', minutes: 15 },
  { label: '30 分钟后', minutes: 30 },
  { label: '1 小时后', minutes: 60 },
  { label: '明天此时', minutes: 1440 },
];

export default function ReminderModal({
  open,
  onClose,
  onSave,
  reminder,
  notes = [],
}: ReminderModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);

  const isEditMode = !!reminder;

  // 初始化表单数据
  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      const d = new Date(reminder.remindAt);
      if (!isNaN(d.getTime())) {
        setDate(d.toISOString().slice(0, 10));
        setTime(d.toTimeString().slice(0, 5));
      }
      setRepeat(reminder.repeat || 'none');
      setIsRepeatEnabled(reminder.repeat !== 'none' && !!reminder.repeat);
      setSelectedNoteId(reminder.noteId || '');
    } else {
      // 创建模式默认值：当前日期，下一整点
      setTitle('');
      setDescription('');
      const now = new Date();
      setDate(now.toISOString().slice(0, 10));
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      nextHour.setMinutes(0, 0, 0);
      setTime(nextHour.toTimeString().slice(0, 5));
      setRepeat('none');
      setIsRepeatEnabled(false);
      setSelectedNoteId('');
    }
  }, [reminder, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!date || !time) return;

    const remindAt = new Date(`${date}T${time}:00`);
    if (isNaN(remindAt.getTime())) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      remindAt: remindAt.toISOString(),
      noteId: selectedNoteId || undefined,
      repeat: isRepeatEnabled ? repeat : 'none',
    });
  };

  const handleQuickTime = (minutes: number) => {
    const now = new Date();
    const target = new Date(now.getTime() + minutes * 60 * 1000);
    setDate(target.toISOString().slice(0, 10));
    setTime(target.toTimeString().slice(0, 5));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            {isEditMode ? '编辑提醒' : '新建提醒'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? '修改提醒的时间和内容' : '设置提醒时间和关联笔记'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-title">提醒标题</Label>
            <Input
              id="reminder-title"
              placeholder="输入提醒内容..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-desc">描述（可选）</Label>
            <Textarea
              id="reminder-desc"
              placeholder="添加备注信息..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* 日期和时间 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              提醒时间
            </Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1"
                required
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-28"
                required
              />
            </div>
          </div>

          {/* 快速时间 */}
          <div className="flex flex-wrap gap-1.5">
            {quickTimeOptions.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => handleQuickTime(opt.minutes)}
                className="px-2 py-1 text-xs rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 重复 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Repeat className="size-3.5 text-muted-foreground" />
                重复提醒
              </Label>
              <Switch
                checked={isRepeatEnabled}
                onCheckedChange={setIsRepeatEnabled}
              />
            </div>
            {isRepeatEnabled && (
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repeatOptions
                    .filter((o) => o.value !== 'none')
                    .map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 关联笔记 */}
          {notes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                关联笔记（可选）
              </Label>
              <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择关联笔记..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不关联</SelectItem>
                  {notes.map((note) => (
                    <SelectItem key={note.id} value={note.id}>
                      {note.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 按钮 */}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={!title.trim() || !date || !time}>
              {isEditMode ? '保存修改' : '创建提醒'}
            </Button>
          </DialogFooter>
        </form>

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          aria-label="关闭"
        >
          <X className="size-4" />
          <span className="sr-only">关闭</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
