import { useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { EChartsOption } from 'echarts';
import LazyECharts from '@/components/Chart/LazyECharts';
import { MiniBarChart, MiniLineChart, MiniDonutChart, StudyHeatmap } from '@/components/Chart/MiniCharts';
import {
  FileText,
  StickyNote,
  CheckSquare,
  Tags,
  TrendingUp,
  CalendarRange,
  Award,
  BarChart3,
  Flame,
  Smile,
  Clock,
  Target,
  BookOpen,
  RefreshCcw,
  Activity,
  Zap,
  BookMarked,
  PieChart,
  Search,
  FilePlus2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CHART_PRIMARY, CHART_SECONDARY } from '@/lib/chart-colors';
import { format, subDays } from 'date-fns';
import { stripHtmlToText } from '@/lib/text';
import { buildWeeklyWorkflowReport } from '@/lib/ai';

interface WorkspaceContext {
  notes: any[];
  stickyNotes: any[];
  todos: any[];
  tags: any[];
  flashcards?: any[];
  notebooks?: any[];
  activeWorkspace?: { id: string; name: string; color: string; icon: string };
  activeWorkspacePersonality?: any;
  // Dashboard 动作化：把统计页变成可执行入口（阶段2）
  newNote?: (opts?: { notebookId?: string }) => unknown;
  todoCreate?: (t: { title: string; description?: string; priority?: string }) => unknown;
}

// 统计辅助：统计纯文本字数（去掉 HTML 标签与 Markdown 记号）
function countTextWords(input?: string): number {
  if (!input) return 0;
  const text = stripHtmlToText(input, { replace: ' ' })
    .replace(/[#*_`>|\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

// 连续记录天数：统计最近（含今天）连续有笔记创建/更新的天数
function calcNoteStreak(notes: any[]): number {
  const seen = new Set(
    notes.map((n) => format(n.updatedAt ?? n.createdAt ?? Date.now(), 'yyyy-MM-dd')),
  );
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (seen.has(ds)) streak++;
    else break;
  }
  return streak;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
  delay = 0,
}: {
  icon: typeof FileText;
  label: string;
  value: number | string;
  delta: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <Card className="border-border/50 hover:shadow-sm transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div
              className="size-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="size-5" style={{ color }} />
            </div>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
              {delta}
            </Badge>
          </div>
          <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const context = useOutletContext<WorkspaceContext>();
  const {
    notes,
    stickyNotes,
    todos,
    tags,
    flashcards = [],
    notebooks = [],
    activeWorkspace,
    newNote,
    todoCreate,
  } = context;
  const navigate = useNavigate();
  const [range, setRange] = useState('30');

  const wsColor = activeWorkspace?.color ?? CHART_PRIMARY;
  const wsIcon = activeWorkspace?.icon ?? '📊';
  const wsId = activeWorkspace?.id ?? '';
  const isPersonal = wsId === 'ws1';
  const isWork = wsId === 'ws2';
  const isStudy = wsId === 'ws3';

  const activeNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);
  // 继续工作（阶段2）：最近编辑的笔记，作为「回到工作现场」入口
  const recentNotes = useMemo(
    () =>
      [...activeNotes]
        .sort((a: any, b: any) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
        .slice(0, 6),
    [activeNotes],
  );
  const completedTodos = useMemo(
    () => todos.filter((t) => t.status === 'completed').length,
    [todos],
  );
  const completionRate = todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0;

  // ===== 真实时间窗统计（用于 KPI 卡片，不再使用假值） =====
  const stats = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTs = weekStart.getTime();
    const prevStartTs = weekStartTs - 7 * 86_400_000;

    const weekNewNotes = activeNotes.filter((n) => n.createdAt >= weekStartTs).length;
    const prevWeekNewNotes = activeNotes.filter(
      (n) => n.createdAt >= prevStartTs && n.createdAt < weekStartTs,
    ).length;
    const weekStickies = stickyNotes.filter((s: any) => s.createdAt >= weekStartTs).length;
     const prevWeekStickies = stickyNotes.filter(
       (s: any) => s.createdAt >= prevStartTs && s.createdAt < weekStartTs,
     ).length;

    const weekTodosDone = todos.filter(
      (t: any) => t.status === 'completed' && (t.updatedAt ?? 0) >= weekStartTs,
    ).length;
    const weekReviews = flashcards.filter(
      (f: any) => f.lastReviewedAt && f.lastReviewedAt >= weekStartTs,
    ).length;

    const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    return {
      weekStartTs,
      streak: calcNoteStreak(activeNotes),
      weekNewNotes,
      notesDelta: weekNewNotes - prevWeekNewNotes,
      weekNotesLabel: `${signed(weekNewNotes - prevWeekNewNotes)} 本周`,
      weekTodosDone,
       weekReviews,
       stickyDeltaLabel: `${signed(weekStickies - prevWeekStickies)} 本周`,
     };
  }, [activeNotes, stickyNotes, todos, flashcards]);

  // ===== AI 工作流周报（阶段4·回填，离线聚合） =====
  const workflow = useMemo(() => {
    const tagNameOf = (id: string) => tags.find((t: any) => t.id === id)?.name ?? id;
    return buildWeeklyWorkflowReport({
      notes: activeNotes as any[],
      todos: (todos as any[]).map((t) => ({
        completed: t.status === 'completed',
        status: t.status,
        updatedAt: t.updatedAt,
      })),
      flashcards: (flashcards as any[]).map((f) => ({ lastReviewedAt: f.lastReviewedAt })),
      tags: tags as any[],
      tagNameOf,
    });
  }, [activeNotes, todos, flashcards, tags]);

  // ===== 通用趋势数据 =====
  const trendData = useMemo(() => {
    const days = parseInt(range, 10);
    const dates: string[] = [];
    const counts: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      dates.push(format(d, 'MM-dd'));
      const dayStart = d.setHours(0, 0, 0, 0);
      const dayEnd = d.setHours(23, 59, 59, 999);
      const count = activeNotes.filter(
        (n) => n.createdAt >= dayStart && n.createdAt <= dayEnd,
      ).length;
      counts.push(count);
    }
    return { dates, counts };
  }, [activeNotes, range]);

  const lineOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.dates,
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'line',
        data: trendData.counts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: wsColor, width: 2.5 },
        itemStyle: { color: wsColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: wsColor + '40' },
              { offset: 1, color: wsColor + '05' },
            ],
          },
        },
      },
    ],
  };

  // 笔记本分布
  const notebookData = useMemo(() => {
    return notebooks.map((nb: any) => ({
      name: nb.name,
      value: activeNotes.filter((n) => n.notebookId === nb.id).length,
      color: nb.color || wsColor,
    }));
  }, [activeNotes, notebooks, wsColor]);

  const pieOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => `${params.name}: ${params.value} 篇`,
    },
    legend: { type: 'scroll', bottom: 0, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: false } },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        data: notebookData.map((d: any) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  };

  // 标签 TOP10
  const topTags = useMemo(() => {
    const tagCounts = tags.map((t: any) => ({
      name: t.name,
      value: activeNotes.filter((n) => n.tags.includes(t.id)).length,
      color: t.color,
    }));
    return tagCounts.sort((a: any, b: any) => b.value - a.value).slice(0, 8);
  }, [tags, activeNotes]);

  const barOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'category',
      data: topTags.map((t: any) => t.name),
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: topTags.map((t: any) => ({
          value: t.value,
          itemStyle: { color: t.color, borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: 16,
        label: { show: true, position: 'right', fontSize: 11 },
      },
    ],
  };

  // 近 4 周活跃热力图（真实按日笔记数，横轴周一~周日，纵轴第1~4周）
  const heatmapData = useMemo(() => {
    const data: [number, number, number][] = [];
    for (let week = 0; week < 4; week++) {
      for (let day = 0; day < 7; day++) {
        // 纵轴第1周为最近一周；day=0 映射到周一
        const offset = week;
        const date = subDays(new Date(), offset * 7 + (6 - day));
        const ds = format(date, 'yyyy-MM-dd');
        const count = activeNotes.filter(
          (n) => format(n.createdAt, 'yyyy-MM-dd') === ds,
        ).length;
        data.push([day, week, count]);
      }
    }
    return data;
  }, [activeNotes]);

  const heatmapOption: EChartsOption = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => `活跃度: ${params.value[2]}`,
    },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '5%' },
    xAxis: {
      type: 'category',
      data: ['一', '二', '三', '四', '五', '六', '日'],
      splitArea: { show: true },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: ['第1周', '第2周', '第3周', '第4周'],
      splitArea: { show: true },
      axisLabel: { fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, ...heatmapData.map((d) => d[2])),
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: [wsColor + '15', wsColor + '60', wsColor] },
      textStyle: { fontSize: 11 },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        itemStyle: { borderRadius: 3 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' } },
      },
    ],
  };

  // 字数 TOP6（真实按内容去 HTML 后统计字数）
  const topByWords = useMemo(() => {
    return [...activeNotes]
      .map((n) => ({
        title: n.title,
        words: countTextWords(n.content ?? n.excerpt ?? ''),
      }))
      .filter((n) => n.words > 0)
      .sort((a, b) => b.words - a.words)
      .slice(0, 6);
  }, [activeNotes]);

  // ===== 工作区专属数据计算 =====
  // ws1: 7天心情趋势
  const moodTrendData = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = format(d, 'yyyy-MM-dd');
      const count = activeNotes.filter((n) => format(n.updatedAt, 'yyyy-MM-dd') === ds).length;
      data.push(count);
    }
    return data;
  }, [activeNotes]);

  // ws1: 热词
  const hotWords = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    activeNotes.forEach((n: any) => {
      n.tags.forEach((tid: string) => {
        const t = tags.find((tag: any) => tag.id === tid);
        if (t) tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [activeNotes, tags]);

  // ===== 今日聚焦（基于现有数据，零依赖新增字段） =====
  const todayStats = useMemo(() => {
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const t1 = t0.getTime() + 86400000;
    const todayNotes = activeNotes.filter(
      (n) => (n.createdAt ?? 0) >= t0.getTime() && (n.createdAt ?? 0) < t1,
    ).length;
    const todayDone = todos.filter(
      (t: any) => t.status === 'completed' && (t.updatedAt ?? 0) >= t0.getTime() && (t.updatedAt ?? 0) < t1,
    ).length;
    const openTodos = todos.filter((t: any) => t.status === 'pending').length;
    return {
      todayNotes,
      todayDone,
      openTodos,
    };
  }, [activeNotes, todos]);

  // ws2: 工作量
  const workloadData = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = format(d, 'yyyy-MM-dd');
      const count = todos.filter(
        (t: any) => t.status === 'completed' && format(t.updatedAt, 'yyyy-MM-dd') === ds,
      ).length;
      data.push(count);
    }
    return data;
  }, [todos]);

  // ws2: 效率
  const efficiencyData = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekTodos = todos.filter((t: any) => t.createdAt >= weekStart.getTime());
    const done = weekTodos.filter((t: any) => t.status === 'completed').length;
    const pending = weekTodos.filter((t: any) => t.status === 'pending').length;
    return [
      { value: done, color: wsColor },
      { value: pending || 1, color: 'hsl(210 8% 88%)' },
    ];
  }, [todos, wsColor]);

  // ws2: 项目进度
  const projectProgress = useMemo(() => {
    if (notebooks.length === 0) return [{ name: '默认笔记本', progress: 100, color: wsColor }];
    const total = activeNotes.length || 1;
    return notebooks
      .filter((nb: any) => !nb.archived)
      .slice(0, 4)
      .map((nb: any) => {
        const count = activeNotes.filter((n) => n.notebookId === nb.id).length;
        return {
          name: nb.name,
          progress: Math.max(5, Math.round((count / total) * 100)),
          color: nb.color || wsColor,
        };
      });
  }, [notebooks, activeNotes, wsColor]);

  // ws2: 今日待办
  const todayTodos = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = todayStart.getTime() + 86400000;
    return todos
      .filter((t: any) => {
        if (t.status === 'completed' && t.updatedAt >= todayStart.getTime() && t.updatedAt < todayEnd)
          return true;
        if (t.dueDate && t.dueDate >= todayStart.getTime() && t.dueDate < todayEnd) return true;
        return false;
      })
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        done: t.status === 'completed',
        time: t.dueDate ? format(t.dueDate, 'HH:mm') : '今日',
      }));
  }, [todos]);

  // ws3: 学习热力图
  const studyHeatmapData = useMemo(() => {
    const data: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = format(d, 'yyyy-MM-dd');
      const reviews = flashcards.filter(
        (f: any) => f.lastReviewedAt && format(f.lastReviewedAt, 'yyyy-MM-dd') === ds,
      ).length;
      data.push(reviews);
    }
    return data;
  }, [flashcards]);

  // ws3: 知识掌握度
  const masteryData = useMemo(() => {
    const learning = flashcards.filter((f: any) => f.status === 'learning').length;
    const review = flashcards.filter((f: any) => f.status === 'review').length;
    const mastered = flashcards.filter((f: any) => f.status === 'mastered').length;
    return [
      { value: learning, color: '#f59e0b' },
      { value: review, color: wsColor },
      { value: mastered, color: '#22c55e' },
    ];
  }, [flashcards, wsColor]);

  // ws3: 复习提醒
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const reviewItems = useMemo(() => {
    return flashcards
      .filter((f: any) => f.dueDate <= todayStr)
      .slice(0, 5)
      .map((f: any) => {
        let level: '重要' | '待复习' | '已掌握';
        if (f.status === 'mastered') level = '已掌握';
        else if (f.status === 'learning') level = '重要';
        else level = '待复习';
        return { id: f.id, title: f.front, due: f.dueDate === todayStr ? '今日复习' : '待复习', level, done: f.status === 'mastered' };
      });
  }, [flashcards, todayStr]);

  // ws3: 复习完成度
  const reviewPercent = useMemo(() => {
    const mastered = flashcards.filter((f: any) => f.status === 'mastered').length;
    return flashcards.length > 0 ? Math.round((mastered / flashcards.length) * 100) : 0;
  }, [flashcards]);

  // ===== 视觉差异化配置 =====
  const visual = useMemo(() => {
    if (isPersonal)
      return {
        pageTitle: '我的个人空间',
        pageSubtitle: '记录生活，感受每一天的点滴',
        cardRadius: 'rounded-2xl',
        cardShadow: 'shadow-sm',
        accentBg: `${wsColor}10`,
      };
    if (isWork)
      return {
        pageTitle: '工作项目概览',
        pageSubtitle: '效率驱动，掌控项目进度',
        cardRadius: 'rounded-lg',
        cardShadow: 'shadow-none',
        accentBg: `${wsColor}08`,
      };
    return {
      pageTitle: '学习成长统计',
      pageSubtitle: '持续积累，见证知识的力量',
      cardRadius: 'rounded-xl',
      cardShadow: 'shadow-sm',
      accentBg: `${wsColor}10`,
    };
  }, [isPersonal, isWork, wsColor]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* 页头 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              className="size-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${wsColor}15` }}
            >
              {wsIcon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="size-5" style={{ color: wsColor }} />
                {visual.pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{visual.pageSubtitle}</p>
            </div>
          </div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="90">近 90 天</SelectItem>
              <SelectItem value="365">全部</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* ===== 快捷操作条（Dashboard 动作化，阶段2） ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <button
            onClick={() => { newNote?.({}); navigate('/notes'); }}
            className="group rounded-xl border border-border/50 bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <FileText className="size-4 text-primary" />
            </div>
            <div className="text-sm font-medium">新建笔记</div>
            <div className="text-xs text-muted-foreground mt-0.5">快速记录想法</div>
          </button>
          <button
            onClick={() => { todoCreate?.({ title: '', description: '', priority: 'medium' }); navigate('/todos'); }}
            className="group rounded-xl border border-border/50 bg-card text-left hover:border-primary/40 hover:shadow-sm transition-all p-0"
          >
            <div className="p-3">
              <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                <CheckSquare className="size-4 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">新建待办</div>
              <div className="text-xs text-muted-foreground mt-0.5">把待办列入清单</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/flash')}
            className="group rounded-xl border border-border/50 bg-card text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
              <Zap className="size-4 text-violet-500" />
            </div>
            <div className="text-sm font-medium">记录闪念</div>
            <div className="text-xs text-muted-foreground mt-0.5">随手记一个灵感</div>
          </button>
          <button
            onClick={() => navigate('/search')}
            className="group rounded-xl border border-border/50 bg-card text-left hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="p-3">
              <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                <Search className="size-4 text-amber-600" />
              </div>
              <div className="text-sm font-medium">全局搜索</div>
              <div className="text-xs text-muted-foreground mt-0.5">跨对象 / 全文检索</div>
            </div>
          </button>
        </motion.div>

        {/* ===== 今日聚焦（今日概览聚合卡） ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.11 }}
        >
          <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 overflow-hidden`} style={{ background: `linear-gradient(120deg, ${wsColor}0D 0%, transparent 60%)` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarRange className="size-4" style={{ color: wsColor }} />
                今日聚焦
              </CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(), 'M月d日 EEEE')} · 当天产出与进行中事项
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* 今日新建笔记 */}
                <button type="button" onClick={() => navigate('/notes')} className="rounded-xl border border-border/50 bg-card/80 p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all">
                  <div className={cn('size-8 rounded-lg flex items-center justify-center mb-2', `${wsColor}14`)}>
                    <FileText className="size-4" style={{ color: wsColor }} />
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{todayStats.todayNotes}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">今日新建笔记</div>
                </button>
                <button type="button" onClick={() => navigate('/todos')} className="rounded-xl border border-border/50 bg-card/80 p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all">
                  <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                    <CheckSquare className="size-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{todayStats.todayDone}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">今日完成待办</div>
                </button>
                <button type="button" onClick={() => navigate('/todos')} className="rounded-xl border border-border/50 bg-card/80 p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all">
                  <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                    <Target className="size-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{todayStats.openTodos}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">待处理待办</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ===== 继续工作（最近编辑，阶段2·工作入口） ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                继续工作
              </CardTitle>
              <CardDescription className="text-xs">最近编辑过的笔记，点击回到上次现场</CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {recentNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">还没有笔记</div>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { newNote?.({}); navigate('/notes'); }}>
                    <FilePlus2 className="size-3.5 mr-1" />
                    新建第一条笔记
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {recentNotes.map((n: any) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => navigate('/notes')}
                      className="group rounded-lg border border-border/50 p-2.5 text-left hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {n.title || '无标题'}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        编辑于 {format(n.updatedAt ?? n.createdAt ?? Date.now(), 'MM-dd HH:mm')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ===== 工作区专属 KPI 卡片 ===== */}
        {isPersonal && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={FileText} label="笔记总数" value={activeNotes.length} delta={stats.weekNotesLabel} color={wsColor} delay={0.05} />
            <KpiCard icon={Flame} label="连续记录" value={stats.streak} delta="天" color="#ef4444" delay={0.1} />
            <KpiCard icon={Smile} label="本周新增" value={stats.weekNewNotes} delta="篇" color="#f59e0b" delay={0.15} />
            <KpiCard icon={Tags} label="标签总数" value={tags.length} delta="全部活跃" color="#8B5CF6" delay={0.2} />
          </div>
        )}

        {isWork && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={CheckSquare} label="待办完成" value={completedTodos} delta={`${completionRate}% 完成率`} color={wsColor} delay={0.05} />
            <KpiCard icon={Clock} label="本周完成" value={stats.weekTodosDone} delta="项任务" color="#3B82F6" delay={0.1} />
            <KpiCard icon={Target} label="活跃项目" value={notebooks.filter((nb: any) => !nb.archived).length} delta="进行中" color="#22c55e" delay={0.15} />
            <KpiCard icon={CalendarRange} label="会议记录" value={activeNotes.filter((n: any) => n.title.includes('会议') || n.title.includes('周会')).length} delta="本周" color="#8B5CF6" delay={0.2} />
          </div>
        )}

        {isStudy && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={BookOpen} label="本周复习" value={stats.weekReviews} delta="次" color={wsColor} delay={0.05} />
            <KpiCard icon={BookMarked} label="已读书籍" value={new Set(flashcards.map((f: any) => f.deck)).size} delta="本" color="#3B82F6" delay={0.1} />
            <KpiCard icon={FileText} label="笔记数量" value={activeNotes.length} delta={stats.weekNotesLabel} color="#22c55e" delay={0.15} />
            <KpiCard icon={RefreshCcw} label="复习完成" value={`${reviewPercent}%`} delta="掌握度" color="#f59e0b" delay={0.2} />
          </div>
        )}

        {!isPersonal && !isWork && !isStudy && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={FileText} label="笔记总数" value={activeNotes.length} delta={stats.weekNotesLabel} color={wsColor} delay={0.05} />
            <KpiCard icon={StickyNote} label="便签总数" value={stickyNotes.length} delta={stats.stickyDeltaLabel} color="#F59E0B" delay={0.1} />
            <KpiCard icon={CheckSquare} label="待办总数" value={todos.length} delta={`${completionRate}% 完成`} color="#3B82F6" delay={0.15} />
            <KpiCard icon={Tags} label="标签总数" value={tags.length} delta="全部活跃" color="#8B5CF6" delay={0.2} />
          </div>
        )}

        {/* ===== 通用图表区 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="lg:col-span-2"
          >
            <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4" style={{ color: wsColor }} />
                  笔记创建趋势
                </CardTitle>
                <CardDescription className="text-xs">近 {range} 天每日新增笔记数量</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <LazyECharts option={lineOption} theme="ud" className="h-[280px]" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarRange className="size-4" style={{ color: wsColor }} />
                  笔记本分布
                </CardTitle>
                <CardDescription className="text-xs">各笔记本笔记占比</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <LazyECharts option={pieOption} theme="ud" className="h-[280px]" />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ===== 工作区专属模块区 ===== */}
        {isPersonal && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="size-4" style={{ color: wsColor }} />
                      近7天心情趋势
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4">
                      <MiniLineChart data={moodTrendData} color={wsColor} />
                      <div className="text-xs text-muted-foreground space-y-1 shrink-0">
                        <div>最高 {Math.max(...moodTrendData)} 篇</div>
                        <div>平均 {((moodTrendData.reduce((a, b) => a + b, 0) / moodTrendData.length) || 0).toFixed(1)} 篇/天</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tags className="size-4" style={{ color: wsColor }} />
                      本周热词
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {hotWords.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-6 text-center">暂无标签数据</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {hotWords.map((w, i) => (
                          <Badge key={w.name} variant="secondary" className="text-xs font-normal" style={{ fontSize: `${0.75 + (hotWords.length - i) * 0.04}rem`, opacity: 0.5 + (hotWords.length - i) * 0.06 }}>
                            {w.name}
                            <span className="ml-1 text-muted-foreground">{w.count}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}

        {isWork && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="size-4" style={{ color: wsColor }} />
                      本周工作量
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4">
                      <MiniBarChart data={workloadData} color={wsColor} />
                      <div className="text-xs text-muted-foreground space-y-1 shrink-0">
                        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d, i) => (
                          <div key={d} className="flex items-center gap-1.5">
                            <div className="size-2 rounded-sm" style={{ backgroundColor: wsColor, opacity: 0.3 + (workloadData[i] / (Math.max(...workloadData, 1))) * 0.7 }} />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="size-4" style={{ color: wsColor }} />
                      本周效率
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-6">
                      <MiniDonutChart segments={efficiencyData} size={80} />
                      <div className="flex-1 space-y-2">
                        {[
                          { label: '已完成', value: efficiencyData[0].value, color: efficiencyData[0].color },
                          { label: '待处理', value: efficiencyData[1].value, color: efficiencyData[1].color },
                        ].map((seg) => (
                          <div key={seg.label} className="flex items-center gap-2 text-sm">
                            <div className="size-3 rounded-sm" style={{ backgroundColor: seg.color }} />
                            <span className="text-muted-foreground">{seg.label}</span>
                            <span className="font-medium ml-auto">{seg.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="size-4" style={{ color: wsColor }} />
                      项目进度概览
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {projectProgress.map((item: any) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{item.name}</span>
                          <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: item.color }}>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckSquare className="size-4" style={{ color: wsColor }} />
                      今日待办
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {todayTodos.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-6 text-center">今日暂无待办</div>
                    ) : (
                      todayTodos.map((item: any) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate('/todos')}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left"
                        >
                          <div className={`size-4 rounded-full border-2 shrink-0 flex items-center justify-center ${item.done ? 'bg-primary border-primary' : 'border-border'}`}>
                            {item.done && <CheckSquare className="size-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${item.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.time}</div>
                          </div>
                        </button>
                      ))
                    )}
                    {todayTodos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate('/todos')}
                        className="w-full text-xs text-muted-foreground hover:text-foreground text-left px-2.5 py-1 transition-colors"
                      >
                        查看全部待办 →
                      </button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}

        {isStudy && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="size-4" style={{ color: wsColor }} />
                      近30天学习热力图
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <StudyHeatmap data={studyHeatmapData} color={wsColor} />
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>少</span>
                      <div className="flex gap-1">
                        {[0.15, 0.4, 0.65, 0.9, 1].map((op, i) => (
                          <div key={i} className="size-3 rounded-sm" style={{ backgroundColor: wsColor, opacity: op }} />
                        ))}
                      </div>
                      <span>多</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieChart className="size-4" style={{ color: wsColor }} />
                      知识掌握度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-6">
                      <MiniDonutChart segments={masteryData} size={80} />
                      <div className="flex-1 space-y-2">
                        {[
                          { label: '学习中', value: masteryData[0].value, color: masteryData[0].color },
                          { label: '待复习', value: masteryData[1].value, color: masteryData[1].color },
                          { label: '已掌握', value: masteryData[2].value, color: masteryData[2].color },
                        ].map((seg) => (
                          <div key={seg.label} className="flex items-center gap-2 text-sm">
                            <div className="size-3 rounded-sm" style={{ backgroundColor: seg.color }} />
                            <span className="text-muted-foreground">{seg.label}</span>
                            <span className="font-medium ml-auto">{seg.value} 张</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCcw className="size-4" style={{ color: wsColor }} />
                      今日复习提醒
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {reviewItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-6 text-center">今日无复习任务</div>
                    ) : (
                      reviewItems.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors">
                          <div className={`size-4 rounded-full border-2 shrink-0 flex items-center justify-center ${item.level === '已掌握' ? 'bg-primary border-primary' : 'border-border'}`}>
                            {item.level === '已掌握' && <CheckSquare className="size-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${item.level === '已掌握' ? 'text-muted-foreground line-through' : 'font-medium'}`}>{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.due}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal shrink-0">{item.level}</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}>
                <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 overflow-hidden`} style={{ background: `linear-gradient(135deg, ${wsColor}08 0%, transparent 60%)` }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="size-4" style={{ color: wsColor }} />
                      复习完成度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-6">
                      <div className="relative size-24 shrink-0">
                        <svg className="size-full" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(210 8% 88%)" strokeWidth="8" />
                          <circle cx="50" cy="50" r="42" fill="none" stroke={wsColor} strokeWidth="8" strokeDasharray={`${reviewPercent * 2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold tabular-nums">{reviewPercent}%</div>
                          <div className="text-[10px] text-muted-foreground">完成率</div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">总卡片数</span>
                          <span className="font-medium">{flashcards.length} 张</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">待复习</span>
                          <span className="font-medium" style={{ color: wsColor }}>{reviewItems.length} 张</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">已掌握</span>
                          <span className="font-medium">{flashcards.filter((f: any) => f.status === 'mastered').length} 张</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}

        {/* ===== 通用图表区（标签排行 + 热力图） ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: isPersonal || isWork || isStudy ? 0.55 : 0.35 }}
            className="lg:col-span-2"
          >
            <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="size-4" style={{ color: wsColor }} />
                  标签使用频次 TOP 8
                </CardTitle>
                <CardDescription className="text-xs">最常使用的标签排行</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <LazyECharts option={barOption} theme="ud" className="h-[300px]" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: isPersonal || isWork || isStudy ? 0.6 : 0.4 }}
          >
            <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50 h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4" style={{ color: wsColor }} />
                  活跃度热力图
                </CardTitle>
                <CardDescription className="text-xs">近 4 周写作强度</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <LazyECharts option={heatmapOption} theme="ud" className="h-[300px]" />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* 字数排行榜 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: isPersonal || isWork || isStudy ? 0.65 : 0.45 }}
        >
          <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" style={{ color: wsColor }} />
                笔记字数排行榜 TOP 6
              </CardTitle>
              <CardDescription className="text-xs">内容最丰富的笔记</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topByWords.map((item, i) => (
                  <div key={item.title} className="flex items-center gap-3">
                    <div
                      className={cn(
                        'size-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold',
                        i === 0
                          ? 'bg-amber-100 text-amber-600'
                          : i === 1
                            ? 'bg-secondary text-secondary-foreground'
                            : i === 2
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.words / topByWords[0].words) * 100}%`,
                            backgroundColor: i < 3 ? wsColor : CHART_SECONDARY,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right">
                      {item.words.toLocaleString()} 字
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI 工作流周报（阶段4·回填） */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className={`${visual.cardRadius} ${visual.cardShadow} border-border/50`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4" style={{ color: wsColor }} />
                本周工作流报告
                <Badge variant="outline" className="ml-1 text-[10px]">AI 聚合</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(workflow.builtAt), 'yyyy-MM-dd')} · 基于最近真实数据生成，可在设置中接入 AI Key 获取更完整叙述
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{workflow.summary}</p>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-muted/30 py-3">
                  <div className="text-xl font-bold" style={{ color: wsColor }}>{workflow.weekNewNotes}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">新增笔记</div>
                </div>
                <div className="rounded-lg bg-muted/30 py-3">
                  <div className="text-xl font-bold text-emerald-600">{workflow.weekTodosDone}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">完成待办</div>
                </div>
                <div className="rounded-lg bg-muted/30 py-3">
                  <div className="text-xl font-bold text-indigo-600">{workflow.weekReviews}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">复习闪卡</div>
                </div>
                <div className="rounded-lg bg-muted/30 py-3">
                  <div className="text-xl font-bold text-amber-600">{workflow.streak}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">连续记录</div>
                </div>
              </div>

              {workflow.hotTags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {workflow.hotTags.map((t) => (
                    <Badge key={t.name} variant="secondary" className="text-xs">
                      #{t.name} · {t.count}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                {workflow.suggestions.map((s, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Target className="size-3.5 mt-0.5 shrink-0" style={{ color: wsColor }} />
                    <span>{s}</span>
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
