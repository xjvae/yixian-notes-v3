import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** 统一页面顶部标题栏：图标 + 标题 + 副标题（左），操作按钮组（右） */
export function PageHeader({ icon, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-4', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="size-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}