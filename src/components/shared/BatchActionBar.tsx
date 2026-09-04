import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BatchAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  disabled?: boolean;
}

interface BatchActionBarProps {
  /** 是否全选 */
  selected: boolean;
  /** 已选数量 */
  count: number;
  onToggleAll: () => void;
  onClear: () => void;
  actions: BatchAction[];
}

/** 统一批量操作栏（全选 + 已选 N 条 + 批量动作 + 取消） */
export function BatchActionBar({ selected, count, onToggleAll, onClear, actions }: BatchActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-y border-border/40 bg-muted/20">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleAll}
            className="size-3.5 accent-primary"
          />
          已选 {count} 项
        </label>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.variant ?? 'default'} onClick={a.onClick} disabled={a.disabled}>
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="size-3.5 mr-1" />
          取消
        </Button>
      </div>
    </div>
  );
}