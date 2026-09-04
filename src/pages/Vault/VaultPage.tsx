import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Plus,
  FileText,
  Key,
  Shield,
  CreditCard,
  Trash2,
  Eye,
  EyeOff,
  Search,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { useVault } from '@/hooks/useVault';
import type { VaultItem } from '@/store/useStore';
import VaultItemForm, { type VaultItemType } from '@/components/Vault/VaultItemForm';

const itemTypeConfig = {
  'note': { label: '笔记', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  'password': { label: '密码', icon: Key, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  'secure-note': { label: '安全笔记', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'card': { label: '卡片', icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
} as const;

const allTypes: Array<VaultItemType | 'all'> = ['all', 'note', 'password', 'secure-note', 'card'];

type FilterType = VaultItemType | 'all';

export default function VaultPage() {
  const {
    isUnlocked,
    isInitialized,
    vaultItems,
    validatePassword,
    addItem,
    removeItem,
    lockVault,
  } = useVault();

  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSetup, setIsSetup] = useState(!isInitialized);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    let items = [...vaultItems];
    if (activeFilter !== 'all') {
      items = items.filter((item) => item.itemType === activeFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [vaultItems, activeFilter, searchQuery]);

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: vaultItems.length };
    vaultItems.forEach((item: VaultItem) => {
      counts[item.itemType] = (counts[item.itemType] || 0) + 1;
    });
    return counts;
  }, [vaultItems]);

  const handleUnlock = async () => {
    if (!passwordInput.trim()) {
      toast.error('请输入密码');
      return;
    }
    if (isSetup) {
      if (passwordInput.length < 6) {
        toast.error('密码长度至少为 6 位');
        return;
      }
      if (passwordInput !== confirmPassword) {
        toast.error('两次输入的密码不一致');
        return;
      }
      await validatePassword(passwordInput);
    } else {
      await validatePassword(passwordInput);
    }
    setPasswordInput('');
    setConfirmPassword('');
    setIsSetup(false);
  };

  const handleAddItem = async (name: string, itemType: VaultItemType, content: string) => {
    const success = await addItem(name, itemType, content);
    if (success) {
      setShowForm(false);
    }
    return success;
  };

  const handleDeleteItem = (id: string, name: string) => {
    removeItem(id);
    setRevealedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success(`已删除「${name}」`);
  };

  const toggleReveal = (id: string) => {
    setRevealedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSetupMode = () => {
    setIsSetup(true);
    setPasswordInput('');
    setConfirmPassword('');
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-card/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              {isUnlocked ? (
                <Unlock className="size-5 text-primary" />
              ) : (
                <Lock className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold">保险库</h1>
              <p className="text-xs text-muted-foreground">
                {isUnlocked
                  ? `${vaultItems.length} 个已加密项目`
                  : isInitialized
                    ? '输入密码解锁保险库'
                    : '设置密码以初始化保险库'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="size-3.5 mr-1" />
                  添加项目
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={lockVault}
                >
                  <Lock className="size-3.5 mr-1" />
                  锁定
                </Button>
              </>
            )}
          {!isInitialized && !isSetup && (
            <Button variant="outline" size="sm" onClick={handleSetupMode}>
              初始化保险库
            </Button>
          )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {/* Lock Screen */}
            {!isUnlocked && (
              <motion.div
                key="lock-screen"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className="max-w-sm mx-auto mt-16"
              >
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="p-6 space-y-5">
                    <div className="text-center space-y-2">
                      <div className="size-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
                        <Lock className="size-8 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">
                        {isSetup ? '设置保险库密码' : '解锁保险库'}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {isSetup
                          ? '密码用于加密你的数据，请牢记'
                          : '输入密码以解密保险库内容'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={isSetup ? '设置密码（至少 6 位）' : '输入密码'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                          className="pr-10"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>

                      {isSetup && (
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="确认密码"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        />
                      )}
                    </div>

                    {isSetup && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          密码丢失将无法恢复已加密的数据，请妥善保管你的密码。
                        </p>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={handleUnlock}
                      disabled={!passwordInput.trim()}
                    >
                      {isSetup ? '创建保险库' : '解锁'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Unlocked Content */}
            {isUnlocked && !showForm && (
              <motion.div
                key="vault-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索保险库项目..."
                    className="pl-9 h-10"
                  />
                </div>

                {/* Type Tabs */}
                <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterType)}>
                  <TabsList className="h-9">
                    {allTypes.map((type) => {
                      const count = itemCounts[type] || 0;
                      const config = type !== 'all' ? itemTypeConfig[type] : null;
                      const Icon = config?.icon;
                      return (
                        <TabsTrigger key={type} value={type} className="text-xs h-7 gap-1.5">
                          {Icon && <Icon className="size-3" />}
                          <span>
                            {type === 'all' ? '全部' : config?.label}
                          </span>
                          <span className="ml-0.5 text-[10px] text-muted-foreground">({count})</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                {/* Items List */}
                {filteredItems.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-16 text-center">
                      <div className="size-16 mx-auto rounded-xl bg-muted/50 flex items-center justify-center mb-4">
                        <Shield className="size-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">暂无保险库项目</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        点击右上角"添加项目"开始创建
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredItems.map((item) => {
                      const config = itemTypeConfig[item.itemType as VaultItemType] || itemTypeConfig['note'];
                      const Icon = config.icon;
                      const isRevealed = revealedItems.has(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className={cn(
                            'border-border/50 hover:border-primary/20 transition-colors group',
                            isRevealed && 'border-primary/30 bg-primary/[0.02]'
                          )}>
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className={cn('size-10 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                                <Icon className={cn('size-5', config.color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', config.bg, config.color)}>
                                    {config.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {format(new Date(item.updatedAt), 'M月d日 HH:mm', { locale: zhCN })}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {isRevealed ? '已显示' : '已加密'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => toggleReveal(item.id)}
                                  title={isRevealed ? '隐藏内容' : '显示内容'}
                                >
                                  {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:text-destructive"
                                  onClick={() => handleDeleteItem(item.id, item.name)}
                                  title="删除"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Add Form */}
            {isUnlocked && showForm && (
              <motion.div
                key="add-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <VaultItemForm
                  onSubmit={handleAddItem}
                  onCancel={() => setShowForm(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
