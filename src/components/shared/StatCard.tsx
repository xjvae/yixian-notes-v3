import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatTone = 'default' | 'primary' | 'success' | 'warning' | 'destructive';

const TONE_MAP: Record<StatTone, { box: string; text: string }> = {
  default: { box: 'bg-muted text-muted-foreground', text: '' },
  primary: { box: 'bg-primary/10 text-primary', text: 'text-primary' },
  success: { box: 'bg-emerald-500/10 text-emerald-500', text: 'text-emerald-600' },
  warning: { box: 'bg-amber-500/10 text-amber-500', text: 'text-amber-600' },
  destructive: { box: 'bg-destructive/10 text-destructive', text: 'text-destructive' },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}

/** 统一统计概览卡（图标色块 + 值 + label），替代各页 grid 卡片重复写法 */
export function StatCard({ label, value, icon, tone = 'default', className }: StatCardProps) {
  const t = TONE_MAP[tone];
  return (
    <Card className={cn('border-border/50', className)}>
      <CardContent className="p-4 flex items-center gap-3">
        {icon && <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', t.box)}>{icon}</div>}
        <div className="min-w-0">
          <div className={cn('text-lg font-semibold leading-none', t.text)}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}