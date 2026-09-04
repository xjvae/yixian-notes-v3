// ══════════════════════════════════════════════════════════════
// 番茄钟 · 专注计时器
// 功能：工作/短休/长休三种模式、计时开始/暂停/重置、
//       今日完成番茄数统计、长轮结束后自动衔接、工作区持久化
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  Sunrise,
  Flame,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router-dom';
import { getStorageKey } from '@/hooks/useWorkspaceStorage';
import { loadJSON } from '@/hooks/useLocalStorage';

type Mode = 'focus' | 'short' | 'long';

const MODE_DEFAULTS: Record<Mode, { min: number; title: string; icon: typeof Flame }> = {
  focus: { min: 25, title: '专注', icon: Brain },
  short: { min: 5, title: '短休息', icon: Coffee },
  long: { min: 15, title: '长休息', icon: Sunrise },
};

export default function PomodoroPage() {
  const { activeWorkspaceId } = useOutletContext<{ activeWorkspaceId: string }>();
  const statsKey = getStorageKey('yixian_pomodoro_stats', activeWorkspaceId);

  const [mode, setMode] = useState<Mode>('focus');
  const [focusMin, setFocusMin] = useState(25);
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(15);

  const [secondsLeft, setSecondsLeft] = useState(MODE_DEFAULTS.focus.min * 60);
  const [running, setRunning] = useState(false);

  const [stats, setStats] = useState<{ today: number; total: number; date: string }>(() =>
    loadJSON<{ today: number; total: number; date: string }>(statsKey, {
      today: 0,
      total: 0,
      date: new Date().toDateString(),
    }),
  );

  // 持久化统计
  useEffect(() => {
    localStorage.setItem(statsKey, JSON.stringify(stats));
  }, [stats, statsKey]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modeSeconds = useCallback(
    () => (mode === 'focus' ? focusMin : mode === 'short' ? shortMin : longMin) * 60,
    [mode, focusMin, shortMin, longMin],
  );

  // 模式切换：重置到对应时长
  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setRunning(false);
      const isFocus = m === 'focus';
      setSecondsLeft((isFocus ? focusMin : m === 'short' ? shortMin : longMin) * 60);
    },
    [focusMin, shortMin, longMin],
  );

  const start = useCallback(() => {
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const resetCurrent = useCallback(() => {
    setRunning(false);
    setSecondsLeft(modeSeconds());
  }, [modeSeconds]);

  const stopAll = useCallback(() => {
    setRunning(false);
    switchMode(mode);
  }, [mode, switchMode]);

  // 统计今日
  const todayStr = new Date().toDateString();

  const completeFocus = useCallback(() => {
    // 累计番茄
    setStats((prev) => {
      const next = {
        today: (todayStr === prev.date ? prev.today : 0) + 1,
        total: prev.total + 1,
        date: todayStr,
      };
      return next;
    });
    // 配乐提示
    try {
      new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play();
    } catch {
      /* 忽略音频提示失败 */
    }
    toast.success('🎉 完成一个番茄钟！休息一下吧');
  }, [todayStr]);

  // 倒计时主循环
  useEffect(() => {
    if (!running) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          if (mode === 'focus') {
            completeFocus();
            // 进入短休息
            setRunning(false);
            setMode('short');
            setSecondsLeft(shortMin * 60);
          } else {
            setRunning(false);
            setMode('focus');
            setSecondsLeft(focusMin * 60);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, mode, focusMin, shortMin, completeFocus]);

  const total = modeSeconds();
  const progress = total === 0 ? 0 : 1 - secondsLeft / total;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  // 圆形进度
  const R = 170;
  const C = 2 * Math.PI * R;

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      {/* 页头 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Timer className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">番茄钟</h1>
          <p className="text-sm text-muted-foreground">专注 25 分钟，高效产出</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flame className="size-3.5 text-primary" /> 今日 {stats.today}
          </span>
          <span className="flex items-center gap-1">累计 {stats.total}</span>
        </div>
      </motion.div>

      {/* 主计时卡 */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center">
          {/* 模式切换 */}
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1 mb-6">
            {(['focus', 'short', 'long'] as Mode[]).map((m2) => (
              <button
                key={m2}
                type="button"
                onClick={() => switchMode(m2)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm transition-colors',
                  mode === m2 ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground',
                )}
              >
                {MODE_DEFAULTS[m2].title}
              </button>
            ))}
          </div>

          {/* 进度环 + 时间 */}
          <div className="relative size-56">
            <svg className="size-full -rotate-90" viewBox="0 0 400 400">
              <circle cx="200" cy="200" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
              <circle
                cx="200"
                cy="200"
                r={R}
                fill="none"
                stroke={mode === 'focus' ? 'hsl(var(--primary))' : 'hsl(152 76% 40%)'}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums tracking-tight">{display}</span>
              <span className="text-sm text-muted-foreground mt-2">{MODE_DEFAULTS[mode].title}</span>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-3 mt-6">
            {!running ? (
              <Button size="lg" className="rounded-full px-8 gap-2" onClick={start}>
                <Play className="size-4" /> 开始
              </Button>
            ) : (
              <Button size="lg" variant="secondary" className="rounded-full px-8 gap-2" onClick={pause}>
                <Pause className="size-4" /> 暂停
              </Button>
            )}
            <Button size="lg" variant="outline" className="rounded-full px-4" onClick={resetCurrent} aria-label="重置">
              <RotateCcw className="size-4" />
            </Button>
            <Button size="lg" variant="ghost" className="rounded-full px-4" onClick={stopAll} aria-label="停止并复位">
              <Flame className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 时长设置 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">专注时长</span>
            <span className="text-sm text-muted-foreground tabular-nums">{focusMin} 分钟</span>
          </div>
          <Slider value={[focusMin]} min={5} max={60} step={5} onValueChange={(v) => { setFocusMin(v[0]); if (mode === 'focus') setSecondsLeft(v[0] * 60); }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">短休息</span>
            <span className="text-sm text-muted-foreground tabular-nums">{shortMin} 分钟</span>
          </div>
          <Slider value={[shortMin]} min={1} max={15} step={1} onValueChange={(v) => { setShortMin(v[0]); if (mode === 'short') setSecondsLeft(v[0] * 60); }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">长休息</span>
            <span className="text-sm text-muted-foreground tabular-nums">{longMin} 分钟</span>
          </div>
          <Slider value={[longMin]} min={10} max={30} step={5} onValueChange={(v) => { setLongMin(v[0]); if (mode === 'long') setSecondsLeft(v[0] * 60); }} />
          {running && (
            <p className="text-xs text-muted-foreground">调整时长将重置本轮计时，请先暂停。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}