import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  LayoutGrid,
  ListTodo,
  CalendarDays,
  Bell,
  Sunrise,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, subMonths, addMonths, startOfWeek, endOfWeek, isSameDay, getISOWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { INote } from '@/data/notes';

interface WorkspaceContext {
  notes: INote[];
  newNote: (opts?: { notebookId?: string; date?: number }) => INote;
  setActiveFilter: (filter: string) => void;
}

type ViewMode = 'month' | 'week' | 'agenda';

export default function CalendarPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { notes, newNote, setActiveFilter } = context;
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const activeNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);

  const notesByDate = useMemo(() => {
    const map = new Map<string, INote[]>();
    activeNotes.forEach((note) => {
      const d = new Date(note.createdAt);
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    });
    return map;
  }, [activeNotes]);

  const getNotesForDate = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    return notesByDate.get(key) ?? [];
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: new Date(start.getTime() + 6 * 86400000) });
  }, [currentDate]);

  const selectedNotes = useMemo(() => getNotesForDate(selectedDate), [selectedDate, notesByDate]);

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
  };
  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleNewNote = () => {
    const note = newNote({ date: selectedDate.setHours(9, 0, 0, 0) });
    navigate(`/note/${note.id}`);
    setActiveFilter('all');
    toast.success('已创建新笔记');
  };

  const handleNoteClick = (noteId: string) => {
    navigate(`/note/${noteId}`);
    setActiveFilter('all');
  };

  const weekDayNames = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              日历视图
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              按时间浏览你的笔记，每天记录一目了然
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border/60 bg-background p-0.5">
              {[
                { key: 'month', label: '月', icon: LayoutGrid },
                { key: 'week', label: '周', icon: CalendarDays },
                { key: 'agenda', label: '日程', icon: ListTodo },
              ].map((item) => {
                const Icon = item.icon;
                const active = viewMode === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setViewMode(item.key as ViewMode)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* 今日中心快捷入口：执行域已收敛到「今日」，从此处直达 待办/提醒/习惯/回顾 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: '待办', icon: ListTodo, path: '/todos', desc: `` },
            { label: '提醒', icon: Bell, path: '/reminders', desc: '' },
            { label: '每日回顾', icon: Sunrise, path: '/daily-review', desc: '' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent transition-colors"
              >
                <Icon className="size-4 shrink-0 text-primary" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* 月历 / 周历 */}
        {viewMode !== 'agenda' && (
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="size-8" onClick={handlePrev}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleToday}>
                    今天
                  </Button>
                  <Button variant="outline" size="icon" className="size-8" onClick={handleNext}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg font-semibold">
                  {viewMode === 'month'
                    ? format(currentDate, 'yyyy 年 M 月', { locale: zhCN })
                    : `${format(currentDate, 'yyyy 年 M 月')} 第 ${getISOWeek(currentDate)} 周`}
                </CardTitle>
                <Button size="sm" className="h-8" onClick={handleNewNote}>
                  <Plus className="size-3.5 mr-1" />
                  新建笔记
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {/* 星期表头 */}
                <div className="grid grid-cols-7 border-b border-border/40">
                  {weekDayNames.map((day, i) => (
                    <div
                      key={day}
                      className={cn(
                        'text-center py-2 text-xs font-medium',
                        i >= 5 ? 'text-red-400' : 'text-muted-foreground',
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                {/* 日期格子 */}
                <div className="grid grid-cols-7">
                  {(viewMode === 'month' ? monthDays : weekDays).map((day, idx) => {
                    const dayNotes = getNotesForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isSel = isSameDay(day, selectedDate);
                    const isTdy = isToday(day);
                    return (
                      <button
                        key={day.toISOString() + idx}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'border-r border-b border-border/30 p-2 text-left min-h-[96px] sm:min-h-[110px] transition-colors',
                          (idx + 1) % 7 === 0 && 'border-r-0',
                          viewMode === 'month' && !isCurrentMonth && 'bg-muted/30 text-muted-foreground/50',
                          isSel && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                          !isSel && isCurrentMonth && 'hover:bg-accent/50',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'text-xs font-medium size-6 flex items-center justify-center rounded-full',
                              isTdy && 'bg-primary text-primary-foreground',
                              !isTdy && isSel && 'text-primary',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {dayNotes.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                              {dayNotes.length}
                            </Badge>
                          )}
                        </div>
                        {viewMode !== 'week' && dayNotes.length > 0 && (
                          <div className="space-y-1">
                            {dayNotes.slice(0, 3).map((n) => (
                              <div
                                key={n.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNoteClick(n.id);
                                }}
                                className="text-[11px] text-muted-foreground truncate bg-accent/60 rounded px-1.5 py-0.5 hover:bg-primary/15 hover:text-primary transition-colors"
                              >
                                {n.title}
                              </div>
                            ))}
                            {dayNotes.length > 3 && (
                              <div className="text-[10px] text-muted-foreground pl-1">
                                +{dayNotes.length - 3} 更多
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 日程视图 */}
        {viewMode === 'agenda' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {[...activeNotes]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 20)
              .reduce((groups: { date: Date; items: INote[] }[], note) => {
                const d = new Date(note.createdAt);
                d.setHours(0, 0, 0, 0);
                const last = groups[groups.length - 1];
                if (last && isSameDay(last.date, d)) {
                  last.items.push(note);
                } else {
                  groups.push({ date: d, items: [note] });
                }
                return groups;
              }, [])
              .map((group, gi) => (
                <motion.div
                  key={group.date.toISOString()}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: gi * 0.03 }}
                >
                  <Card className="border-border/50">
                    <CardHeader className="py-3 px-5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CalendarDays className="size-4 text-primary" />
                        {format(group.date, 'yyyy 年 M 月 d 日 EEEE', { locale: zhCN })}
                        <Badge variant="secondary" className="ml-auto text-xs font-normal">
                          {group.items.length} 篇笔记
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-2 pt-0">
                      {group.items.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => handleNoteClick(note.id)}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/60 transition-colors group"
                        >
                          <FileText className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{note.title}</div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {note.excerpt}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            {format(new Date(note.createdAt), 'HH:mm')}
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </motion.div>
        )}

        {/* 选中日期笔记列表 */}
        {viewMode !== 'agenda' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="border-border/50">
              <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  {format(selectedDate, 'M 月 d 日')} 的笔记
                  <Badge variant="secondary" className="ml-1 text-xs font-normal">
                    {selectedNotes.length} 篇
                  </Badge>
                </CardTitle>
                <Button size="sm" variant="outline" className="h-8" onClick={handleNewNote}>
                  <Plus className="size-3.5 mr-1" />
                  当日新建
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedNotes.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Calendar className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">当天还没有笔记</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={handleNewNote}>
                      创建第一篇笔记
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {selectedNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleNoteClick(note.id)}
                        className="w-full text-left flex items-start gap-3 py-3 px-1 hover:bg-accent/40 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{note.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {note.excerpt}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(note.createdAt), 'HH:mm')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
