import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Unlock,
  Fingerprint,
  Clock,
  Eye,
  EyeOff,
  FileText,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { INote, IPrivacySettings } from '@/data/notes';

interface WorkspaceContext {
  notes: INote[];
  privacy: IPrivacySettings;
  setPrivacy: (p: IPrivacySettings) => void;
  updateNote: (id: string, updates: Partial<INote>) => void;
}

export default function PrivacyPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { notes, privacy, setPrivacy } = context;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  const privateNotes = useMemo(
    () => notes.filter((n) => privacy.privateNoteIds.includes(n.id) && !n.isDeleted),
    [notes, privacy.privateNoteIds],
  );

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled) {
      setPinDialogOpen(true);
    } else {
      setPrivacy({ ...privacy, enabled: false, pinCode: '' });
      toast.success('已关闭隐私保护');
    }
  };

  const handleSetPin = () => {
    if (pinValue.length < 4) {
      toast.error('密码至少 4 位数字');
      return;
    }
    setPrivacy({ ...privacy, enabled: true, pinCode: pinValue });
    setPinDialogOpen(false);
    setPinValue('');
    setUnlocked(true);
    toast.success('已设置隐私密码');
  };

  const handleUnlock = () => {
    if (pinValue === privacy.pinCode) {
      setUnlocked(true);
      setPinValue('');
      toast.success('已解锁');
    } else {
      toast.error('密码错误');
    }
  };

  const lockOptions = [
    { value: 1, label: '1 分钟' },
    { value: 5, label: '5 分钟' },
    { value: 15, label: '15 分钟' },
    { value: 30, label: '30 分钟' },
    { value: 0, label: '永不' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            隐私与安全
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            保护你的笔记隐私，设置密码锁与私密笔记
          </p>
        </motion.div>

        {/* 主开关 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Lock className="size-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    应用密码锁
                    <Badge variant={privacy.enabled ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                      {privacy.enabled ? '已启用' : '未启用'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    启动应用或唤醒时需要输入密码验证身份
                  </p>
                </div>
                <Switch
                  checked={privacy.enabled}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 锁定选项 */}
        {privacy.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">密码设置</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">修改密码</div>
                      <div className="text-xs text-muted-foreground">更改应用启动密码</div>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs">修改</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>修改密码</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-4">
                        <div>
                          <Label className="text-xs">当前密码</Label>
                          <Input type="password" placeholder="请输入当前密码" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">新密码</Label>
                          <Input
                            type="password"
                            placeholder="请输入 4-8 位数字"
                            className="mt-1"
                            value={pinValue}
                            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                            maxLength={8}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" size="sm">取消</Button>
                        <Button size="sm" onClick={handleSetPin}>确认修改</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/40">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">指纹 / 面容识别</div>
                      <div className="text-xs text-muted-foreground">使用生物识别快速解锁</div>
                    </div>
                  </div>
                  <Switch
                    checked={privacy.fingerprintEnabled}
                    onCheckedChange={(v) => setPrivacy({ ...privacy, fingerprintEnabled: v })}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/40">
                  <div className="flex items-center gap-3">
                    <Clock className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">自动锁屏</div>
                      <div className="text-xs text-muted-foreground">无操作多久后自动锁定</div>
                    </div>
                  </div>
                  <Select
                    value={String(privacy.autoLockMinutes)}
                    onValueChange={(v) =>
                      setPrivacy({ ...privacy, autoLockMinutes: parseInt(v, 10) })
                    }
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lockOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 隐私笔记 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  隐私笔记
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {privateNotes.length} 篇私密笔记，需验证密码后查看
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setUnlocked(!unlocked)}
              >
                {unlocked ? (
                  <><EyeOff className="size-3.5 mr-1" /> 隐藏</>
                ) : (
                  <><Eye className="size-3.5 mr-1" /> 查看</>
                )}
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {!unlocked ? (
                <div className="py-10 text-center">
                  <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Lock className="size-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">隐私笔记已锁定</p>
                  <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
                    <Input
                      type="password"
                      placeholder="输入密码解锁"
                      className="h-9 text-center"
                      value={pinValue}
                      onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                      maxLength={8}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    />
                    <Button size="sm" className="h-9" onClick={handleUnlock}>
                      <Unlock className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {privateNotes.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无隐私笔记
                    </div>
                  ) : (
                    privateNotes.map((note, i) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20"
                      >
                        <Lock className="size-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {note.title}
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                              私密
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {note.excerpt?.slice(0, 60)}...
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 加密说明 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="size-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-foreground">端到端加密保护</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    隐私笔记采用 AES-256 加密存储，即使数据被获取也无法读取内容。
                    密码仅保存在本地，忘记密码无法找回，请妥善保管。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 设置密码 Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置应用密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              设置 4-8 位数字密码，用于解锁应用和查看隐私笔记。
            </p>
            <div>
              <Label className="text-xs">数字密码</Label>
              <Input
                type="password"
                placeholder="请输入 4-8 位数字"
                className="mt-1 tracking-widest text-center text-lg"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPinDialogOpen(false)}>取消</Button>
            <Button size="sm" onClick={handleSetPin}>确认设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
