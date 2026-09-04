import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 自定义错误回退 UI，不传则使用默认 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 错误捕获回调（可用于上报日志） */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  componentStack?: string | null;
}

/**
 * 错误边界：捕获子树渲染期异常，避免整个应用白屏。
 * - 捕获范围：render、生命周期、构造函数中的抛错
 * - 不捕获：事件回调、setTimeout、异步错误（需自行 try/catch）
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, componentStack: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 输出到控制台便于排查（未来可接入日志上报）
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null, componentStack: undefined });
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
          style={{ background: "var(--yx-background)", color: "var(--yx-foreground)" }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>页面渲染失败</h3>
          <pre
            style={{
              maxWidth: 560,
              padding: 12,
              background: "var(--yx-muted)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--yx-destructive)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {this.state.error.message}
          </pre>
          {this.state.componentStack ? (
            <pre
              style={{
                maxWidth: 560,
                padding: 12,
                background: "var(--yx-muted)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--yx-foreground)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 200,
                overflow: "auto",
                textAlign: "left",
              }}
            >
              {this.state.componentStack.split("\n").slice(0, 12).join("\n")}
            </pre>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--yx-border)",
                background: "var(--yx-primary)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--yx-border)",
                background: "transparent",
                color: "var(--yx-foreground)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
