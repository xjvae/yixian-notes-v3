import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Key,
  Shield,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type VaultItemType = 'note' | 'password' | 'secure-note' | 'card';

interface VaultItemFormProps {
  onSubmit: (name: string, itemType: VaultItemType, content: string) => Promise<boolean>;
  onCancel: () => void;
}

const itemTypeConfig = {
  'note': { label: '笔记', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  'password': { label: '密码', icon: Key, color: 'text-amber-500', bg: 'bg-amber-50' },
  'secure-note': { label: '安全笔记', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  'card': { label: '卡片', icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-50' },
} as const;

function generateStrongPassword(length: number = 20): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = lowercase + uppercase + numbers + symbols;

  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default function VaultItemForm({ onSubmit, onCancel }: VaultItemFormProps) {
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<VaultItemType>('note');
  const [content, setContent] = useState('');
  const [showSensitive, setShowSensitive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const handleGeneratePassword = useCallback(() => {
    const pwd = generateStrongPassword(20);
    setGeneratedPassword(pwd);
    setContent((prev) => {
      if (prev.includes('密码:') || prev.includes('Password:')) {
        return prev.replace(/(密码|Password):.*/, `$1: ${pwd}`);
      }
      return prev ? `${prev}\n密码: ${pwd}` : `密码: ${pwd}`;
    });
  }, []);

  const handleCopyGenerated = useCallback(() => {
    if (generatedPassword) {
      navigator.clipboard?.writeText(generatedPassword);
    }
  }, [generatedPassword]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    const success = await onSubmit(name.trim(), itemType, content);
    setIsSubmitting(false);
    if (!success) {
      onCancel();
    }
  }, [name, itemType, content, onSubmit, onCancel]);

  const selectedConfig = itemTypeConfig[itemType];
  const SelectedIcon = selectedConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className={cn('size-9 rounded-lg flex items-center justify-center', selectedConfig.bg)}>
              <SelectedIcon className={cn('size-4.5', selectedConfig.color)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">添加保险库项目</h3>
              <p className="text-xs text-muted-foreground">内容将使用 AES-GCM 加密存储</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vault-name" className="text-xs font-medium text-muted-foreground">
              名称
            </Label>
            <Input
              id="vault-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="项目名称..."
              className="h-9"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="vault-type" className="text-xs font-medium text-muted-foreground">
              类型
            </Label>
            <Select value={itemType} onValueChange={(v) => setItemType(v as VaultItemType)}>
              <SelectTrigger id="vault-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(itemTypeConfig) as VaultItemType[]).map((type) => {
                  const config = itemTypeConfig[type];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <Icon className={cn('size-3.5', config.color)} />
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="vault-content" className="text-xs font-medium text-muted-foreground">
                内容
              </Label>
              <div className="flex items-center gap-1">
                {(itemType === 'password' || itemType === 'card') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowSensitive(!showSensitive)}
                  >
                    {showSensitive ? <EyeOff className="size-3 mr-1" /> : <Eye className="size-3 mr-1" />}
                    {showSensitive ? '隐藏' : '显示'}
                  </Button>
                )}
                {itemType === 'password' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={handleGeneratePassword}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    生成密码
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="vault-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={itemType === 'password' ? '用户名: xxx\n密码: xxx\n备注: ...' : '输入内容...'}
              className={cn(
                'min-h-[120px] resize-none font-mono text-sm',
              )}
            />
            {generatedPassword && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-xs">
                <Key className="size-3 text-muted-foreground" />
                <code className="flex-1 font-mono">{generatedPassword}</code>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCopyGenerated}>
                  复制
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40 bg-muted/10">
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            <Check className="size-3.5 mr-1" />
            {isSubmitting ? '加密中...' : '保存'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
