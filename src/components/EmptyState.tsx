import type { ReactNode } from 'react';
import {
  FileText,
  FolderOpen,
  StickyNote,
  Calendar,
  CheckSquare,
  Clipboard,
  Code,
  SearchX,
  Star,
  Trash2,
  BarChart3,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateType =
  | 'notes'
  | 'notebooks'
  | 'sticky'
  | 'calendar'
  | 'todos'
  | 'clipboard'
  | 'snippets'
  | 'search'
  | 'favorite'
  | 'trash'
  | 'dashboard';

interface EmptyStateConfig {
  icon: typeof FileText;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: typeof Plus;
}

const CONFIG_MAP: Record<EmptyStateType, EmptyStateConfig> = {
  notes: {
    icon: FileText,
    title: '还没有笔记',
    description: '开始记录你的第一个想法吧',
    actionLabel: '创建第一篇笔记',
    actionIcon: Plus,
  },
  notebooks: {
    icon: FolderOpen,
    title: '还没有笔记本',
    description: '创建一个笔记本，开始整理你的知识',
    actionLabel: '新建笔记本',
    actionIcon: Plus,
  },
  sticky: {
    icon: StickyNote,
    title: '便签墙还空着',
    description: '随手记下灵感，贴在墙上随时可见',
    actionLabel: '添加便签',
    actionIcon: Plus,
  },
  calendar: {
    icon: Calendar,
    title: '日历空空如也',
    description: '添加事件和提醒，规划你的时间',
    actionLabel: '添加事件',
    actionIcon: Plus,
  },
  todos: {
    icon: CheckSquare,
    title: '所有任务都完成了',
    description: '太棒了！或者添加一些新任务吧',
    actionLabel: '新建待办',
    actionIcon: Plus,
  },
  clipboard: {
    icon: Clipboard,
    title: '剪贴板为空',
    description: '复制内容后会自动保存在这里',
  },
  snippets: {
    icon: Code,
    title: '还没有代码片段',
    description: '保存常用代码，需要时一键插入',
    actionLabel: '新建片段',
    actionIcon: Plus,
  },
  search: {
    icon: SearchX,
    title: '没有找到相关内容',
    description: '试试换个关键词，或调整筛选条件',
  },
  favorite: {
    icon: Star,
    title: '还没有收藏任何内容',
    description: '遇到喜欢的内容，点击星标即可收藏',
  },
  trash: {
    icon: Trash2,
    title: '回收站是空的',
    description: '删除的笔记会先出现在这里',
  },
  dashboard: {
    icon: BarChart3,
    title: '数据积累中',
    description: '持续使用，这里会展示你的使用统计',
  },
};

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  className?: string;
  extra?: ReactNode;
}

export default function EmptyState({ type, onAction, className, extra }: EmptyStateProps) {
  const config = CONFIG_MAP[type];
  const Icon = config.icon;
  const ActionIcon = config.actionIcon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        className,
      )}
    >
      {/* SVG 插画容器 */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl scale-125" />
        <div className="relative size-16 rounded-xl bg-gradient-to-br from-primary/10 to-accent/60 flex items-center justify-center border border-primary/10">
          <Icon className="size-7 text-primary/70" strokeWidth={1.5} />
        </div>
        {/* 装饰小圆点 */}
        <div className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary/30" />
        <div className="absolute -bottom-1.5 -left-2 size-2 rounded-full bg-accent-foreground/20" />
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1.5">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{config.description}</p>

      {config.actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="h-8 gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          {ActionIcon && <ActionIcon className="size-3.5" />}
          {config.actionLabel}
        </Button>
      )}

      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}
