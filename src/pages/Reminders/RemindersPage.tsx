import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit3,
  Check,
  Circle,
  AlertCircle,
  Filter,
  Repeat,
  FileText,
  CheckCheck,
} from 'lucide-react';
import { format, isBefore, startOfDay, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { genId } from '@/lib/id';
import { toast } from 'sonner';
import { useStore, type Reminder } from '@/store/useStore';
import { useOutletContext } from 'react-router-dom';
import type { INote } from '@/data/notes';
import ReminderModal from '@/components/Reminder/ReminderModal';
import { requestNotificationPermission } from '@/hooks/useReminders';
import { PageHeader, StatCard } from '@/components/shared';
import EmptyState from '@/components/EmptyState';

type FilterType = 'all' | 'pending' | 'today' | 'upcoming' | 'completed' | 'overdue';

const repeatLabels: Record<string, string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  weekdays: '工作日',
};

export default function RemindersPage() {
  const reminders = useStore((s) => s.reminders);
  // notes 取真实仓库源（Outlet context），而非只读 zustand store（后者为空）
  const { notes } = useOutletContext<{ notes: INote[] }>();
  const addReminder = useStore((s) => s.addReminder);
  const updateReminder = useStore((s) => s.updateReminder);
  const completeReminder = useStore((s) => s.completeReminder);
  const deleteReminder = useStore((s) => s.deleteReminder);

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  // 批量选择状态（依赖于 filteredReminders 的逻辑统一放在下方定义处之后）
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 统计数据
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const total = reminders.length;
    const pending = reminders.filter((r) => !r.isCompleted).length;
    const completed = reminders.filter((r) => r.isCompleted).length;
    const todayCount = reminders.filter(
      (r) => !r.isCompleted && isToday(new Date(r.remindAt)),
    ).length;
    const overdue = reminders.filter(
      (r) => !r.isCompleted && isBefore(new Date(r.remindAt), today),
    ).length;
    return { total, pending, completed, todayCount, overdue };
  }, [reminders]);

  // 筛选后的提醒列表
  const filteredReminders = useMemo(() => {
    let list = [...reminders];
    const now = new Date();
    const today = startOfDay(now);

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      );
    }

    // 分类过滤
    switch (filter) {
      case 'pending':
        list = list.filter((r) => !r.isCompleted);
        break;
      case 'today':
        list = list.filter((r) => !r.isCompleted && isToday(new Date(r.remindAt)));
        break;
      case 'upcoming':
        list = list.filter(
          (r) => !r.isCompleted && !isBefore(new Date(r.remindAt), today),
        );
        break;
      case 'completed':
        list = list.filter((r) => r.isCompleted);
        break;
      case 'overdue':
        list = list.filter((r) => !r.isCompleted && isBefore(new Date(r.remindAt), today));
        break;
    }

    // 排序：未完成优先 → 时间近的在前
    return list.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime();
    });
  }, [reminders, filter, searchQuery]);

  // 批量选择（依赖 filteredReminders）
  const allChecked =
    filteredReminders.length > 0 && filteredReminders.every((r) => selected.has(r.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filteredReminders.forEach((r) => next.delete(r.id));
      else filteredReminders.forEach((r) => next.add(r.id));
      return next;
    });
  const handleBatchComplete = useCallback(() => {
    selected.forEach((id) => completeReminder(id));
    toast.success(`已完成 ${selected.size} 条提醒`);
    setSelected(new Set());
  }, [selected, completeReminder]);
  const handleBatchDelete = useCallback(() => {
    selected.forEach((id) => deleteReminder(id));
    toast.success(`已删除 ${selected.size} 条提醒`);
    setSelected(new Set());
  }, [selected, deleteReminder]);

  // 创建提醒
  const handleCreate = useCallback(
    (data: {
      title: string;
      description: string;
      remindAt: string;
      noteId?: string;
      repeat: string;
    }) => {
      const reminder: Reminder = {
        id: genId('rm', 7),
        title: data.title,
        description: data.description,
        remindAt: data.remindAt,
        noteId: data.noteId,
        repeat: data.repeat,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      addReminder(reminder);
      requestNotificationPermission();
      setModalOpen(false);
      toast.success('提醒已创建');
    },
    [addReminder],
  );

  // 编辑提醒
  const handleEdit = useCallback(
    (data: {
      title: string;
      description: string;
      remindAt: string;
      noteId?: string;
      repeat: string;
    }) => {
      if (!editingReminder) return;
      updateReminder(editingReminder.id, {
        title: data.title,
        description: data.description,
        remindAt: data.remindAt,
        noteId: data.noteId,
        repeat: data.repeat,
      });
      setEditingReminder(null);
      setModalOpen(false);
      toast.success('提醒已更新');
    },
    [editingReminder, updateReminder],
  );

  // 打开编辑弹窗
  const openEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setModalOpen(true);
  }, []);

  // 打开创建弹窗
  const openCreate = useCallback(() => {
    setEditingReminder(null);
    setModalOpen(true);
  }, []);

  // 关闭弹窗
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingReminder(null);
  }, []);

  // 切换完成状态
  const toggleComplete = useCallback(
    (reminder: Reminder) => {
      if (reminder.isCompleted) {
        updateReminder(reminder.id, { isCompleted: false });
        toast.success('已恢复为未完成');
      } else {
        completeReminder(reminder.id);
        toast.success('已完成提醒');
      }
    },
    [completeReminder, updateReminder],
  );

  // 删除提醒
  const handleDelete = useCallback(
    (id: string) => {
      deleteReminder(id);
      toast.success('已删除提醒');
    },
    [deleteReminder],
  );

  // 全部标记完成
  const handleCompleteAll = useCallback(() => {
    reminders
      .filter((r) => !r.isCompleted)
      .forEach((r) => completeReminder(r.id));
    toast.success('已全部标记完成');
  }, [reminders, completeReminder]);

  // 关联笔记标题
  const getNoteTitle = useCallback(
    (noteId?: string) => {
      if (!noteId) return null;
      const note = notes.find((n) => n.id === noteId);
      return note?.title || null;
    },
    [notes],
  );

  const filters: { key: FilterType; label: string; icon: typeof Filter; count: number }[] = [
    { key: 'all', label: '全部', icon: Bell, count: stats.total },
    { key: 'pending', label: '未完成', icon: Circle, count: stats.pending },
    { key: 'today', label: '今天', icon: Calendar, count: stats.todayCount },
    { key: 'overdue', label: '已逾期', icon: AlertCircle, count: stats.overdue },
    { key: 'upcoming', label: '即将到来', icon: Clock, count: 0 },
    { key: 'completed', label: '已完成', icon: Check, count: stats.completed },
  ];

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* 页头 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PageHeader
            icon={<Bell className="size-5 text-primary" />}
            title={
              <>
                提醒管理
                {stats.overdue > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-normal">
                    {stats.overdue} 逾期
                  </Badge>
                )}
              </>
            }
            subtitle="管理所有提醒，不错过任何重要事项"
            actions={
              <div className="flex items-center gap-2">
                {stats.pending > 0 && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCompleteAll}>
                    <CheckCheck className="size-3.5 mr-1" />
                    全部完成
                  </Button>
                )}
                <Button size="sm" className="h-8" onClick={openCreate}>
                  <Plus className="size-3.5 mr-1" />
                  新建提醒
                </Button>
              </div>
            }
          />
        </motion.div>

        {/* 统计概览卡 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.02 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          <StatCard label="今日提醒" value={stats.todayCount} icon={<Calendar className="size-4" />} tone="primary" />
          <StatCard label="待处理" value={stats.pending} icon={<Clock className="size-4" />} tone="warning" />
          <StatCard label="已逾期" value={stats.overdue} icon={<AlertCircle className="size-4" />} tone="destructive" />
          <StatCard label="已完成" value={stats.completed} icon={<Check className="size-4" />} tone="success" />
        </motion.div>

        {/* 搜索和筛选 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex gap-2"
        >
          <Input
            placeholder="搜索提醒..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </motion.div>

        {/* 筛选标签 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-2 flex-wrap"
        >
          {filters.map((f) => {
            const Icon = f.icon;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <Icon className="size-3.5" />
                {f.label}
                {f.count > 0 && (
                  <Badge
                    variant={active ? 'secondary' : 'outline'}
                    className="text-[10px] h-4 px-1.5 ml-0.5"
                  >
                    {f.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* 批量操作栏 */}
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border bg-muted/40 px-3 py-2 flex items-center gap-3 flex-wrap"
          >
            <Checkbox checked={allChecked} onCheckedChange={toggleSelectAll} aria-label="全选" />
            <span className="text-xs text-muted-foreground">已选 {selected.size} 条</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleBatchComplete}>
                <CheckCheck className="size-3.5" /> 批量完成
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 hover:text-destructive" onClick={handleBatchDelete}>
                <Trash2 className="size-3.5" /> 批量删除
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                取消
              </Button>
            </div>
          </motion.div>
        )}

        {/* 提醒列表 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-2"
        >
          {filteredReminders.length === 0 ? (
            <EmptyState
              type={searchQuery ? 'search' : 'todos'}
              onAction={searchQuery ? undefined : openCreate}
              extra={
                searchQuery ? undefined : (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    点击按钮或上图右上方「新建提醒」创建你的第一个提醒
                  </p>
                )
              }
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredReminders.map((reminder, i) => {
                const isOverdue =
                  !reminder.isCompleted && isPast(new Date(reminder.remindAt)) && !isToday(new Date(reminder.remindAt));
                const noteTitle = getNoteTitle(reminder.noteId);

                return (
                  <motion.div
                    key={reminder.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <Card
                      className={cn(
                        'border-border/50 hover:border-primary/30 transition-all',
                        reminder.isCompleted && 'opacity-60',
                        isOverdue && 'border-red-200/60 bg-red-50/20',
                      )}
                    >
                      <CardContent className="p-4 flex items-start gap-3">
                        {/* 批量选择 */}
                        <div className="pt-0.5 shrink-0">
                          <Checkbox
                            checked={selected.has(reminder.id)}
                            onCheckedChange={() => toggleSelected(reminder.id)}
                            aria-label="选择"
                          />
                        </div>
                        {/* 完成按钮 */}
                        <button
                          onClick={() => toggleComplete(reminder)}
                          className={cn(
                            'size-5 shrink-0 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                            reminder.isCompleted
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30 hover:border-primary',
                          )}
                        >
                          {reminder.isCompleted && <Check className="size-3" />}
                        </button>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'text-sm font-medium',
                              reminder.isCompleted && 'line-through text-muted-foreground',
                            )}
                          >
                            {reminder.title}
                          </div>
                          {reminder.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {reminder.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* 时间 */}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-4 px-1.5 font-normal',
                                isOverdue && 'text-red-500 border-red-200 bg-red-50',
                              )}
                            >
                              <Clock className="size-3 mr-1" />
                              {formatReminderTime(reminder.remindAt)}
                              {isOverdue && ' · 已逾期'}
                            </Badge>
                            {/* 相对时间 */}
                            {!reminder.isCompleted && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground"
                              >
                                <AlertCircle className="size-3 mr-1" />
                                {formatRelativeTime(reminder.remindAt, reminder.isCompleted)}
                              </Badge>
                            )}
                            {/* 重复 */}
                            {reminder.repeat && reminder.repeat !== 'none' && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                <Repeat className="size-3 mr-1" />
                                {repeatLabels[reminder.repeat] || reminder.repeat}
                              </Badge>
                            )}
                            {/* 关联笔记 */}
                            {noteTitle && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-primary/70">
                                <FileText className="size-3 mr-1" />
                                {noteTitle}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* 操作菜单 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                            >
                              <span className="sr-only">操作菜单</span>
                              <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => openEdit(reminder)}>
                              <Edit3 className="size-3.5 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleComplete(reminder)}>
                              {reminder.isCompleted ? (
                                <>
                                  <Circle className="size-3.5 mr-2" />
                                  标记未完成
                                </>
                              ) : (
                                <>
                                  <Check className="size-3.5 mr-2" />
                                  标记完成
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(reminder.id)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      {/* 创建/编辑弹窗 */}
      <ReminderModal
        open={modalOpen}
        onClose={closeModal}
        onSave={editingReminder ? handleEdit : handleCreate}
        reminder={editingReminder}
        notes={notes.map((n) => ({ id: n.id, title: n.title }))}
      />
    </div>
  );
}

/** 格式化提醒时间 */
function formatReminderTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  if (isToday(d)) {
    return `今天 ${format(d, 'HH:mm')}`;
  }
  if (isTomorrow(d)) {
    return `明天 ${format(d, 'HH:mm')}`;
  }
  return format(d, 'M月d日 HH:mm', { locale: zhCN });
}

/** 相对时间：距现在还有多久（用于未完成提醒） */
function formatRelativeTime(isoString: string, completed: boolean): string {
  if (completed) return '已完成';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const diff = d.getTime() - Date.now();
  if (diff < 0) {
    const overdueDays = Math.floor(Math.abs(diff) / 86400000);
    if (overdueDays >= 1) return `已逾期 ${overdueDays} 天`;
    const hours = Math.floor(Math.abs(diff) / 3600000);
    if (hours >= 1) return `已逾期 ${hours} 小时`;
    const mins = Math.max(1, Math.floor(Math.abs(diff) / 60000));
    return `已逾期 ${mins} 分钟`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} 分钟后`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} 小时后`;
  const days = Math.floor(diff / 86400000);
  if (days < 30) return `${days} 天后`;
  return format(d, 'M月d日', { locale: zhCN });
}
