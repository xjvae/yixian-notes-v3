"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 自定义 Dialog —— 不依赖 @radix-ui/react-dialog，
 * 用于解决 Tauri WebView 中 Radix Dialog 模块加载导致白屏的问题。
 *
 * 通过 Context 将 Dialog 根组件的 onOpenChange 下发给 DialogClose/弹窗内容，
 * 使「取消」「确定」「右上角 ×」等关闭入口都能真正关闭弹窗。
 */

const DialogContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>({})

// Dialog 根组件
function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  [key: string]: unknown
}) {
  const [mounted, setMounted] = React.useState(false)
  const openRef = React.useRef(open)

  React.useEffect(() => {
    setMounted(true)
    openRef.current = open ?? false
  }, [open])

  // 关闭时也解挂
  if (!mounted || !open) {
    return null
  }

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-50">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0"
          onClick={() => onOpenChange?.(false)}
        />
        {children}
      </div>
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  children,
}: {
  children: React.ReactNode
  [key: string]: unknown
}) {
  return <>{children}</>
}

function DialogPortal({
  children,
}: {
  children: React.ReactNode
  [key: string]: unknown
}) {
  return <>{children}</>
}

function DialogClose({
  children,
  asChild,
  onClick,
  className,
  ...props
}: {
  children?: React.ReactNode
  asChild?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
  [key: string]: unknown
}) {
  const { onOpenChange } = React.useContext(DialogContext)

  const handleClick = (e: React.MouseEvent<any>) => {
    onClick?.(e)
    onOpenChange?.(false)
  }

  // asChild：把 close 行为注入到子元素（通常是一个 Button）
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    })
  }

  // 有 children 但无 asChild：渲染为按钮，保留传入样式使其可点击关闭
  if (children) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn("inline-flex items-center justify-center", className)}
        {...props}
      >
        {children}
      </button>
    )
  }

  // 默认右上角关闭按钮
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="关闭"
      className={cn(
        "focus:ring-ring absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground enabled:hover:rotate-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <XIcon />
    </button>
  )
}

function DialogOverlay(_props: {
  className?: string
  [key: string]: unknown
}) {
  return null
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: {
  className?: string
  children: React.ReactNode
  showCloseButton?: boolean
  [key: string]: unknown
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 zoom-in-95 isolate fixed top-[50%] left-[50%] z-50 grid w-full max-sm:max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-black/10 bg-background/85 p-6 shadow-[0_24px_80px_-24px_hsl(210_15%_18%/0.4),0_8px_30px_rgb(0_0_0/0.06)] duration-200 backdrop-blur-2xl max-w-lg",
        className
      )}
      {...props}
    >
      {/* 玻璃卡片内部光晕，增强层次感（置于内容之下） */}
      <span
        aria-hidden
        className="pointer-events-none absolute -z-10 inset-0 overflow-hidden rounded-2xl"
      >
        <span className="absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/70 to-transparent blur-2xl" />
      </span>
      {/* 顶部柔和高光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent"
      />
      {children}
      {showCloseButton && <DialogClose aria-label="关闭弹窗" />}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}