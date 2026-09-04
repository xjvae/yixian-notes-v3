import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  Settings,
  CheckCheck,
  CalendarClock,
  Inbox,
  MailOpen,
  CalendarDays,
  ListChecks,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { INotification, IReminder } from '@/data/notes';

interface WorkspaceContext {
  notifications: INotification[];
  reminders: IReminder[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
  notificationSettings: { dndEnabled: boolean; dndStart: string; dndEnd: string };
  setNotificationSettings: (s: any) => void;
}

export default function NotificationsPage() {
  const context = useOutletContext<WorkspaceContext>();
  const {
    notifications,
    reminders,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    deleteNotification,
    notificationSettings,
    setNotificationSettings,
  } = context;
  const [tab, setTab] = useState<'all' | 'reminder' | 'info'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const filtered = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);
    let list = sorted;
    if (unreadOnly) list = list.filter((n) => !n.isRead);
    if (tab !== 'all') list = list.filter((n) => n.type === tab);
    return list;
  }, [notifications, tab, unreadOnly]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCount = notifications.filter((n) => n.createdAt >= todayStart).length;

  const { confirm } = useConfirm();
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    multiSelect && filtered.length > 0 && filtered.every((n) => selected.has(n.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((n) => n.id)));
  };

  const selectedCount = selected.size;

  const handleBatchRead = () => {
    if (!selectedCount) {
      toast.error('请先选择要操作的通知');
      return;
    }
    selected.forEach((id) => markNotificationRead(id));
    const n = selected.size;
    setSelected(new Set());
    setMultiSelect(false);
    toast.success(`已将 ${n} 条通知标记为已读`);
  };

  const handleBatchDelete = async () => {
    if (!selectedCount) {
      toast.error('请先选择要操作的通知');
      return;
    }
    const ok = await confirm({
      title: '批量删除通知',
      description: `确定要删除选中的 ${selected.size} 条通知吗？此操作不可撤销。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    const ids = [...selected];
    ids.forEach((id) => deleteNotification(id));
    setSelected(new Set());
    setMultiSelect(false);
    toast.success(`已删除 ${ids.length} 条通知`);
  };

  const clearAll = async () => {
    if (!notifications.length) return;
    const ok = await confirm({
      title: '清空所有通知',
      description: '确定要删除全部通知吗？此操作不可撤销。',
      confirmText: '清空',
      danger: true,
    });
    if (!ok) return;
    clearNotifications();
    setSelected(new Set());
    setMultiSelect(false);
    toast.success('已清空所有通知');
  };

  const typeIcon = {
    reminder: AlertCircle,
    info: Info,
    system: Bell,
  };

  const typeColor = {
    reminder: 'text-amber-500 bg-amber-50',
    info: 'text-blue-500 bg-blue-50',
    system: 'text-muted-foreground bg-muted',
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    toast.success('已全部标记为已读');
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              通知中心
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-normal">
                  {unreadCount} 未读
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理所有提醒和通知消息
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarkAllRead}>
              <CheckCheck className="size-3.5 mr-1" />
              全部已读
            </Button>
          </div>
        </motion.div>

        {/* 统计概览 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.02 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-xl border border-border/50 bg-card/80 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Inbox className="size-3.5" />
              <span className="text-xs">全部</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{notifications.length}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/80 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <MailOpen className="size-3.5" />
              <span className="text-xs">未读</span>
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', unreadCount > 0 && 'text-primary')}>
              {unreadCount}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/80 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <CalendarDays className="size-3.5" />
              <span className="text-xs">今日</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{todayCount}</div>
          </div>
        </motion.div>

        {/* Tab */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                <TabsTrigger value="reminder" className="text-xs">提醒</TabsTrigger>
                <TabsTrigger value="info" className="text-xs">消息</TabsTrigger>
              </TabsList>
            </Tabs>
            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-xs border transition-colors shrink-0',
                unreadOnly
                  ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'size-3 rounded-full border flex items-center justify-center transition-colors',
                  unreadOnly ? 'bg-primary border-primary' : 'border-border',
                )}
              >
                {unreadOnly && <Check className="size-2 text-primary-foreground" />}
              </span>
              只看未读
            </button>
          </div>
        </motion.div>

        {/* 即将到来的提醒 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-border/50 bg-gradient-to-r from-amber-50/50 to-transparent">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="size-4 text-amber-500" />
                即将到期
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {reminders
                .filter((r) => r.time > Date.now())
                .slice(0, 3)
                .map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-background/60"
                  >
                    <AlertCircle className="size-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDistanceToNow(new Date(r.time), { addSuffix: true, locale: zhCN })}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal shrink-0">
                      {r.targetType === 'todo' ? '待办' : '笔记'}
                    </Badge>
                  </motion.div>
                ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* 通知列表 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3 flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                通知列表
                {multiSelect && filtered.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                    已选 {selectedCount}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1">
                {multiSelect ? (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleSelectAll}>
                      {allSelected ? '取消全选' : '全选'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleBatchRead}>
                      <CheckCheck className="size-3.5 mr-1" />
                      批量已读
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={handleBatchDelete}>
                      <Trash2 className="size-3.5 mr-1" />
                      批量删除
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        setMultiSelect(false);
                        setSelected(new Set());
                      }}
                      title="退出多选"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setMultiSelect(true)}
                      disabled={filtered.length === 0}
                    >
                      <ListChecks className="size-3.5 mr-1" />
                      多选
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={clearAll}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      清空
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1 px-2 pb-2">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Bell className="size-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {unreadOnly ? '没有未读通知' : '暂无通知'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {unreadOnly ? '所有通知都已被阅读' : '所有提醒和消息都会出现在这里'}
                  </p>
                </div>
              ) : (
                filtered.map((n, i) => {
                  const Icon = typeIcon[n.type];
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 + i * 0.03 }}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg transition-colors',
                        multiSelect ? 'cursor-pointer' : 'cursor-default',
                        'hover:bg-accent/40',
                        !n.isRead && !selected.has(n.id) && 'bg-primary/5',
                        multiSelect && selected.has(n.id) && 'bg-primary/10 ring-1 ring-primary/30',
                      )}
                      onClick={() => {
                        if (multiSelect) {
                          toggleSelect(n.id);
                          return;
                        }
                        if (!n.isRead) markNotificationRead(n.id);
                      }}
                    >
                      {multiSelect && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(n.id);
                          }}
                          className={cn(
                            'mt-1 size-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                            selected.has(n.id) ? 'bg-primary border-primary' : 'border-border',
                          )}
                          aria-label={selected.has(n.id) ? '取消选择' : '选择'}
                        >
                          {selected.has(n.id) && <Check className="size-3 text-primary-foreground" />}
                        </button>
                      )}
                      <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', typeColor[n.type])}>
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-sm', !n.isRead && 'font-semibold')}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="size-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.content}
                        </p>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </div>
                      </div>
                      {!multiSelect && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!n.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(n.id);
                              }}
                              title="标记已读"
                            >
                              <Check className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                              toast.success('已删除该通知');
                            }}
                            title="删除"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 通知设置 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="size-4 text-primary" />
                通知设置
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-sm font-medium">免打扰模式</div>
                  <div className="text-xs text-muted-foreground">开启后不接收新通知提醒</div>
                </div>
                <Switch
                  checked={notificationSettings.dndEnabled}
                  onCheckedChange={(v) =>
                    setNotificationSettings({ ...notificationSettings, dndEnabled: v })
                  }
                />
              </div>
              {notificationSettings.dndEnabled && (
                <div className="grid grid-cols-2 gap-3 py-2 border-t border-border/40">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">开始时间</div>
                    <Input
                      type="time"
                      value={notificationSettings.dndStart}
                      onChange={(e) =>
                        setNotificationSettings(
                          { ...notificationSettings, dndStart: e.target.value },
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">结束时间</div>
                    <Input
                      type="time"
                      value={notificationSettings.dndEnd}
                      onChange={(e) =>
                        setNotificationSettings(
                          { ...notificationSettings, dndEnd: e.target.value },
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 border-t border-border/40">
                <div>
                  <div className="text-sm font-medium">应用内通知</div>
                  <div className="text-xs text-muted-foreground">显示通知角标和推送</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-1.5 border-t border-border/40">
                <div>
                  <div className="text-sm font-medium">浏览器通知</div>
                  <div className="text-xs text-muted-foreground">系统级桌面推送</div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
