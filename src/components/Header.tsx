import { SidebarTrigger } from '@/components/ui/sidebar';
import { Search, Bell, Settings, Moon, Sun, CheckCheck, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { INotification, ISettings } from '@/data/notes';

interface HeaderProps {
  notifications: INotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  settings: ISettings;
  setSettings: React.Dispatch<React.SetStateAction<ISettings>>;
}

export default function Header({
  notifications,
  onMarkAllRead,
  onMarkRead,
  settings,
  setSettings,
}: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(settings.theme);
    const next = order[(idx + 1) % order.length];
    setSettings((prev) => ({ ...prev, theme: next }));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recentNotifications = [...notifications].slice(0, 5);

  const notifType = {
    reminder: { Icon: AlertCircle, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15' },
    info: { Icon: Info, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15' },
    system: { Icon: Bell, cls: 'text-muted-foreground bg-muted' },
  };

  const handleOpenSearch = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenSearch]);

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/') return '全部笔记';
    if (path === '/sticky-wall') return '便签墙';
    if (path === '/settings') return '设置';
    if (path === '/tags') return '标签管理';
    if (path === '/search') return '全局搜索';
    if (path === '/trash') return '回收站';
    if (path === '/calendar') return '日历';
    if (path === '/todos') return '待办清单';
    if (path === '/notebooks') return '笔记本管理';
    if (path === '/clipboard') return '剪贴板历史';
    if (path === '/dashboard') return '统计仪表盘';
    if (path === '/templates') return '模板库';
    if (path === '/privacy') return '隐私笔记';
    if (path === '/notifications') return '通知中心';
    if (path === '/import-export') return '导入导出';
    if (path === '/daily-review') return '每日回顾';
    return '一闲笔记';
  };

  return (
    <header className="sticky top-0 z-40 w-full h-12 border-b border-border/60 bg-background/80 backdrop-blur-md flex items-center px-3 gap-3">
      <SidebarTrigger className="h-8 w-8 -ml-1" />

      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">一闲笔记</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{getTitle()}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-1.5 mr-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenSearch}
              >
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">全局搜索 (Ctrl+K)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Popover open={notifOpen} onOpenChange={setNotifOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            aria-label="通知中心"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">通知中心</div>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-normal">
                  {unreadCount} 未读
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onMarkAllRead();
                  toast.success('已全部标记为已读');
                }}
              >
                <CheckCheck className="size-3 mr-1" />
                全部已读
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-destructive hover:text-destructive"
                onClick={() => {
                  navigate('/notifications');
                  setNotifOpen(false);
                }}
              >
                查看全部
              </Button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">暂无通知</p>
              </div>
            ) : (
              recentNotifications.map((n) => {
                  const type = notifType[n.type] ?? notifType.info;
                  const Icon = type.Icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        onMarkRead(n.id);
                        navigate('/notifications');
                        setNotifOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors border-b border-border/20 last:border-b-0 group relative',
                        !n.isRead && 'bg-primary/[0.04]',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn('size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', type.cls)}>
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs truncate', !n.isRead && 'font-semibold')}>
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="size-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          {n.content && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {n.content}
                            </p>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </div>
                        </div>
                        {!n.isRead && (
                          <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-normal shrink-0 mt-0.5">
                            新
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
            )}
          </div>
          <div className="px-3 py-2 border-t border-border/40 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground"
              onClick={() => {
                navigate('/notifications');
                setNotifOpen(false);
              }}
            >
              查看所有通知
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate('/settings')}
      >
        <Settings className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={cycleTheme}
        aria-label={`当前主题：${settings.theme}，点击切换`}
      >
        {settings.theme === 'system' ? (
          <CheckCheck className="size-4" />
        ) : isDark ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )}
      </Button>
    </header>
  );
}
