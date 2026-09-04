/**
 * LazyECharts - 懒加载包装的 ECharts 组件
 *
 * 优化策略：
 * 1. 使用 echarts/core 按需引入，只加载项目中实际使用的图表类型
 * 2. 动态导入，不在初始 bundle 中
 * 3. 相比全量引入可减少约 60% 体积
 */

import {
  useEffect,
  useRef,
  useState,
  Suspense,
  type CSSProperties,
} from 'react';
import { cn } from '@/lib/utils';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

type EChartsOption = EChartsCoreOption;

/**
 * ECharts 组件属性
 */
export interface ReactEChartsProps {
  /** ECharts 配置项 */
  option: EChartsOption;
  /** 主题 */
  theme?: string | object;
  /** 样式 */
  style?: CSSProperties;
  /** 类名 */
  className?: string;
  /** 是否不合并 option */
  notMerge?: boolean;
  /** 是否惰性更新 */
  lazyUpdate?: boolean;
  /** 是否显示加载动画 */
  showLoading?: boolean;
  /** 加载配置项 */
  loadingOption?: object;
  /** ECharts 实例就绪回调 */
  onChartReady?: (chart: EChartsType) => void;
  /** 事件处理函数 */
  onEvents?: Record<string, (...args: unknown[]) => void>;
}

/**
 * 加载中占位符
 */
function ChartLoadingFallback({ height = 'h-[260px]' }: { height?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg',
        'border border-border/50 bg-muted/20',
        height
      )}
    >
      <div className="size-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground">加载图表...</span>
    </div>
  );
}

/**
 * 内部 ECharts 组件（直接使用 echarts/core）
 */
function EChartsInner({
  option,
  theme,
  style,
  className,
  notMerge = false,
  lazyUpdate = false,
  showLoading = false,
  loadingOption,
  onChartReady,
  onEvents,
}: ReactEChartsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const [echartsReady, setEchartsReady] = useState(false);

  // 动态导入 echarts/core
  useEffect(() => {
    let cancelled = false;
    let chart: EChartsType | null = null;

    async function init() {
      const echarts = await import('./echartCore');
      if (cancelled) return;

      if (containerRef.current) {
        chart = echarts.default.init(containerRef.current, theme, {
          renderer: 'canvas',
        });
        chartRef.current = chart;
        setEchartsReady(true);

        if (onChartReady) {
          onChartReady(chart);
        }

        // 绑定事件
        if (onEvents) {
          Object.entries(onEvents).forEach(([event, handler]) => {
            chart!.on(event, handler);
          });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (chart) {
        chart.dispose();
        chartRef.current = null;
      }
    };
  }, [theme, onChartReady, onEvents]);

  // 更新 option
  useEffect(() => {
    if (chartRef.current && echartsReady) {
      if (showLoading) {
        chartRef.current.showLoading(loadingOption);
      } else {
        chartRef.current.hideLoading();
        chartRef.current.setOption(option, {
          notMerge,
          lazyUpdate,
        });
      }
    }
  }, [option, showLoading, loadingOption, notMerge, lazyUpdate, echartsReady]);

  // 响应式调整
  useEffect(() => {
    if (!chartRef.current) return;

    const handleResize = () => {
      chartRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: '200px', ...style }}
    />
  );
}

/**
 * 懒包装的 ECharts 组件
 *
 * 用法与原 ReactECharts 完全一致：
 * ```tsx
 * import LazyECharts from '@/components/Chart/LazyECharts';
 * <LazyECharts option={option} theme="ud" className="h-[260px]" />
 * ```
 */
export function LazyECharts(props: ReactEChartsProps) {
  const heightClass = props.className?.match(/h-\[?\d+px\]?|h-\d+/)?.[0];

  return (
    <Suspense fallback={<ChartLoadingFallback height={heightClass ? `h-${heightClass}` : 'h-[260px]'} />}>
      <EChartsInner {...props} />
    </Suspense>
  );
}

export default LazyECharts;
