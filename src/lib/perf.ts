/**
 * 轻量运行时性能记录器
 *
 * 用于「性能监控」：在应用启动阶段采集关键时序指标，写入 localStorage，
 * 供优化前后对比（与 scripts/size-report.mjs 的构建产物指标互补）。
 *
 * 采集指标（依赖 Performance API，无额外体积）：
 *  - navigationStart / domInteractive / domComplete / loadEventEnd
 *  - 首个 React 渲染时刻（mark-react-ready）
 *  - 初始 CSS / 脚本传输大小（transferSize）
 */
interface PerfEntry {
  ts: number;
  url: string;
  navStart: number;
  domInteractive: number;
  domComplete: number;
  loadEnd: number;
  reactReady: number;
  cssBytes: number;
  scriptBytes: number;
}

const HISTORY_KEY = 'yixian_perf_history';
const MAX_ENTRIES = 20;

function numOf(name: string): number {
  try {
    const nav = performance
      .getEntriesByType?.('navigation')
      ?.[0] as unknown as PerformanceNavigationTiming | undefined;
    const v = nav?.[name as keyof PerformanceNavigationTiming];
    return typeof v === 'number' ? v : -1;
  } catch {
    return -1;
  }
}

function bytesOf(initiator: string): number {
  try {
    const arr = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return arr
      .filter(
        (r) =>
          r.initiatorType === initiator ||
          (initiator === 'css' && /\.css(\?|$)/.test(r.name)),
      )
      .reduce((s, r) => s + ((r as unknown as { transferSize: number }).transferSize || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * 在 React 首帧渲染完成后调用，将本次启动时序写入历史记录。
 */
export function recordAppReady(): void {
  try {
    const p: PerfEntry = {
      ts: Date.now(),
      url: location.href,
      navStart: numOf('navigationStart'),
      domInteractive: numOf('domInteractive'),
      domComplete: numOf('domComplete'),
      loadEnd: numOf('loadEventEnd'),
      reactReady: performance.now(),
      cssBytes: bytesOf('css'),
      scriptBytes: bytesOf('script'),
    };
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as PerfEntry[];
    hist.push(p);
    if (hist.length > MAX_ENTRIES) hist.splice(0, hist.length - MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch {
    /* 非标准环境或受限 storage 时静默降级 */
  }
}

/** 读取历史记录，便于调试/报告。 */
export function readPerfHistory(): PerfEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as PerfEntry[];
  } catch {
    return [];
  }
}