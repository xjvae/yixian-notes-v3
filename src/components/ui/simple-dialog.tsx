/**
 * SimpleDialog - 不依赖 @radix-ui/react-dialog 的简单对话框组件
 * 用于解决 Tauri WebView 中 @radix-ui/react-dialog 模块加载时导致白屏的问题
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function SimpleDialog({ open, onOpenChange, children }: SimpleDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false)
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
    return undefined
  }, [open, onOpenChange])

  if (!mounted || !open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="fixed top-[50%] left-[50%] z-50 isolate grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-black/10 bg-background/85 p-6 shadow-[0_24px_80px_-24px_hsl(210_15%_18%/0.4),0_8px_30px_rgb(0_0_0/0.06)] duration-200 animate-in fade-in-0 zoom-in-95 backdrop-blur-2xl">
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
        {/* 右上角关闭按钮 */}
        <button
          type="button"
          aria-label="关闭"
          onClick={() => onOpenChange(false)}
          className="focus:ring-ring absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground enabled:hover:rotate-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

interface SimpleDialogContentProps {
  className?: string
  children: React.ReactNode
}

export function SimpleDialogContent({ className, children }: SimpleDialogContentProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
    </div>
  )
}

export function SimpleDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

export function SimpleDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

export function SimpleDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

export function SimpleDialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export function SimpleDialogClose({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="关闭"
      className={cn(
        "focus:ring-ring absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground enabled:hover:rotate-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}
