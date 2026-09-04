import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// 笔记列表骨架：5 条卡片
export function NoteListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('p-2.5 space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-border/50 bg-card space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-10 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 编辑器骨架：标题 + 3 段正文
export function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('px-8 py-8 space-y-5 max-w-[720px] mx-auto', className)}>
      <Skeleton className="h-9 w-4/5 rounded-md" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20 ml-2" />
      </div>
      <div className="space-y-2.5 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[88%]" />
        <Skeleton className="h-4 w-[96%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      <div className="space-y-2.5 pt-2">
        <Skeleton className="h-5 w-1/4 rounded-md" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[85%]" />
      </div>
      <div className="space-y-2.5 pt-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
    </div>
  );
}

// 仪表盘卡片骨架
export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 rounded-xl border border-border/50 bg-card space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-9 w-2/3 rounded-md" />
      <div className="h-24 w-full rounded-md bg-accent/50" />
    </div>
  );
}

// 文件卡片骨架
export function FileCardSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// 日历网格骨架
export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-3 rounded-xl border border-border/50 bg-card', className)}>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-16 w-full rounded-md opacity-60"
            style={{ opacity: 0.3 + Math.random() * 0.5 }}
          />
        ))}
      </div>
    </div>
  );
}

// 通用页面骨架屏（路由懒加载 fallback）
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col h-full p-6 space-y-4 animate-pulse', className)}>
      <Skeleton className="h-8 w-1/3 rounded-md" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[88%]" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-4 w-[75%]" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

// 搜索结果骨架
export function SearchResultSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border/40 bg-card space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
