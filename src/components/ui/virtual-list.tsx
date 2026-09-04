import React, { useRef } from 'react';
import { useVirtualList, type UseVirtualListOptions, type VirtualItem } from '@/hooks/useVirtualList';
import { cn } from '@/lib/utils';

// Re-export types
export type { UseVirtualListOptions, VirtualItem };

export interface VirtualListProps<T> extends Omit<UseVirtualListOptions, 'scrollContainerRef'> {
  /** 数据数组 */
  items: T[];
  /** 渲染每个项目的函数 */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => React.ReactNode;
  /** 从项目中提取唯一 key */
  getKey: (item: T, index: number) => string;
  /** 容器 CSS 类名 */
  className?: string;
  /** 内容区域 CSS 类名 */
  contentClassName?: string;
  /** 空列表时渲染的内容 */
  renderEmpty?: () => React.ReactNode;
  /** 容器内联样式 */
  style?: React.CSSProperties;
  /** 是否在项目底部显示间距 */
  gap?: number;
}

/**
 * 虚拟列表组件
 *
 * 使用示例：
 * ```tsx
 * <VirtualList
 *   items={notes}
 *   estimatedItemHeight={88}
 *   overscan={5}
 *   getKey={(note) => note.id}
 *   renderItem={(note, index, vItem) => (
 *     <div style={{ position: 'absolute', top: vItem.offsetTop, left: 0, right: 0 }}>
 *       <NoteCard note={note} />
 *     </div>
 *   )}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  estimatedItemHeight,
  viewportHeight = 600,
  overscan = 5,
  threshold = 50,
  getItemHeight,
  renderItem,
  getKey,
  className,
  contentClassName,
  renderEmpty,
  style,
  gap = 0,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    virtualItems,
    totalHeight,
    onScroll,
    isVirtualized,
  } = useVirtualList({
    itemCount: items.length,
    estimatedItemHeight: estimatedItemHeight + gap,
    viewportHeight,
    overscan,
    threshold,
    getItemHeight: getItemHeight
      ? (idx) => getItemHeight(idx) + gap
      : undefined,
    scrollContainerRef: containerRef,
  });

  // 空列表
  if (items.length === 0 && renderEmpty) {
    return (
      <div className={cn('overflow-y-auto', className)} style={style}>
        {renderEmpty()}
      </div>
    );
  }

  // 未启用虚拟滚动时，直接渲染全部
  if (!isVirtualized) {
    return (
      <div
        ref={containerRef}
        className={cn('overflow-y-auto', className)}
        style={style}
        onScroll={onScroll}
      >
        <div className={contentClassName}>
          {items.map((item, index) => (
            <React.Fragment key={getKey(item, index)}>
              {renderItem(item, index, { index, offsetTop: 0, height: 0 })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // 虚拟滚动模式
  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto', className)}
      style={style}
      onScroll={onScroll}
    >
      <div
        style={{ height: totalHeight, position: 'relative' }}
        className={contentClassName}
      >
        {virtualItems.map((vItem) => {
          const item = items[vItem.index];
          if (!item) return null;
          return (
            <div
              key={getKey(item, vItem.index)}
              style={{
                position: 'absolute',
                top: vItem.offsetTop,
                left: 0,
                right: 0,
                minHeight: vItem.height,
              }}
            >
              {renderItem(item, vItem.index, vItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
