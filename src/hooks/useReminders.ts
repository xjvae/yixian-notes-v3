import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore, type Reminder } from '@/store/useStore';
import { toast } from 'sonner';
import { genId } from '@/lib/id';

/**
 * 提醒管理 Hook
 * 提供提醒的增删改查、到期检查和通知触发能力
 */
export function useReminders() {
  const reminders = useStore((s) => s.reminders);
  const addReminder = useStore((s) => s.addReminder);
  const updateReminder = useStore((s) => s.updateReminder);
  const completeReminder = useStore((s) => s.completeReminder);
  const deleteReminder = useStore((s) => s.deleteReminder);

  /** 当前弹窗提醒的提醒项 */
  const [activeAlert, setActiveAlert] = useState<Reminder | null>(null);
  /** 已触发过提醒的 ID 集合（避免重复弹窗） */
  const triggeredRef = useRef<Set<string>>(new Set());

  /**
   * 创建提醒
   */
  const createReminder = useCallback(
    (data: {
      title: string;
      description?: string;
      remindAt: string;
      noteId?: string;
      repeat?: string;
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
      toast.success('提醒已创建');
      return reminder;
    },
    [addReminder],
  );

  /**
   * 编辑提醒
   */
  const editReminder = useCallback(
    (id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => {
      updateReminder(id, updates);
      toast.success('提醒已更新');
    },
    [updateReminder],
  );

  /**
   * 移除提醒
   */
  const removeReminder = useCallback(
    (id: string) => {
      deleteReminder(id);
      toast.success('提醒已删除');
    },
    [deleteReminder],
  );

  /**
   * 完成提醒（处理重复逻辑）
   */
  const handleComplete = useCallback(
    (id: string) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return;

      // 如果是重复提醒，计算下次时间并更新
      if (reminder.repeat && reminder.repeat !== 'none') {
        const nextAt = calculateNextRepeat(reminder.remindAt, reminder.repeat);
        if (nextAt) {
          updateReminder(id, { remindAt: nextAt.toISOString() });
          toast.success('已移至下次提醒');
          return;
        }
      }

      completeReminder(id);
      setActiveAlert(null);
      toast.success('已完成提醒');
    },
    [reminders, completeReminder, updateReminder],
  );

  /**
   * 稍后提醒（延迟指定分钟）
   */
  const snoozeReminder = useCallback(
    (id: string, minutes: number) => {
      const nextAt = new Date(Date.now() + minutes * 60 * 1000);
      updateReminder(id, { remindAt: nextAt.toISOString() });
      setActiveAlert(null);
      toast.success(`已延迟 ${minutes} 分钟提醒`);
    },
    [updateReminder],
  );

  /**
   * 检查到期的未完成提醒
   */
  const checkDueReminders = useCallback(() => {
    const now = Date.now();
    const dueReminder = reminders.find((r) => {
      if (r.isCompleted) return false;
      if (triggeredRef.current.has(r.id)) return false;
      const remindTime = new Date(r.remindAt).getTime();
      return remindTime <= now;
    });

    if (dueReminder) {
      triggeredRef.current.add(dueReminder.id);
      setActiveAlert(dueReminder);
      sendSystemNotification(dueReminder);
    }
  }, [reminders]);

  /**
   * 每分钟检查一次到期提醒
   */
  useEffect(() => {
    // 启动时立即检查一次
    checkDueReminders();

    const interval = setInterval(checkDueReminders, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkDueReminders]);

  return {
    reminders,
    activeAlert,
    setActiveAlert,
    triggeredRef,
    createReminder,
    editReminder,
    removeReminder,
    handleComplete,
    snoozeReminder,
    checkDueReminders,
  };
}

/**
 * 计算下次重复提醒时间
 */
function calculateNextRepeat(currentRemindAt: string, repeat: string): Date | null {
  const current = new Date(currentRemindAt);
  if (isNaN(current.getTime())) return null;

  const next = new Date(current);
  switch (repeat) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'weekdays': {
      // 下一个工作日
      let daysToAdd = 1;
      const nextDay = new Date(next);
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        daysToAdd++;
        nextDay.setDate(next.getDate() + daysToAdd);
      }
      next.setDate(next.getDate() + daysToAdd);
      break;
    }
    default:
      return null;
  }
  return next;
}

/**
 * 发送系统通知
 */
function sendSystemNotification(reminder: Reminder) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(reminder.title, {
      body: reminder.description || '您有一条待处理的提醒',
      icon: '/vite.svg',
      tag: reminder.id,
    });
  }
}

/**
 * 请求通知权限（应在用户交互后调用）
 */
export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
