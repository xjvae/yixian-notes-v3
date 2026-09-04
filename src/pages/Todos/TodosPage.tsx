import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Plus,
  Flag,
  Calendar as CalendarIcon,
  Trash2,
  Check,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { format, isBefore, startOfDay, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ITodo } from '@/data/notes';

interface WorkspaceContext {
  todos: ITodo[];
  todoCreate: (todo: Partial<ITodo>) => void;
  todoUpdate: (id: string, updates: Partial<ITodo>) => void;
  todoToggle: (id: string) => void;
  todoDelete: (id: string) => void;
}

type FilterType = 'all' | 'today' | 'upcoming' | 'completed';

const priorityConfig = {
  high: { label: '高优先级', color: 'bg-red-500', textColor: 'text-red-600', bg: 'bg-red-50' },
  medium: { label: '中优先级', color: 'bg-amber-500', textColor: 'text-amber-600', bg: 'bg-amber-50' },
  low: { label: '低优先级', color: 'bg-blue-500', textColor: 'text-blue-600', bg: 'bg-blue-50' },
};

export default function TodosPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { todos, todoCreate, todoToggle, todoDelete } = context;
  const [filter, setFilter] = useState<FilterType>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const today = todos.filter(
      (t) => t.status === 'pending' && t.dueDate && isToday(new Date(t.dueDate)),
    ).length;
    const overdue = todos.filter(
      (t) => t.status === 'pending' && t.dueDate && isBefore(new Date(t.dueDate), startOfDay(new Date())),
    ).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, today, overdue, rate };
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const today = new Date();
    let list = [...todos];
    if (filter === 'today') {
      list = list.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
    } else if (filter === 'upcoming') {
      list = list.filter(
        (t) =>
          t.status === 'pending' &&
          t.dueDate &&
          !isBefore(new Date(t.dueDate), startOfDay(today)),
      );
    } else if (filter === 'completed') {
      list = list.filter((t) => t.status === 'completed');
    }
    // 排序：未完成优先 → 高优先级 → 截止日期近
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      const order = { high: 0, medium: 1, low: 2 };
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [todos, filter]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    todoCreate({ title: newTitle.trim(), priority: newPriority });
    setNewTitle('');
    toast.success('已添加任务');
  };

  const filters: { key: FilterType; label: string; icon: typeof Filter; count: number }[] = [
    { key: 'all', label: '全部', icon: CheckSquare, count: stats.total },
    { key: 'today', label: '今日', icon: Clock, count: stats.today },
    { key: 'upcoming', label: '即将到期', icon: CalendarIcon, count: 0 },
    { key: 'completed', label: '已完成', icon: Check, count: stats.completed },
  ];

  // 环形进度
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (stats.rate / 100) * circumference;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* 页头 + 统计 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="sm:col-span-2">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="size-5 text-primary" />
              待办清单
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理你的任务，专注每一件重要的事
            </p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="relative size-16 shrink-0">
                <svg className="size-16 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" strokeWidth="6" className="stroke-muted" fill="none" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    strokeWidth="6"
                    className="stroke-primary transition-all duration-700 ease-out"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{stats.rate}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">完成率</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {stats.completed} / {stats.total} 已完成
                </div>
                {stats.overdue > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
                    <AlertTriangle className="size-3" />
                    {stats.overdue} 项逾期
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 新建任务 */}
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onSubmit={handleAdd}
          className="flex gap-2"
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="添加新任务... 按回车确认"
            className="h-10"
          />
          <Select value={newPriority} onValueChange={(v) => setNewPriority(v as any)}>
            <SelectTrigger className="w-24 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">高优先</SelectItem>
              <SelectItem value="medium">中优先</SelectItem>
              <SelectItem value="low">低优先</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="h-10">
            <Plus className="size-4 mr-1" /> 添加
          </Button>
        </motion.form>

        {/* 筛选 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-2 flex-wrap"
        >
          {filters.map((f) => {
            const Icon = f.icon;
            const active = filter === f.key;
            const count = f.key === 'all'
              ? f.count
              : f.key === 'today'
                ? f.count
                : f.key === 'completed'
                  ? f.count
                  : 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <Icon className="size-3.5" />
                {f.label}
                <Badge
                  variant={active ? 'secondary' : 'outline'}
                  className="text-[10px] h-4 px-1.5 ml-0.5"
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </motion.div>

        {/* 任务列表 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-2"
        >
          {filteredTodos.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <CheckSquare className="size-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">暂无任务</p>
              </CardContent>
            </Card>
          ) : (
            filteredTodos.map((todo, i) => {
              const p = priorityConfig[todo.priority];
              const isOverdue =
                todo.status === 'pending' &&
                todo.dueDate &&
                isBefore(new Date(todo.dueDate), startOfDay(new Date()));
              return (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.02 }}
                >
                  <Card
                    className={cn(
                      'border-border/50 hover:border-primary/30 transition-colors',
                      todo.status === 'completed' && 'opacity-60',
                    )}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <button
                        onClick={() => todoToggle(todo.id)}
                        className={cn(
                          'size-5 shrink-0 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                          todo.status === 'completed'
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/30 hover:border-primary',
                        )}
                      >
                        {todo.status === 'completed' && <Check className="size-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'text-sm font-medium',
                            todo.status === 'completed' && 'line-through text-muted-foreground',
                          )}
                        >
                          {todo.title}
                        </div>
                        {todo.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {todo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                            <Flag className={cn('size-3 mr-1', p.textColor)} />
                            {p.label}
                          </Badge>
                          {todo.dueDate && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-4 px-1.5 font-normal',
                                isOverdue && 'text-red-500 border-red-200 bg-red-50',
                              )}
                            >
                              <CalendarIcon className="size-3 mr-1" />
                              {format(new Date(todo.dueDate), 'M月d日', { locale: zhCN })}
                              {isOverdue && ' · 已逾期'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          todoDelete(todo.id);
                          toast.success('已删除任务');
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </div>
  );
}
