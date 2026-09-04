/**
 * Mermaid 图表渲染组件
 * 
 * 功能：
 * - 使用 mermaid 库渲染图表（懒加载，不在初始 bundle 中）
 * - 支持从 Markdown 代码块中提取 mermaid 图表
 * - 错误处理和回退显示
 * - 主题跟随应用主题（light/dark）
 * - 缩放和全屏查看
 * - 导出为 SVG/PNG
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// ────────────────────────────────────────────────────────────────────────────
// 类型
// ────────────────────────────────────────────────────────────────────────────

interface MermaidRendererProps {
  /** Mermaid 图表源码 */
  code: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义 ID（可选） */
  id?: string;
  /** 初始缩放比例 */
  initialScale?: number;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
}

interface MermaidErrorProps {
  message: string;
  code: string;
  onRetry?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// 懒加载 mermaid 模块（不在初始 bundle 中）
// ────────────────────────────────────────────────────────────────────────────

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  parse: (code: string) => Promise<boolean>;
  render: (id: string, code: string) => Promise<{ svg: string }>;
}

let mermaidModule: MermaidApi | null = null;
let mermaidLoading: Promise<MermaidApi> | null = null;

async function loadMermaid(): Promise<MermaidApi> {
  if (mermaidModule) return mermaidModule;
  if (mermaidLoading) return mermaidLoading;

  mermaidLoading = import('mermaid').then((mod) => {
    const m = mod.default as unknown as MermaidApi;
    mermaidModule = m;
    return m;
  });

  return mermaidLoading;
}

// ────────────────────────────────────────────────────────────────────────────
// 主题检测
// ────────────────────────────────────────────────────────────────────────────

function useThemeMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setMode(isDark ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return mode;
}

// ────────────────────────────────────────────────────────────────────────────
// Mermaid 初始化状态
// ────────────────────────────────────────────────────────────────────────────

interface InitState {
  ready: boolean;
  theme: 'light' | 'dark';
}

// ────────────────────────────────────────────────────────────────────────────
// 错误显示组件
// ────────────────────────────────────────────────────────────────────────────

function MermaidError({ message, code, onRetry }: MermaidErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4 rounded-lg',
        'bg-destructive/5 border border-destructive/20'
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <span className="text-sm font-medium">图表渲染失败</span>
      </div>
      <p className="text-xs text-destructive/80 font-mono break-all">
        {message}
      </p>
      <details className="mt-1">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          查看源码
        </summary>
        <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto text-muted-foreground">
          {code}
        </pre>
      </details>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
            'text-xs font-medium border border-destructive/30',
            'text-destructive hover:bg-destructive/10 transition-colors'
          )}
        >
          <RotateCcw className="size-3" />
          重试
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 工具栏组件
// ────────────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullscreen: () => void;
  onExportSvg: () => void;
  onCopyCode: () => void;
  copied: boolean;
  svgRef: React.RefObject<HTMLDivElement | null>;
}

function Toolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  onExportSvg,
  onCopyCode,
  copied,
}: ToolbarProps) {
  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-10',
        'flex items-center gap-0.5 p-1 rounded-lg',
        'bg-background/80 backdrop-blur-sm border shadow-sm',
        'opacity-0 group-hover:opacity-100 transition-opacity'
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onZoomOut}
            className="size-7 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
            aria-label="缩小"
          >
            <ZoomOut className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p className="text-xs">缩小</p></TooltipContent>
      </Tooltip>

      <span className="text-[10px] font-mono text-muted-foreground min-w-[40px] text-center">
        {Math.round(scale * 100)}%
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onZoomIn}
            className="size-7 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
            aria-label="放大"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p className="text-xs">放大</p></TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCopyCode}
            className={cn(
              'size-7 flex items-center justify-center rounded hover:bg-muted-foreground/10 transition-colors',
              copied ? 'text-success' : 'text-muted-foreground'
            )}
            aria-label={copied ? '已复制' : '复制代码'}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{copied ? '已复制' : '复制 Mermaid 代码'}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onExportSvg}
            className="size-7 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
            aria-label="导出 SVG"
          >
            <Download className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p className="text-xs">导出 SVG</p></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onFullscreen}
            className="size-7 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
            aria-label="全屏查看"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p className="text-xs">全屏查看</p></TooltipContent>
      </Tooltip>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 主组件
// ────────────────────────────────────────────────────────────────────────────

export function MermaidRenderer({
  code,
  className,
  id: propId,
  initialScale = 1,
  showToolbar = true,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(initialScale);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [libState, setLibState] = useState<InitState>({ ready: false, theme: 'light' });
  const themeMode = useThemeMode();

  const id = useMemo(
    () => propId || `mermaid-${Math.random().toString(36).substring(2, 10)}`,
    [propId]
  );

  // 懒加载 mermaid 并初始化
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          theme: themeMode === 'dark' ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'Noto Sans SC, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 14,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
          sequence: {
            useMaxWidth: true,
            mirrorActors: false,
          },
          gantt: {
            useMaxWidth: true,
            axisFormat: '%Y-%m-%d',
          },
        });

        if (!cancelled) {
          setLibState({ ready: true, theme: themeMode });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid 库加载失败');
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [themeMode]);

  // 渲染 mermaid 图表
  const renderChart = useCallback(async () => {
    if (!code.trim()) {
      setError('图表代码为空');
      setLoading(false);
      return;
    }

    if (!libState.ready) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mermaid = await loadMermaid();

      // 验证并渲染
      const isValid = await mermaid.parse(code);
      if (!isValid) {
        throw new Error('Mermaid 语法解析失败');
      }

      const { svg } = await mermaid.render(id, code);
      setSvgContent(svg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSvgContent(null);
    } finally {
      setLoading(false);
    }
  }, [code, id, libState.ready]);

  // 初始渲染和代码变化时重新渲染
  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // 缩放控制
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.3));
  }, []);

  // 复制代码
  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // 导出 SVG
  const handleExportSvg = useCallback(() => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-chart-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgContent]);

  // 全屏内容
  const fullscreenContent = (
    <div className="relative w-full h-full flex items-center justify-center overflow-auto p-8">
      <div
        className="transition-transform duration-200"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        dangerouslySetInnerHTML={{ __html: svgContent || '' }}
      />
    </div>
  );

  return (
    <div className={cn('group relative', className)}>
      {/* 工具栏 */}
      {showToolbar && svgContent && !error && (
        <Toolbar
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFullscreen={() => setFullscreen(true)}
          onExportSvg={handleExportSvg}
          onCopyCode={handleCopyCode}
          copied={copied}
          svgRef={svgRef}
        />
      )}

      {/* 主容器 */}
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-lg border bg-card overflow-auto',
          'min-h-[100px] flex items-center justify-center',
          error && 'border-destructive/30'
        )}
      >
        {/* 加载状态 */}
        {loading && (
          <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
            <div className="size-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span className="text-xs">加载图表库...</span>
          </div>
        )}

        {/* 错误状态 */}
        {!loading && error && (
          <div className="w-full p-4">
            <MermaidError message={error} code={code} onRetry={renderChart} />
          </div>
        )}

        {/* 成功渲染 */}
        {!loading && !error && svgContent && (
          <div
            ref={svgRef}
            className="w-full p-4 overflow-auto transition-transform duration-200"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* 全屏对话框 */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-background">
          <DialogTitle className="sr-only">图表全屏预览</DialogTitle>

          {/* 全屏工具栏 */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm border shadow-sm">
            <button
              type="button"
              onClick={handleZoomOut}
              className="size-8 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground"
            >
              <ZoomOut className="size-4" />
            </button>
            <span className="text-xs font-mono text-muted-foreground min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="size-8 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground"
            >
              <ZoomIn className="size-4" />
            </button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              type="button"
              onClick={handleExportSvg}
              className="size-8 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground"
            >
              <Download className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="size-8 flex items-center justify-center rounded hover:bg-muted-foreground/10 text-muted-foreground"
            >
              <Minimize2 className="size-4" />
            </button>
          </div>

          {fullscreenContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 从 Markdown 中提取并渲染 mermaid 的辅助组件
// ────────────────────────────────────────────────────────────────────────────

interface MermaidFromMarkdownProps {
  /** Markdown 内容（包含 ```mermaid 代码块） */
  content: string;
  className?: string;
}

export function MermaidFromMarkdown({ content, className }: MermaidFromMarkdownProps) {
  const blocks = useMemo(() => {
    const result: Array<{ id: string; code: string }> = [];
    const regex = /```mermaid\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = regex.exec(content)) !== null) {
      result.push({
        id: `md-mermaid-${index}-${Date.now()}`,
        code: match[1].trim(),
      });
      index++;
    }

    return result;
  }, [content]);

  if (blocks.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {blocks.map((block) => (
        <MermaidRenderer key={block.id} code={block.code} id={block.id} />
      ))}
    </div>
  );
}

export default MermaidRenderer;
