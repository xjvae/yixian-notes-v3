/**
 * ConfirmDialog 组件
 * 用于替换原生 confirm() 对话框，提供更好的用户体验
 * 支持 Promise 式调用
 * 
 * 注意：使用 SimpleDialog 而非 @radix-ui/react-dialog，因为后者在 Tauri WebView 中会导致白屏
 */
import { useState, useCallback, createContext, useContext, useEffect } from 'react'
import {
  SimpleDialog,
  SimpleDialogContent,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogDescription,
  SimpleDialogFooter,
} from './simple-dialog'
import { Button } from './button'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmDialogState {
  open: boolean
  options: ConfirmDialogOptions
  resolve: ((value: boolean) => void) | null
}

const ConfirmDialogContext = createContext<{
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
} | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider')
  }
  return context
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    options: { title: '' },
    resolve: null,
  })
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true)
    }
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    if (state.resolve) {
      state.resolve(false)
    }
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [state.resolve])

  // 将 confirmDialog() 全局调用桥接到自定义弹窗，替代原生 confirm()
  useEffect(() => {
    setGlobalConfirm(confirm)
    return () => setGlobalConfirm(null)
  }, [confirm])

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {mounted && (
        <SimpleDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
          <SimpleDialogContent className="sm:max-w-md">
            <SimpleDialogHeader>
              <SimpleDialogTitle>{state.options.title}</SimpleDialogTitle>
              {state.options.description && (
                <SimpleDialogDescription>{state.options.description}</SimpleDialogDescription>
              )}
            </SimpleDialogHeader>
            <SimpleDialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCancel}>
                {state.options.cancelText || '取消'}
              </Button>
              <Button
                variant={state.options.danger ? 'destructive' : 'default'}
                onClick={handleConfirm}
              >
                {state.options.confirmText || '确定'}
              </Button>
            </SimpleDialogFooter>
          </SimpleDialogContent>
        </SimpleDialog>
      )}
    </ConfirmDialogContext.Provider>
  )
}

// 全局 confirm 函数（用于非 React 组件场景）
let globalConfirm: ((options: ConfirmDialogOptions) => Promise<boolean>) | null = null

export function setGlobalConfirm(fn: ((options: ConfirmDialogOptions) => Promise<boolean>) | null) {
  globalConfirm = fn
}

export async function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (globalConfirm) {
    return globalConfirm(options)
  }
  // 降级为原生 confirm
  return confirm(options.description ? `${options.title}\n\n${options.description}` : options.title)
}
