/**
 * 增强版 Markdown 查看器
 * 
 * 集成功能：
 * - react-markdown + remark-gfm（GFM：表格、任务列表、删除线）
 * - remark-math + rehype-katex（数学公式，懒加载）
 * - rehype-highlight（代码高亮，懒加载）
 * - Mermaid 图表渲染（懒加载）
 * - 图片点击放大
 * - 链接点击处理（内部路由/外部浏览器）
 * 
 * 优化：所有重型库（katex、mermaid、highlight）均为懒加载，
 * 不在初始 bundle 中，仅在用户实际使用时才加载。
 */

import { useState, useCallback, useEffect, useMemo, lazy, Suspense, Component, type ReactNode, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageLightbox from '@/components/FloatingNote/ImageLightbox';

// ────────────────────────────────────────────────────────────────────────────
// 懒加载 MermaidRenderer（不在初始 bundle 中）
// ────────────────────────────────────────────────────────────────────────────

const MermaidRenderer = lazy(() => import('@/components/Mermaid/MermaidRenderer').then(m => ({ default: m.MermaidRenderer })));

// ────────────────────────────────────────────────────────────────────────────
// 懒加载 KaTeX CSS（通过动态 import）
// ────────────────────────────────────────────────────────────────────────────

let katexCssInjected = false;

async function injectKatexCss(): Promise<void> {
  if (katexCssInjected || typeof document === 'undefined') return;
  katexCssInjected = true;

  try {
    await import('katex/dist/katex.min.css?inline');
  } catch {
    if (!document.getElementById('katex-css-md')) {
      const link = document.createElement('link');
      link.id = 'katex-css-md';
      link.rel = 'stylesheet';
      link.href = new URL('katex/dist/katex.min.css', import.meta.url).href;
      document.head.appendChild(link);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 可选依赖：rehype-highlight（代码高亮）
// 未在 package.json 中声明，使用懒加载
// ────────────────────────────────────────────────────────────────────────────

type RehypeHighlightFn = (options?: Record<string, unknown>) => unknown;
let highlightCache: RehypeHighlightFn | null = null;
let highlightLoaded = false;

async function loadHighlight(): Promise<RehypeHighlightFn | null> {
  if (highlightLoaded) return highlightCache;
  highlightLoaded = true;
  try {
    const mod = await import('rehype-highlight' as string);
    highlightCache = (mod.default || null) as RehypeHighlightFn | null;
  } catch {
    highlightCache = null;
  }
  return highlightCache;
}

// ────────────────────────────────────────────────────────────────────────────
// 可选依赖：rehype-katex（懒加载）
// ────────────────────────────────────────────────────────────────────────────

type RehypeKatexFn = (options?: Record<string, unknown>) => unknown;
let rehypeKatexCache: RehypeKatexFn | null = null;
let rehypeKatexLoaded = false;

async function loadRehypeKatex(): Promise<RehypeKatexFn | null> {
  if (rehypeKatexLoaded) return rehypeKatexCache;
  rehypeKatexLoaded = true;
  try {
    const mod = await import('rehype-katex' as string);
    // 同时注入 KaTeX CSS
    await injectKatexCss();
    rehypeKatexCache = (mod.default || null) as RehypeKatexFn | null;
  } catch {
    rehypeKatexCache = null;
  }
  return rehypeKatexCache;
}

// ────────────────────────────────────────────────────────────────────────────
// 类型
// ────────────────────────────────────────────────────────────────────────────

interface MarkdownViewProps {
  /** Markdown 源码 */
  content: string;
  /** 自定义类名 */
  className?: string;
  /** 是否启用 Mermaid 图表 */
  enableMermaid?: boolean;
  /** 是否启用数学公式 */
  enableMath?: boolean;
  /** 是否启用代码高亮 */
  enableCodeHighlight?: boolean;
  /** 内部链接点击回调（用于路由跳转） */
  onInternalLinkClick?: (href: string) => void;
  /** 图片点击回调 */
  onImageClick?: (src: string, alt: string) => void;
}

interface ImageLightboxState {
  src: string;
  alt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Mermaid 加载占位符
// ────────────────────────────────────────────────────────────────────────────

function MermaidLoadingFallback({ code }: { code: string }) {
  return (
    <div className="my-4 flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-border/50 bg-muted/20 min-h-[100px]">
      <div className="size-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground">加载 Mermaid 图表库...</span>
      <details className="mt-1 w-full max-w-xs">
        <summary className="text-[10px] text-muted-foreground/60 cursor-pointer text-center">
          查看源码
        </summary>
        <pre className="mt-1 p-2 bg-muted/30 rounded text-[10px] font-mono overflow-x-auto text-muted-foreground/50 whitespace-pre-wrap break-all">
          {code}
        </pre>
      </details>
    </div>
  );
}

// 图片渲染组件：管理加载失败状态 + 点击放大
function MarkdownImage({
  src,
  alt,
  onImageClick,
  ...props
}: ComponentProps<'img'> & { onImageClick?: (src: string, alt: string) => void }) {
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (src && onImageClick) {
      onImageClick(src, alt || '');
    }
  };

  if (error) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-md',
          'bg-muted text-muted-foreground text-sm border'
        )}
      >
        <ImageIcon className="size-4" />
        <span className="text-xs">图片加载失败</span>
      </span>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={cn(
        'max-w-full h-auto rounded-md cursor-zoom-in',
        'border border-border/50',
        'hover:border-border hover:shadow-sm transition-all'
      )}
      onClick={handleClick}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 自定义组件（用于 react-markdown 的 components 属性）
// ────────────────────────────────────────────────────────────────────────────

function createComponents(
  onImageClick?: (src: string, alt: string) => void,
  onLinkClick?: (href: string) => void,
  enableMermaid: boolean = true
) {
  return {
    // 图片处理：点击放大
    img: (props: ComponentProps<'img'>) => <MarkdownImage {...props} onImageClick={onImageClick} />,

    // 链接处理：内部路由 vs 外部浏览器
    a: ({ href, children, ...props }: ComponentProps<'a'>) => {
      const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
      const isAnchor = href?.startsWith('#');

      const handleClick = (e: React.MouseEvent) => {
        if (isExternal) {
          // 外部链接：在 Tauri 环境中使用 shell 打开
          e.preventDefault();
          if ((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
            // Tauri 2.x shell API
            import('@tauri-apps/plugin-shell').then(({ open }) => {
              open(href!);
            }).catch(() => {
              window.open(href, '_blank', 'noopener,noreferrer');
            });
          } else {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        } else if (!isAnchor && href && onLinkClick) {
          // 内部链接
          e.preventDefault();
          onLinkClick(href);
        }
        // 锚点链接：默认行为
      };

      return (
        <a
          {...props}
          href={href}
          onClick={handleClick}
          className={cn(
            'text-primary underline underline-offset-2',
            'hover:text-primary/80 transition-colors',
            'inline-flex items-center gap-1',
            isExternal && 'inline-flex items-center'
          )}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {children}
          {isExternal && <ExternalLink className="size-3 opacity-50" />}
        </a>
      );
    },

    // 代码块处理：mermaid 图表 vs 普通代码高亮
    code: ({ className, children, ...props }: ComponentProps<'code'>) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1] || '';
      const codeChildren = Array.isArray(children)
        ? children
            .map((c) => (c && typeof c === 'object' && 'props' in c ? c.props.children : c))
            .flat()
            .join('')
        : String(children ?? '');
      const codeString = String(codeChildren).replace(/\n$/, '');

      // Mermaid 代码块 (懒加载)
      if (language === 'mermaid' && enableMermaid) {
        return (
          <div className="my-4">
            <Suspense fallback={<MermaidLoadingFallback code={codeString} />}>
              <MermaidRenderer code={codeString} />
            </Suspense>
          </div>
        );
      }

      // 行内代码
      if (!className) {
        return (
          <code
            className={cn(
              'px-1.5 py-0.5 rounded text-sm font-mono',
              'bg-muted text-muted-foreground',
              'border border-border/50'
            )}
            {...props}
          >
            {children}
          </code>
        );
      }

      // 普通代码块（带高亮）
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // 表格增强
    table: ({ children, ...props }: ComponentProps<'table'>) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
        <table {...props} className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    ),

    thead: ({ children, ...props }: ComponentProps<'thead'>) => (
      <thead {...props} className="bg-muted/50 border-b border-border/50">
        {children}
      </thead>
    ),

    th: ({ children, ...props }: ComponentProps<'th'>) => (
      <th
        {...props}
        className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
      >
        {children}
      </th>
    ),

    td: ({ children, ...props }: ComponentProps<'td'>) => (
      <td {...props} className="px-4 py-2.5 border-t border-border/30">
        {children}
      </td>
    ),

    // 任务列表
    input: ({ type, checked, ...props }: ComponentProps<'input'>) => {
      if (type === 'checkbox') {
        return (
          <input
            {...props}
            type="checkbox"
            checked={checked}
            readOnly
            className={cn(
              'size-4 rounded border-border',
              'accent-primary cursor-default',
              'pointer-events-none'
            )}
          />
        );
      }
      return <input {...props} />;
    },

    // 标题添加锚点
    h1: ({ children, ...props }: ComponentProps<'h1'>) => (
      <h1
        {...props}
        className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border/30 scroll-mt-16"
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: ComponentProps<'h2'>) => (
      <h2
        {...props}
        className="text-xl font-semibold mt-5 mb-2.5 pb-1.5 border-b border-border/20 scroll-mt-16"
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: ComponentProps<'h3'>) => (
      <h3 {...props} className="text-lg font-semibold mt-4 mb-2 scroll-mt-16">
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: ComponentProps<'h4'>) => (
      <h4 {...props} className="text-base font-semibold mt-3 mb-1.5 scroll-mt-16">
        {children}
      </h4>
    ),

    // 引用块
    blockquote: ({ children, ...props }: ComponentProps<'blockquote'>) => (
      <blockquote
        {...props}
        className={cn(
          'my-3 pl-4 py-1 border-l-3 border-primary/40',
          'bg-primary/5 rounded-r-md',
          'text-muted-foreground italic'
        )}
      >
        {children}
      </blockquote>
    ),

    // 分割线
    hr: (props: ComponentProps<'hr'>) => (
      <hr {...props} className="my-6 border-border/40" />
    ),

    // 列表
    ul: ({ children, ...props }: ComponentProps<'ul'>) => (
      <ul {...props} className="my-2 space-y-1 list-disc list-inside">
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: ComponentProps<'ol'>) => (
      <ol {...props} className="my-2 space-y-1 list-decimal list-inside">
        {children}
      </ol>
    ),
    li: ({ children, ...props }: ComponentProps<'li'>) => (
      <li {...props} className="text-sm leading-relaxed">
        {children}
      </li>
    ),

    // 段落
    p: ({ children, ...props }: ComponentProps<'p'>) => (
      <p {...props} className="my-2 leading-relaxed text-sm">
        {children}
      </p>
    ),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 渲染错误边界：避免个别 markdown 内容/插件异常导致整页白屏
// ────────────────────────────────────────────────────────────────────────────

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; source?: string },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error) {
      // 渲染失败时展示原始 Markdown 源码，保证内容仍可读、可编辑
      return (
        <div
          className={cn(
            'my-3 rounded-md border border-destructive/40 bg-destructive/5 p-3',
            'text-sm text-muted-foreground'
          )}
        >
          <p className="mb-2 font-medium text-foreground">
            Markdown 预览渲染失败，已退化为源码显示（可继续编辑）
          </p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
            {typeof this.props.source === 'string' && this.props.source.length > 0
              ? this.props.source
              : (this.state.error.message ?? '')}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 主组件
// ────────────────────────────────────────────────────────────────────────────

export function MarkdownView({
  content,
  className,
  enableMermaid = true,
  enableMath = true,
  enableCodeHighlight = true,
  onInternalLinkClick,
  onImageClick,
}: MarkdownViewProps) {
  const [lightbox, setLightbox] = useState<ImageLightboxState | null>(null);
  const [highlightPlugin, setHighlightPlugin] = useState<RehypeHighlightFn | null>(null);
  const [katexPlugin, setKatexPlugin] = useState<RehypeKatexFn | null>(null);

  // 懒加载 rehype-highlight
  useEffect(() => {
    if (enableCodeHighlight) {
      loadHighlight().then(setHighlightPlugin);
    } else {
      setHighlightPlugin(null);
    }
  }, [enableCodeHighlight]);

  // 懒加载 rehype-katex（仅在启用数学公式时）
  useEffect(() => {
    if (enableMath) {
      loadRehypeKatex().then(setKatexPlugin);
    } else {
      setKatexPlugin(null);
    }
  }, [enableMath]);

  // 图片点击处理
  const handleImageClick = useCallback(
    (src: string, alt: string) => {
      if (onImageClick) {
        onImageClick(src, alt);
      } else {
        setLightbox({ src, alt });
      }
    },
    [onImageClick]
  );

  // 链接点击处理
  const handleLinkClick = useCallback(
    (href: string) => {
      if (onInternalLinkClick) {
        onInternalLinkClick(href);
      }
    },
    [onInternalLinkClick]
  );

  // 构建 remark 插件列表
  const remarkPlugins = useMemo(() => {
    const plugins: unknown[] = [remarkGfm];
    if (enableMath) {
      plugins.push(remarkMath);
    }
    return plugins;
  }, [enableMath]);

  // 构建 rehype 插件列表
  const rehypePlugins = useMemo(() => {
    const plugins: unknown[] = [];
    if (enableMath && katexPlugin) {
      plugins.push(katexPlugin);
    }
    if (enableCodeHighlight && highlightPlugin) {
      plugins.push([highlightPlugin, { ignoreMissing: true, detect: true }]);
    }
    return plugins;
  }, [enableMath, enableCodeHighlight, katexPlugin, highlightPlugin]);

  // 自定义渲染组件
  const components = useMemo(
    () => createComponents(handleImageClick, handleLinkClick, enableMermaid),
    [handleImageClick, handleLinkClick, enableMermaid]
  );

  // 预处理：如果禁用 mermaid，将 mermaid 代码块替换为普通代码块
  const processedContent = useMemo(() => {
    if (!enableMermaid) {
      return content.replace(/```mermaid(\s*\n)/g, '```text$1');
    }
    return content;
  }, [content, enableMermaid]);

  return (
    <div className={cn('markdown-view', className)}>
      <MarkdownErrorBoundary source={processedContent}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins as never}
          rehypePlugins={rehypePlugins as never}
          components={components as never}
        >
          {processedContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>

      {/* 图片 Lightbox（复用共享组件） */}
      <ImageLightbox
        src={lightbox?.src || ''}
        alt={lightbox?.alt || '图片预览'}
        open={!!lightbox}
        onOpenChange={() => setLightbox(null)}
      />
    </div>
  );
}

export default MarkdownView;
