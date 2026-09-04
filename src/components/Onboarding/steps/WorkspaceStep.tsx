import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  WORKSPACE_TEMPLATES,
  WORKSPACE_THEMES,
  type IWorkspace,
  type WorkspaceTemplateKey,
  type WorkspaceThemeKey,
} from '@/data/notes';
import type { NewWorkspaceData } from '../OnboardingWizard';

// ========== 工作区选择步骤 ==========
interface WorkspaceStepProps {
  workspaces: IWorkspace[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function WorkspaceStep({
  workspaces,
  selectedId,
  onSelect,
  onNew,
}: WorkspaceStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="px-6 py-5"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          选择一个工作区开始
        </h3>
        <p className="text-sm text-muted-foreground">
          工作区用于隔离不同场景的笔记，你可以随时切换或新建
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            onClick={() => onSelect(ws.id)}
            className={`relative text-left p-4 rounded-xl border-2 transition-all ${
              selectedId === ws.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-border hover:bg-accent/30'
            }`}
          >
            {selectedId === ws.id && (
              <div className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="size-3" />
              </div>
            )}
            <div
              className="size-10 rounded-lg flex items-center justify-center text-xl mb-2.5"
              style={{ backgroundColor: `${ws.color}20` }}
            >
              {ws.icon}
            </div>
            <div className="font-medium text-sm text-foreground mb-0.5">{ws.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-1 mb-2">
              {ws.description}
            </div>
            {ws.id === selectedId && (
              <span className="text-[10px] text-primary font-medium">当前使用</span>
            )}
          </button>
        ))}

        {/* 新建工作区卡片 */}
        <button
          type="button"
          onClick={onNew}
          className="relative text-left p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center min-h-[140px]"
        >
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2">
            <Plus className="size-5 text-muted-foreground" />
          </div>
          <div className="font-medium text-sm text-foreground">新建工作区</div>
          <div className="text-xs text-muted-foreground">从模板创建新工作区</div>
        </button>
      </div>
    </motion.div>
  );
}

// ========== 新建工作区对话框 ==========
interface NewWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: NewWorkspaceData) => void;
}

export function NewWorkspaceDialog({ open, onOpenChange, onConfirm }: NewWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [themeKey, setThemeKey] = useState<WorkspaceThemeKey>('bamboo');
  const [template, setTemplate] = useState<WorkspaceTemplateKey>('blank');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setThemeKey('bamboo');
      setTemplate('blank');
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (!name.trim()) {
      toast.warning('请输入工作区名称');
      return;
    }
    onConfirm({ name: name.trim(), description: description.trim(), themeKey, template });
  }, [name, description, themeKey, template, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建工作区</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的工作区"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">描述（可选）</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单描述这个工作区的用途"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">主题色</label>
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setThemeKey(t.key)}
                  className={`relative size-8 rounded-full transition-transform hover:scale-110 ${
                    themeKey === t.key ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: t.primary }}
                  title={t.name}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">模板</label>
            <Select value={template} onValueChange={(v) => setTemplate(v as WorkspaceTemplateKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!name.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
