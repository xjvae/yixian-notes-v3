// ══════════════════════════════════════════════════════════════
// 四象限 · 时间管理 / 待办优先级划分
// 功能：紧急重要 / 重要不紧急 / 紧急不重要 / 不重要不紧急
//       每个象限任务增删改、勾选完成、跨象限移动、按工作区持久化
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Check,
  Edit3,
  Flame,
  TrendingUp,
  Coffee,
  MoveLeft,
  MoveRight,
  Inbox,
  Pin,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { genId } from '@/lib/id';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router-dom';
import { getStorageKey } from '@/hooks/useWorkspaceStorage';
import { loadJSON } from '@/hooks/useLocalStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';

interface QuadTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  done: boolean;
  createdAt: number;
}

const QUADRANT_META: Record<
  Quadrant,
  { title: string; desc: string; color: string; bg: string; icon: typeof Flame }
> = {
  q1: { title: '重要 · 紧急', desc: '必须优先处理', color: 'text-red-600', bg: 'bg-red-50', icon: Flame },
  q2: { title: '重要 · 不紧急', desc: '长期规划 / 提升', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: TrendingUp },
  q3: { title: '紧急 · 不重要', desc: '委托 / 快速处理', color: 'text-amber-600', bg: 'bg-amber-50', icon: Check },
  q4: { title: '不重要 · 不紧急', desc: '集中处理 / 放弃', color: 'text-slate-500', bg: 'bg-slate-100', icon: Coffee },
};

const QUADRANT_ORDER: Quadrant[] = ['q1', 'q2', 'q3', 'q4'];

export default function FourQuadrantPage() {
  const { activeWorkspaceId } = useOutletContext<{ activeWorkspaceId: string }>();
  const storageKey = getStorageKey('yixian_quadrant', activeWorkspaceId);

  const [tasks, setTasks] = useState<QuadTask[]>(() =>
    loadJSON<QuadTask[]>(storageKey, []),
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks, storageKey]);

  // 新增输入（按象限独立）
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
  });

  const addTask = useCallback(
    (quadrant: Quadrant) => {
      const title = drafts[quadrant].trim();
      if (!title) return;
      const task: QuadTask = {
        id: genId('qt', 5),
        title,
        quadrant,
        done: false,
        createdAt: Date.now(),
      };
      setTasks((prev) => [task, ...prev]);
      setDrafts((prev) => ({ ...prev, [quadrant]: '' }));
    },
    [drafts],
  );

  const toggleDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success('已删除');
  }, []);

  const moveTask = useCallback((id: string, to: Quadrant) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, quadrant: to } : t)),
    );
  }, []);

  const moveIndex = useCallback(
    (id: string, dir: -1 | 1) => {
      const cur = tasks.find((t) => t.id === id);
      if (!cur) return;
      const i = QUADRANT_ORDER.indexOf(cur.quadrant);
      const n = i + dir;
      if (n < 0 || n >= QUADRANT_ORDER.length) return;
      moveTask(id, QUADRANT_ORDER[n]);
    },
    [tasks, moveTask],
  );

  // 编辑
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startEdit = useCallback((t: QuadTask) => {
    setEditingId(t.id);
    setEditText(t.title);
  }, []);
  const saveEdit = useCallback(
    (id: string) => {
      const title = editText.trim();
      if (title) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
      setEditingId(null);
    },
    [editText],
  );

  const byQuadrant = useMemo(() => {
    const m: Record<Quadrant, QuadTask[]> = { q1: [], q2: [], q3: [], q4: [] };
    tasks.forEach((t) => m[t.quadrant]?.push(t));
    return m;
  }, [tasks]);

  // 统计
  const todayDone = tasks.filter((t) => t.done).length;
  const openCount = tasks.length - todayDone;

  // 钉到桌面：创建独立置顶窗口浏览/管理四象限
  const pinToDesktop = useCallback(async () => {
    try {
      await invoke('create_floating_quadrant', {
        workspaceId: activeWorkspaceId,
        x: 120,
        y: 90,
        w: 680,
        h: 540,
        alwaysOnTop: true,
      });
      toast.success('已钉到桌面');
    } catch (e) {
      toast.error('钉到桌面失败：' + (e as Error)?.message);
    }
  }, [activeWorkspaceId]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      {/* 页头 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Flame className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">四象限规划</h1>
            <p className="text-sm text-muted-foreground">
              按「重要 × 紧急」给任务排序，聚焦要事
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={pinToDesktop}>
            <Pin className="size-3.5 mr-1" />
            钉到桌面
          </Button>
          <Badge variant="outline" className="gap-1">
            <Inbox className="size-3" /> 未完成 {openCount}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-emerald-600">
            <Check className="size-3" /> 已完成 {todayDone}
          </Badge>
        </div>
      </motion.div>

      {/* 四象限网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANT_ORDER.map((q) => {
          const meta = QUADRANT_META[q];
          const Icon = meta.icon;
          const list = byQuadrant[q];
          return (
            <motion.div
              key={q}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * QUADRANT_ORDER.indexOf(q) }}
            >
              <Card className={cn('border-l-4', q === 'q1' && 'border-l-red-500', q === 'q2' && 'border-l-emerald-500', q === 'q3' && 'border-l-amber-500', q === 'q4' && 'border-l-slate-300')}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('size-8 rounded-lg flex items-center justify-center', meta.bg)}>
                      <Icon className={cn('size-4', meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">{meta.title}</CardTitle>
                      <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-2">
                  {/* 新增 */}
                  <div className="flex gap-2">
                    <Input
                      value={drafts[q]}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [q]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask(q);
                        if (e.key === 'Escape') setDrafts((prev) => ({ ...prev, [q]: '' }));
                      }}
                      placeholder="输入任务，回车添加"
                      className="h-8 text-sm"
                    />
                    <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={() => addTask(q)} aria-label="添加任务">
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  {/* 任务列表 */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    {list.length === 0 && (
                      <div className="text-xs text-muted-foreground/70 text-center py-4 border border-dashed rounded-lg">
                        暂无任务
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {list.map((t) => (
                        <motion.div
                          key={t.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5',
                            t.done && 'opacity-60',
                          )}
                        >
                          {/* 完成勾选 */}
                          <button
                            type="button"
                            onClick={() => toggleDone(t.id)}
                            className={cn(
                              'size-4 shrink-0 rounded-full border flex items-center justify-center transition-colors',
                              t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'hover:border-primary',
                            )}
                            aria-label="完成"
                          >
                            {t.done && <Check className="size-3" />}
                          </button>

                          {/* 标题（可编辑） */}
                          {editingId === t.id ? (
                            <Input
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(t.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => saveEdit(t.id)}
                              className="h-7 text-sm flex-1"
                            />
                          ) : (
                            <span className={cn('flex-1 text-sm truncate', t.done && 'line-through text-muted-foreground')}>
                              {t.title}
                            </span>
                          )}

                          {/* 操作 */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => moveIndex(t.id, -1)} className="p-1 rounded-md hover:bg-muted text-muted-foreground" title="移到前一象限" aria-label="移到前一象限">
                              <MoveLeft className="size-3.5" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="p-1 rounded-md hover:bg-muted text-muted-foreground" title="移动象限" aria-label="移动象限">
                                  <MoveRight className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {QUADRANT_ORDER.filter((k) => k !== t.quadrant).map((k) => (
                                  <DropdownMenuItem key={k} onClick={() => moveTask(t.id, k)}>
                                    移到「{QUADRANT_META[k].title}」
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <button type="button" onClick={() => startEdit(t)} className="p-1 rounded-md hover:bg-muted text-muted-foreground" title="编辑" aria-label="编辑">
                              <Edit3 className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => removeTask(t.id)} className="p-1 rounded-md hover:bg-destructive/10 text-destructive" title="删除" aria-label="删除">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}