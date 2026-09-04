import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  /** 内容最大宽度，默认 4xl */
  maxWidth?: 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
  className?: string;
}

const WIDTH_MAP = {
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-none',
} as const;

/** 统一页面内容容器（水平居中 + padding + 纵向间距） */
export function PageContainer({ children, maxWidth = '4xl', className }: PageContainerProps) {
  return (
    <div className={cn('w-full mx-auto px-6 py-6 space-y-6', WIDTH_MAP[maxWidth], className)}>
      {children}
    </div>
  );
}