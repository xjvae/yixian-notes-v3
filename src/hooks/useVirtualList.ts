import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface UseVirtualListOptions {
  /** 总项目数 */
  itemCount: number;
  /** 预估的单项高度（固定高度模式） */
  estimatedItemHeight: number;
  /** 可视区域高度，默认 600 */
  viewportHeight?: number;
  /** 上下额外渲染的缓冲区项目数，默认 5 */
  overscan?: number;
  /** 启用虚拟滚动的阈值，列表超过此数量才启用，默认 50 */
  threshold?: number;
  /** 动态高度回调：根据索引返回实际高度 */
  getItemHeight?: (index: number) => number;
  /** 滚动容器 ref 的外部引用 */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export interface VirtualItem {
  index: number;
  offsetTop: number;
  height: number;
}

export interface UseVirtualListReturn {
  /** 当前可视区的项目 */
  virtualItems: VirtualItem[];
  /** 总高度 */
  totalHeight: number;
  /** 滚动容器 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 滚动事件处理器 */
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** 当前滚动偏移 */
  scrollTop: number;
  /** 是否启用了虚拟滚动 */
  isVirtualized: boolean;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /** 测量并缓存项目实际高度（动态高度模式使用） */
  measureHeight: (index: number, height: number) => void;
}

/**
 * 轻量级虚拟滚动 Hook
 * - 支持固定高度和动态高度
 * - 列表数量未超过阈值时回退为普通渲染
 * - 使用 onScroll 方式实现，避免 IntersectionObserver 的额外开销
 */
export function useVirtualList(options: UseVirtualListOptions): UseVirtualListReturn {
  const {
    itemCount,
    estimatedItemHeight,
    viewportHeight = 600,
    overscan = 5,
    threshold = 50,
    getItemHeight,
    scrollContainerRef,
  } = options;

  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = scrollContainerRef ?? internalRef;
  const [scrollTop, setScrollTop] = useState(0);
  // 动态高度缓存：index -> measured height
  const heightCacheRef = useRef<Map<number, number>>(new Map());

  // 是否启用虚拟滚动
  const isVirtualized = itemCount > threshold;

  // 计算每个项目的实际高度
  const getItemActualHeight = useCallback(
    (index: number): number => {
      if (heightCacheRef.current.has(index)) {
        return heightCacheRef.current.get(index)!;
      }
      if (getItemHeight) {
        return getItemHeight(index);
      }
      return estimatedItemHeight;
    },
    [getItemHeight, estimatedItemHeight],
  );

  // 构建偏移量表（前缀和）
  const { offsets, totalHeight } = useMemo(() => {
    if (!isVirtualized) {
      return { offsets: [] as number[], totalHeight: 0 };
    }

    const offsetsArr = new Array(itemCount + 1);
    offsetsArr[0] = 0;

    if (getItemHeight) {
      // 动态高度模式：使用缓存 + 预估
      for (let i = 0; i < itemCount; i++) {
        const h = heightCacheRef.current.get(i);
        if (h !== undefined) {
          offsetsArr[i + 1] = offsetsArr[i] + h;
        } else {
          offsetsArr[i + 1] = offsetsArr[i] + getItemHeight(i);
        }
      }
    } else {
      // 固定高度模式
      for (let i = 0; i < itemCount; i++) {
        offsetsArr[i + 1] = offsetsArr[i] + estimatedItemHeight;
      }
    }

    return { offsets: offsetsArr, totalHeight: offsetsArr[itemCount] };
  }, [isVirtualized, itemCount, estimatedItemHeight, getItemHeight]);

  // 二分查找：找到 scrollTop 对应的起始索引
  const findStartIndex = useCallback(
    (top: number): number => {
      let lo = 0;
      let hi = itemCount - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (offsets[mid + 1] <= top) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return lo;
    },
    [offsets, itemCount],
  );

  // 计算可视区项目
  const virtualItems = useMemo((): VirtualItem[] => {
    if (!isVirtualized) return [];

    const startIdx = Math.max(0, findStartIndex(scrollTop) - overscan);
    const visibleBottom = scrollTop + viewportHeight;
    let endIdx = startIdx;

    // 从 startIdx 向后扫描，直到超出可视区
    while (endIdx < itemCount && offsets[endIdx] < visibleBottom) {
      endIdx++;
    }
    endIdx = Math.min(itemCount - 1, endIdx + overscan);

    const items: VirtualItem[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const height = getItemActualHeight(i);
      items.push({
        index: i,
        offsetTop: offsets[i],
        height,
      });
    }
    return items;
  }, [isVirtualized, scrollTop, viewportHeight, itemCount, overscan, findStartIndex, offsets, getItemActualHeight]);

  // 滚动事件处理器
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 动态高度测量回调：供项目渲染后调用
  const measureHeight = useCallback(
    (index: number, height: number) => {
      const cached = heightCacheRef.current.get(index);
      if (cached !== height) {
        heightCacheRef.current.set(index, height);
        // 触发重新计算（通过微扰动 scrollTop）
        const el = containerRef.current;
        if (el) {
          setScrollTop(el.scrollTop);
        }
      }
    },
    [containerRef],
  );

  // 滚动到指定索引
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el || !isVirtualized) return;
      const targetOffset = offsets[index] ?? 0;
      el.scrollTo({ top: targetOffset, behavior });
    },
    [containerRef, isVirtualized, offsets],
  );

  // 当 itemCount 变化时，清理不再需要的缓存
  useEffect(() => {
    if (heightCacheRef.current.size > itemCount * 2) {
      const validKeys = new Set<number>();
      for (let i = 0; i < itemCount; i++) {
        validKeys.add(i);
      }
      heightCacheRef.current.forEach((_, key) => {
        if (!validKeys.has(key)) {
          heightCacheRef.current.delete(key);
        }
      });
    }
  }, [itemCount]);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    onScroll,
    scrollTop,
    isVirtualized,
    scrollToIndex,
    measureHeight,
  };
}

export default useVirtualList;
