import { useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sun,
  Sparkles,
  BookOpen,
  PenTool,
  CheckSquare,
  Clock,
  Shuffle,
  Zap,
  Flame,
  Plus,
  X,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { stripHtmlToText } from '@/lib/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { INote, IFlashThought, ITodo } from '@/data/notes';
import type { IFloatingNote } from '@/data/floating-notes';

interface WorkspaceContext {
  notes: INote[];
  todos: ITodo[];
  stickyNotes: IFloatingNote[];
  flashThoughts: IFlashThought[];
  addFlashThought: (f: IFlashThought) => void;
  updateFlashThought: (id: string, updates: Partial<IFlashThought>) => void;
  dailyRecord: {
    date: string;
    noteCount: number;
    wordCount: number;
    todoCompleted: number;
    streakDays: number;
  };
}

export default function DailyReviewPage() {
  const context = useOutletContext<WorkspaceContext>();
  const {
    notes,
    todos,
    stickyNotes,
    flashThoughts,
    addFlashThought,
    updateFlashThought,
  } = context;
  const navigate = useNavigate();
  const [showThoughtInput, setShowThoughtInput] = useState(false);
  const [thoughtContent, setThoughtContent] = useState('');
  const [randomNote, setRandomNote] = useState<INote | null>(null);

  const todayNotes = useMemo(
    () =>
      notes.filter(
        (n) =>
          !n.isDeleted &&
          new Date(n.createdAt).toDateString() === new Date().toDateString(),
      ),
    [notes],
  );

  const todayTodos = useMemo(
    () =>
      todos.filter(
        (t) => new Date(t.updatedAt).toDateString() === new Date().toDateString(),
      ),
    [todos],
  );

  const todayStickies = useMemo(
    () =>
      stickyNotes.filter(
        (s) => new Date(s.createdAt).toDateString() === new Date().toDateString(),
      ),
    [stickyNotes],
  );

  const pendingThoughts = useMemo(
    () => flashThoughts.filter((f) => f.status === 'pending'),
    [flashThoughts],
  );

  // ===== 真实每日聚合（不再依赖注入的 dailyRecord） =====
  const todayWordCount = useMemo(
    () =>
      todayNotes.reduce(
        (sum, n) => sum + (n.content ? n.content.replace(/<[^>]*>/g, '').length : 0),
        0,
      ),
    [todayNotes],
  );
  const todoCompletedToday = useMemo(
    () =>
      todos.filter(
        (t) =>
          t.status === 'completed' &&
          new Date(t.updatedAt).toDateString() === new Date().toDateString(),
      ).length,
    [todos],
  );
  // 连续写作天数：从今天往前连续有（未删除）笔记的日期数
  const streakDays = useMemo(() => {
    const seen = new Set(
      notes
        .filter((n) => !n.isDeleted)
        .map((n) => format(n.updatedAt ?? n.createdAt ?? Date.now(), 'yyyy-MM-dd')),
    );
    let s = 0;
    for (let i = 0; i < 365; i++) {
      if (seen.has(format(subDays(new Date(), i), 'yyyy-MM-dd'))) s++;
      else break;
    }
    return s;
  }, [notes]);

  // ===== 回顾设置（真实可保存，localStorage 持久化） =====
  const SETTINGS_KEY = 'yixian_daily_review_settings';
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').enabled ?? true;
    } catch {
      return true;
    }
  });
  const [reminderTime, setReminderTime] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').time ?? '21:00';
    } catch {
      return '21:00';
    }
  });
  const persistReviewSettings = (enabled: boolean, time: string) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled, time }));
    toast.success('回顾设置已保存');
  };

  const handleRandomReview = () => {
    const oldNotes = notes.filter((n) => !n.isDeleted);
    if (oldNotes.length === 0) {
      toast.message('暂时没有可回顾的笔记');
      return;
    }
    const random = oldNotes[Math.floor(Math.random() * oldNotes.length)];
    setRandomNote(random);
  };

  const handleSaveThought = () => {
    if (!thoughtContent.trim()) return;
    addFlashThought({
      id: `ft-${Date.now()}`,
      content: thoughtContent.trim(),
      status: 'pending',
      createdAt: Date.now(),
    });
    setThoughtContent('');
    setShowThoughtInput(false);
    toast.success('闪念已保存');
  };

  const handleOrganize = (id: string) => {
    updateFlashThought(id, { status: 'organized' });
    toast.success('已标记为已整理');
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* 头部 - 问候 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-6 text-primary-foreground"
        >
          <div className="absolute -right-6 -top-6 size-32 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="absolute -right-10 bottom-0 size-24 rounded-full bg-primary-foreground/10 blur-xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="size-5" />
              <span className="text-sm opacity-90">
                {format(new Date(), 'yyyy年 M月 d日 EEEE', { locale: zhCN })}
              </span>
            </div>
            <h1 className="text-2xl font-bold">你好，今日回顾</h1>
            <p className="text-sm opacity-80 mt-1">
              记录今日创作，唤醒过往记忆
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { label: '笔记', value: todayNotes.length, icon: FileText },
                { label: '字数', value: todayWordCount, icon: PenTool },
                { label: '待办完成', value: todoCompletedToday, icon: CheckSquare },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
                     className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3"
                  >
                    <Icon className="size-4 mb-1 opacity-80" />
                    <div className="text-xl font-bold tabular-nums leading-none">{s.value}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{s.label}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* 连续打卡 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-border/50 bg-gradient-to-r from-amber-50/50 to-transparent">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Flame className="size-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">连续写作 {streakDays} 天</span>
                  <Badge className="text-[10px] h-4 px-1.5 bg-amber-500 border-0">坚持</Badge>
                </div>
                <Progress value={(streakDays % 30) / 30 * 100} className="h-1.5 mt-2" />
                <p className="text-xs text-muted-foreground mt-1.5">
                  距离下一个里程碑还差 {30 - (streakDays % 30)} 天
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 闪念胶囊入口 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {!showThoughtInput ? (
            <button
              onClick={() => setShowThoughtInput(true)}
              className="w-full p-4 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-3 text-left"
            >
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">闪念胶囊</div>
                <p className="text-xs text-muted-foreground">
                  快速记录灵感，稍后整理（快捷键 Ctrl+Shift+N）
                </p>
              </div>
              <Plus className="size-5 text-muted-foreground" />
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="size-4 text-primary" />
                <span className="text-sm font-medium">记录闪念</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 ml-auto"
                  onClick={() => setShowThoughtInput(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <Textarea
                value={thoughtContent}
                onChange={(e) => setThoughtContent(e.target.value)}
                placeholder="想到什么就写什么..."
                className="text-sm resize-none h-20 bg-background/60"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSaveThought();
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-muted-foreground">
                  Cmd+Enter 快速保存
                </span>
                <Button size="sm" className="h-7" onClick={handleSaveThought}>
                  保存
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* 今日创作 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                今日创作
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {todayNotes.length === 0 && todayTodos.length === 0 && todayStickies.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  今天还没有创作记录，开始你的第一篇笔记吧
                </div>
              ) : (
                <>
                  {todayNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => navigate(`/note/${n.id}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <FileText className="size-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{stripHtmlToText(n.content).length} 字</div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                  {todayTodos.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <CheckSquare
                        className={cn(
                          'size-4 shrink-0',
                          t.status === 'completed' ? 'text-green-500' : 'text-amber-500',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'text-sm truncate',
                            t.status === 'completed' && 'line-through text-muted-foreground',
                          )}
                        >
                          {t.title}
                        </div>
                        <div className="text-xs text-muted-foreground">待办事项</div>
                      </div>
                      <Badge
                        variant={t.status === 'completed' ? 'default' : 'outline'}
                        className="text-[10px] h-4 px-1.5 font-normal shrink-0"
                      >
                        {t.status === 'completed' ? '已完成' : '进行中'}
                      </Badge>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 随机回顾 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shuffle className="size-4 text-primary" />
                随机回顾
              </CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRandomReview}>
                换一条
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {randomNote ? (
                <div className="p-4 bg-muted/30 rounded-lg cursor-pointer" onClick={() => navigate(`/note/${randomNote.id}`)}>
                  <div className="text-sm font-semibold mb-2">{randomNote.title}</div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {randomNote.excerpt}
                  </p>
                  <div className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {formatDistanceToNow(new Date(randomNote.updatedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">点击「换一条」唤醒尘封的记忆</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 待整理闪念 */}
        {pendingThoughts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="border-border/50">
              <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  待整理闪念
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                    {pendingThoughts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {pendingThoughts.slice(0, 5).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/30 border border-amber-100"
                  >
                    <div className="size-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{f.content}</p>
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatDistanceToNow(new Date(f.createdAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-primary"
                      onClick={() => handleOrganize(f.id)}
                    >
                      标记整理
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 回顾设置 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">回顾设置</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-sm font-medium">每日回顾提醒</div>
                  <div className="text-xs text-muted-foreground">每天固定时间推送回顾</div>
                </div>
                <Switch
                  checked={reminderEnabled}
                  onCheckedChange={(v) => {
                    setReminderEnabled(v);
                    persistReviewSettings(v, reminderTime);
                  }}
                />
              </div>
              <div className="flex items-center justify-between py-1 border-t border-border/40">
                <div>
                  <div className="text-sm font-medium">提醒时间</div>
                  <div className="text-xs text-muted-foreground">每天 {reminderTime} 推送</div>
                </div>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => {
                    setReminderTime(e.target.value);
                    persistReviewSettings(reminderEnabled, e.target.value);
                  }}
                  className="w-28 h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
