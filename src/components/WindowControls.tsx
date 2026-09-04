import { Minus, Pin, PinOff, X } from "lucide-react";
import type { CSSProperties } from "react";
import { APP_NO_DRAG } from "./WindowChromeHook";

interface WindowControlsProps {
  /** 最小化（收起/卷起） */
  onMinimize?: () => void;
  /** 置顶状态 */
  onTop?: boolean;
  /** 切换置顶 */
  onToggleOnTop?: () => void;
  /** 关闭窗口 */
  onClose?: () => void;
  /** 附加样式（一般无需传） */
  style?: CSSProperties;
}

/**
 * 浮动窗口公共控制条：最小化 / 置顶 / 关闭。
 * 三个按钮均以 -webkit-app-region: no-drag 处理，保证在拖拽区内仍可点击。
 */
export function WindowControls({
  onMinimize,
  onTop,
  onToggleOnTop,
  onClose,
  style,
}: WindowControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" style={{ ...APP_NO_DRAG, ...style }}>
      {onMinimize && (
        <button
          title="最小化"
          onClick={onMinimize}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <Minus className="size-3.5" />
        </button>
      )}
      {onToggleOnTop && (
        <button
          title={onTop ? "取消置顶" : "置顶"}
          onClick={onToggleOnTop}
          className={`rounded p-1 hover:bg-accent ${
            onTop ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {onTop ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
        </button>
      )}
      {onClose && (
        <button
          title="关闭"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}