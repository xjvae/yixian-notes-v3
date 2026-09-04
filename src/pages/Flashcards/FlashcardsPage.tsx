import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  RotateCcw,
  Flame,
  Trophy,
  Calendar,
  ChevronLeft,
  Brain,
  Plus,
  Trash2,
  Edit3,
  BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CrudDialog } from '@/components/ui/CrudDialog';
import { toast } from 'sonner';
import type { IFlashcard } from '@/data/notes';
import EmptyState from '@/components/EmptyState';

interface WorkspaceContext {
  flashcards: IFlashcard[];
  addFlashcard: (card: Omit<IFlashcard, 'id' | 'createdAt' | 'ease' | 'interval' | 'repetitions' | 'dueDate' | 'lastReviewedAt' | 'status'>) => void;
  updateFlashcard: (id: string, updates: Partial<IFlashcard>) => void;
  deleteFlashcard: (id: string) => void;
  reviewCard: (id: string, quality: number) => void;
}

export default function FlashcardsPage() {
  const context = useOutletContext<WorkspaceContext>();
  const { flashcards, addFlashcard, updateFlashcard, deleteFlashcard, reviewCard } = context;

  const [mode, setMode] = useState<'browse' | 'study'>('browse');
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCard, setEditingCard] = useState<IFlashcard | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [deck, setDeck] = useState('all');
  const [tagFilter] = useState('');

  const decks = useMemo(() => {
    const set = new Set<string>();
    flashcards.forEach((c) => set.add(c.deck));
    return Array.from(set);
  }, [flashcards]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    let result = flashcards.filter((c) => new Date(c.dueDate).getTime() <= now);
    if (deck !== 'all') result = result.filter((c) => c.deck === deck);
    if (tagFilter) result = result.filter((c) => c.tags.includes(tagFilter));
    return result;
  }, [flashcards, deck, tagFilter]);

  const allCards = useMemo(() => {
    let result = flashcards;
    if (deck !== 'all') result = result.filter((c) => c.deck === deck);
    if (tagFilter) result = result.filter((c) => c.tags.includes(tagFilter));
    return result;
  }, [flashcards, deck, tagFilter]);

  const masteredCount = useMemo(
    () => flashcards.filter((c) => c.status === 'mastered').length,
    [flashcards],
  );

  const startStudy = () => {
    if (dueCards.length === 0) {
      toast.info('今日暂无待复习卡片');
      return;
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setMode('study');
  };

  const handleReview = (quality: number) => {
    const card = dueCards[currentIndex];
    if (!card) return;
    reviewCard(card.id, quality);
    setIsFlipped(false);
    if (currentIndex < dueCards.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 200);
    } else {
      toast.success('🎉 今日复习完成！');
      setMode('browse');
    }
  };

  const handleSave = () => {
    if (!front.trim() || !back.trim()) {
      toast.error('请填写正反面内容');
      return;
    }
    if (editingCard) {
      updateFlashcard(editingCard.id, { front, back });
      toast.success('已更新卡片');
    } else {
      addFlashcard({
        front,
        back,
        deck: deck === 'all' ? '默认卡组' : deck,
        tags: tagFilter ? [tagFilter] : [],
      });
      toast.success('已创建卡片');
    }
    setShowEditor(false);
    setEditingCard(null);
    setFront('');
    setBack('');
  };

  const openEditor = (card?: IFlashcard) => {
    if (card) {
      setEditingCard(card);
      setFront(card.front);
      setBack(card.back);
    } else {
      setEditingCard(null);
      setFront('');
      setBack('');
    }
    setShowEditor(true);
  };

  const currentCard = dueCards[currentIndex];

  if (mode === 'study') {
    return (
      <div className="h-full -mx-4 -my-6 flex flex-col items-center justify-center bg-gradient-to-b from-background via-muted/20 to-background p-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setMode('browse')}>
              <ChevronLeft className="size-4 mr-1" />
              返回
            </Button>
            <div className="text-sm text-muted-foreground">
              {currentIndex + 1} / {dueCards.length}
            </div>
            <div className="w-16" />
          </div>

          <Progress value={((currentIndex + 1) / dueCards.length) * 100} className="mb-8" />

          <div className="h-80 perspective-1000">
            <AnimatePresence mode="wait">
              <motion.div
                key={isFlipped ? 'back' : 'front'}
                initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="h-full"
              >
                <Card className="h-full cursor-pointer shadow-lg hover:shadow-xl transition-shadow" onClick={() => setIsFlipped(!isFlipped)}>
                  <CardContent className="h-full p-8 flex flex-col">
                    <Badge variant="outline" className="w-fit mb-3 text-[10px] h-5">
                      {isFlipped ? '答案' : '问题'}
                    </Badge>
                    <div className="flex-1 flex items-center justify-center text-center">
                      <p className="text-xl font-medium leading-relaxed">
                        {isFlipped ? currentCard?.back : currentCard?.front}
                      </p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                      点击卡片{isFlipped ? '返回问题' : '查看答案'}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8"
            >
              <p className="text-center text-sm text-muted-foreground mb-3">你记得多少？</p>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-12"
                  onClick={() => handleReview(0)}
                >
                  <RotateCcw className="size-4 mr-1" />
                  再来一次
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => handleReview(2)}
                >
                  困难
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => handleReview(3)}
                >
                  良好
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-12"
                  onClick={() => handleReview(5)}
                >
                  简单
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">学习卡片</h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于间隔重复算法，科学记忆更高效
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startStudy}>
            <Brain className="size-4 mr-1.5" />
            开始复习
          </Button>
          <Button variant="secondary" onClick={() => openEditor()}>
            <Plus className="size-4 mr-1.5" />
            新建卡片
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{flashcards.length}</div>
                <div className="text-xs text-muted-foreground">总卡片数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{dueCards.length}</div>
                <div className="text-xs text-muted-foreground">今日待复习</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Trophy className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{masteredCount}</div>
                <div className="text-xs text-muted-foreground">已掌握</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center">
                <Flame className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">7</div>
                <div className="text-xs text-muted-foreground">连续天数</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">全部卡片</TabsTrigger>
            <TabsTrigger value="due">待复习</TabsTrigger>
            <TabsTrigger value="mastered">已掌握</TabsTrigger>
            <TabsTrigger value="stats">学习统计</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={deck} onValueChange={setDeck}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部卡组</SelectItem>
                {decks.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="all" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {allCards.map((card, i) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.2 }}
                      className="px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 mb-1.5">
                            {card.deck}
                          </Badge>
                          <div className="text-sm font-medium line-clamp-1">{card.front}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {card.back}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {card.tags.map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                                #{t}
                              </Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              复习 {card.repetitions} 次
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEditor(card)}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => { deleteFlashcard(card.id); toast.success('已删除'); }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="due" className="pt-4">
          {dueCards.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {dueCards.map((card, i) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium line-clamp-1">{card.front}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {card.deck} · 下次复习：到期
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-0">待复习</Badge>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <EmptyState type="todos" extra={<p className="text-sm mt-1">明天继续保持</p>} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="mastered" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {flashcards
              .filter((c) => c.status === 'mastered')
              .map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="p-4">
                      <Badge className="bg-emerald-500 mb-2 text-[10px] h-4 px-1">已掌握</Badge>
                      <div className="text-sm font-medium line-clamp-1">{card.front}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.back}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="size-4 text-primary" />
                  各卡组分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {decks.map((d) => {
                  const count = flashcards.filter((c) => c.deck === d).length;
                  const pct = (count / flashcards.length) * 100;
                  return (
                    <div key={d}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{d}</span>
                        <span className="text-muted-foreground">{count} 张</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  最近 7 天学习
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32 flex items-end justify-between gap-2">
                  {[12, 18, 8, 25, 15, 20, dueCards.length].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-primary/20 rounded-t-sm relative group"
                        style={{ height: `${(v / 25) * 100}%` }}
                      >
                        <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm transition-all" style={{ height: '100%' }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {['一', '二', '三', '四', '五', '六', '日'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 编辑器弹窗 */}
      <CrudDialog
        open={showEditor}
        onOpenChange={setShowEditor}
        title={editingCard ? '编辑卡片' : '新建卡片'}
        onSave={handleSave}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">正面（问题）</label>
            <Textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="输入问题..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">背面（答案）</label>
            <Textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="输入答案..."
              rows={4}
            />
          </div>
        </div>
      </CrudDialog>
    </div>
  );
}
