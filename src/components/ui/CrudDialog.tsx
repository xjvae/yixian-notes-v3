import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 标题，如「编辑卡片」/「新建卡片」，直接传入完整标题即可 */
  title: string;
  /** 保存回调（含校验与 toast 逻辑由调用方负责） */
  onSave: () => void;
  /** 弹窗主体（表单域） */
  children?: ReactNode;
  /** 透传给 DialogContent 的样式类（如 max-w-2xl） */
  className?: string;
  saveLabel?: string;
  cancelLabel?: string;
  saveLoading?: boolean;
}

/**
 * 通用「列表页 新增/编辑」弹窗骨架，消除各 CRUD 页面重复的
 * Dialog open/onOpenChange + Header/Footer（取消/保存）样板。
 */
export function CrudDialog({
  open,
  onOpenChange,
  title,
  onSave,
  children,
  className,
  saveLabel = '保存',
  cancelLabel = '取消',
  saveLoading = false,
}: CrudDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button onClick={onSave} disabled={saveLoading}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}