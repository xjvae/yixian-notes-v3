import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  SpellCheck,
  Check,
  X,
  BookOpen,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileText,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type GrammarErrorType = 'spelling' | 'grammar' | 'punctuation' | 'style';

interface GrammarError {
  id: string;
  type: GrammarErrorType;
  message: string;
  text: string;
  start: number;
  end: number;
  suggestions: string[];
  category: string;
}

const sampleText = `今天我写了一篇关于知识管理的文张。
知识管理对于提高工作效率非常重要的。
通过系统性地整理笔记，我们可以加身对知识的理解。

常见的误区包括：
1. 收集了太多资料但不去复习；
2. 笔记写的太乱，找不到重点；
3. 没有建立知识之间的联接。

研究表明，主动回忆和间隔重复是最有效的学习方法。
我们应该每天花一点时间，回顾之前的笔记内容。
这样才能真正把知识内划成自己的能力。

另外，选择一个好用的工具也很关键。
一闲笔记，就是一个不错的选择呢？
它支持三栏式布局，标签管理，还有搜索功能。

希望你能找到适合自己的知识管理方法。`;

// 通用拼写/语法/标点/风格规则引擎（对任意文本生效，非针对样本文案）
// 常见同音/形近错别字字典（错误，建议，类别）
const TYPO_DICT: Array<[string, string, string]> = [
  ['文张', '文章', '形近错别字'],
  ['内划', '内化', '同音错别字'],
  ['加身', '加深', '同音错别字'],
  ['联接', '联结', '用词不当'],
  ['既使', '即使', '同音错别字'],
  ['以经', '已经', '同音错别字'],
  ['作事', '做事', '同音错别字'],
];

// “地/得”常用搭配检测（镜像 list）：命中关键词后以“的”或“地”接续动作更规范
const DE_PAIRS: Array<{ core: string; repl: string; good: string }> = [
  { core: '慢慢', repl: '慢慢', good: '得' },
  { core: '努力', repl: '努力地', good: '地' },
  { core: '认真', repl: '认真地', good: '地' },
  { core: '仔细', repl: '仔细地', good: '地' },
  { core: '高兴', repl: '高兴地', good: '地' },
  { core: '掌握', repl: '掌握得', good: '得' },
];

// 现代英文常见拼写错误 → 正确
const EN_TYPO: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  adress: 'address',
  occured: 'occurred',
  seperate: 'separate',
  definately: 'definitely',
  unfortunatly: 'unfortunately',
};

function analyzeText(raw: string, whitelist: string[] = []): GrammarError[] {
  const errors: GrammarError[] = [];
  let idCounter = 0;
  const addErr = (
    type: GrammarErrorType,
    message: string,
    piece: string,
    start: number,
    end: number,
    suggestions: string[],
    category: string,
  ) => errors.push({ id: `err-${idCounter++}`, type, message, text: piece, start, end, suggestions, category });
  const skip = (chunk: string) => whitelist.some((w) => w && chunk.toLowerCase().includes(w.toLowerCase()));

  const lines = raw.split('\n');
  let base = 0;

  for (const line of lines) {
    // 1) 错别字字典
    for (const [wrong, sugg, cat] of TYPO_DICT) {
      if (skip(wrong)) continue;
      let pos = line.indexOf(wrong);
      while (pos !== -1) {
        addErr('spelling', `「${wrong}」可能是错别字，建议改为「${sugg}」`, wrong, base + pos, base + pos + wrong.length, [sugg], cat);
        pos = line.indexOf(wrong, pos + 1);
      }
    }

    // 2) 连续重复字符（键盘粘连/误输入）
    const rep = line.match(/([\u4e00-\u9fffA-Za-z0-9])\1{2,}/);
    if (rep && rep.index !== undefined) {
      const t = rep[0];
      addErr('spelling', `「${t}」连续重复，请确认是否为误输入`, t, base + rep.index, base + rep.index + t.length, [t[0]], '重复字符');
    }

    // 3) “的 / 地 / 得” 常用搭配误用
    for (const p of DE_PAIRS) {
      const idx = line.indexOf(p.core);
      if (idx === -1) continue;
      const followed = line.slice(idx + p.core.length, idx + p.core.length + 1);
      if (followed === p.good) continue; // 已是正确用法
      if (followed === '的' || followed === '得') {
        addErr('grammar', `“${p.core}”与后接用法搭配不当，宜用“${p.good}”`, p.core + followed, base + idx, base + idx + p.core.length + 1, [p.core + p.good], '的地得误用');
        break;
      }
    }

    // 4) 连续/重叠标点
    const dup = line.match(/[。，、；：！？]{2,}/);
    if (dup && dup.index !== undefined) {
      const t = dup[0];
      addErr('punctuation', `存在连续标点「${t}」，建议只保留一个`, t, base + dup.index, base + dup.index + t.length, [t[0]], '标点重复');
    }

    // 5) 中英文之间缺少空格
    const noSpace = line.match(/[\u4e00-\u9fff][A-Za-z]|[A-Za-z][\u4e00-\u9fff]/);
    if (noSpace && noSpace.index !== undefined) {
      const t = noSpace[0];
      const fix = `${t[0]} ${t[1]}`;
      addErr('style', '中英文之间建议增加一个空格', t, base + noSpace.index, base + noSpace.index + t.length, [fix], '中英混排');
    }

    // 6) 疑问语气词但句末用句号 → 疑似疑问句
    const q = line.match(/([啊吧呢吗]|难道|是否)[。,]$/);
    if (q) {
      const endIdx = base + line.length - 1;
      addErr('punctuation', '含疑问语气词但以句号结尾，建议改为问号', line[line.length - 1], endIdx, endIdx + 1, ['？'], '标点误用');
    }

    // 7) 常见英文拼写错误
    for (const token of line.match(/[A-Za-z]+/g) || []) {
      const lower = token.toLowerCase();
      if (EN_TYPO[lower] && !skip(EN_TYPO[lower])) {
        const o = line.indexOf(token);
        addErr('spelling', `英文拼写「${token}」有误，建议改为「${EN_TYPO[lower]}」`, token, base + o, base + o + token.length, [EN_TYPO[lower]], '英文拼写');
        break;
      }
    }

    base += line.length + 1;
  }

  return errors;
}

const typeConfig: Record<GrammarErrorType, { label: string; color: string; bgColor: string; icon: typeof AlertCircle }> = {
  spelling: { label: '拼写错误', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: AlertCircle },
  grammar: { label: '语法问题', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: AlertCircle },
  punctuation: { label: '标点规范', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: AlertCircle },
  style: { label: '风格建议', color: 'text-violet-600', bgColor: 'bg-violet-50', icon: AlertCircle },
};

export default function GrammarPage() {
  const [text, setText] = useState(sampleText);
  const [enabled, setEnabled] = useState(true);
  const [showSpelling, setShowSpelling] = useState(true);
  const [showGrammar, setShowGrammar] = useState(true);
  const [showPunctuation, setShowPunctuation] = useState(true);
  const [showStyle, setShowStyle] = useState(true);
  const [language, setLanguage] = useState('zh-CN');
  const [dictionary, setDictionary] = useState<string[]>(['一闲', 'SECI', '艾宾浩斯']);
  const [dictInput, setDictInput] = useState('');
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);

  const errors = useMemo(() => {
    if (!enabled) return [];
    return analyzeText(text, dictionary);
  }, [text, enabled, dictionary]);

  const filteredErrors = useMemo(() => {
    return errors.filter((e) => {
      if (e.type === 'spelling' && !showSpelling) return false;
      if (e.type === 'grammar' && !showGrammar) return false;
      if (e.type === 'punctuation' && !showPunctuation) return false;
      if (e.type === 'style' && !showStyle) return false;
      return true;
    });
  }, [errors, showSpelling, showGrammar, showPunctuation, showStyle]);

  const stats = useMemo(() => {
    const s = { spelling: 0, grammar: 0, punctuation: 0, style: 0 };
    errors.forEach((e) => {
      s[e.type]++;
    });
    return s;
  }, [errors]);

  const handleCorrect = useCallback((error: GrammarError, suggestion: string) => {
    const before = text.slice(0, error.start);
    const after = text.slice(error.end);
    setText(before + suggestion + after);
    toast.success(`已修正：${error.text} → ${suggestion}`);
    setSelectedErrorId(null);
  }, [text]);

  const handleIgnore = useCallback((error: GrammarError) => {
    toast.info(`已忽略：${error.text}`);
    setSelectedErrorId(null);
  }, []);

  const handleAddToDict = useCallback((word: string) => {
    if (!dictionary.includes(word)) {
      setDictionary((prev) => [...prev, word]);
      toast.success(`已添加到词典：${word}`);
    }
  }, [dictionary]);

  const handleAddDictInput = () => {
    if (dictInput.trim() && !dictionary.includes(dictInput.trim())) {
      setDictionary((prev) => [...prev, dictInput.trim()]);
      setDictInput('');
      toast.success('已添加到词典');
    }
  };

  const handleFixAll = () => {
    let newText = text;
    let count = 0;
    // 简单按拼写错误修正
    filteredErrors.filter((e) => e.type === 'spelling').forEach((e) => {
      if (e.suggestions[0] && newText.includes(e.text)) {
        newText = newText.replace(e.text, e.suggestions[0]);
        count++;
      }
    });
    if (count > 0) {
      setText(newText);
      toast.success(`已自动修正 ${count} 处拼写错误`);
    } else {
      toast.info('没有可一键修正的拼写错误');
    }
  };

  // 渲染带标记的文本
  const renderHighlightedText = () => {
    if (!enabled || filteredErrors.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    const sortedErrors = [...filteredErrors].sort((a, b) => a.start - b.start);
    const parts: { text: string; error?: GrammarError }[] = [];
    let lastEnd = 0;

    for (const err of sortedErrors) {
      if (err.start > lastEnd) {
        parts.push({ text: text.slice(lastEnd, err.start) });
      }
      parts.push({ text: text.slice(err.start, err.end), error: err });
      lastEnd = err.end;
    }
    if (lastEnd < text.length) {
      parts.push({ text: text.slice(lastEnd) });
    }

    return (
      <span className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          if (!part.error) {
            return <span key={i}>{part.text}</span>;
          }
          const err = part.error;
          const config = typeConfig[err.type];
          return (
            <span
              key={i}
              className={cn(
                'cursor-pointer relative transition-colors',
                selectedErrorId === err.id && config.bgColor,
              )}
              onClick={() => setSelectedErrorId(selectedErrorId === err.id ? null : err.id)}
            >
              <span
                className={cn(
                  'border-b-2',
                  err.type === 'spelling' && 'border-b-rose-500 border-dashed',
                  err.type === 'grammar' && 'border-b-blue-500 border-dashed',
                  err.type === 'punctuation' && 'border-b-amber-500 border-dashed',
                  err.type === 'style' && 'border-b-violet-500 border-dashed',
                )}
              >
                {part.text}
              </span>

              {/* 悬浮修正菜单 */}
              {selectedErrorId === err.id && (
                <span className="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-md border bg-popover text-popover-foreground shadow-md p-2">
                  <div className="text-xs font-medium mb-1">{config.label}</div>
                  <div className="text-[11px] text-muted-foreground mb-2">{err.message}</div>
                  <div className="space-y-1">
                    {err.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCorrect(err, s);
                        }}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className="size-3 inline mr-1.5 text-primary" />
                        {s}
                      </button>
                    ))}
                  </div>
                  <Separator className="my-1.5" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIgnore(err);
                    }}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="size-3 inline mr-1.5" />
                    忽略此项
                  </button>
                  {err.type === 'spelling' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToDict(err.text);
                        setSelectedErrorId(null);
                      }}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
                    >
                      <BookOpen className="size-3 inline mr-1.5" />
                      添加到词典
                    </button>
                  )}
                </span>
              )}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SpellCheck className="size-6 text-primary" />
            拼写语法检查
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            实时检测拼写错误、语法问题与标点规范，一键修正
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="grammar-toggle" className="text-sm text-muted-foreground">启用检查</Label>
            <Switch id="grammar-toggle" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <Button variant="secondary" size="sm" onClick={handleFixAll}>
            <RefreshCw className="size-3.5 mr-1.5" />
            一键修正拼写
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.spelling}</div>
                <div className="text-xs text-muted-foreground">拼写错误</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.grammar}</div>
                <div className="text-xs text-muted-foreground">语法问题</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.punctuation}</div>
                <div className="text-xs text-muted-foreground">标点问题</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <CheckCircle className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.style}</div>
                <div className="text-xs text-muted-foreground">风格建议</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">编辑器演示</TabsTrigger>
          <TabsTrigger value="settings">检查设置</TabsTrigger>
          <TabsTrigger value="dictionary">自定义词典</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 编辑器区 */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  文本检查区
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                    共发现 {filteredErrors.length} 处问题
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border/50 bg-card p-4 min-h-[300px] text-sm">
                  {renderHighlightedText()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 点击带下划线的单词查看修正建议
                </p>
              </CardContent>
            </Card>

            {/* 问题列表 */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="size-4 text-primary" />
                  问题列表
                </CardTitle>
                <div className="flex gap-1 flex-wrap mt-1">
                  <Badge
                    variant={showSpelling ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] h-5"
                    onClick={() => setShowSpelling(!showSpelling)}
                  >
                    拼写 {stats.spelling}
                  </Badge>
                  <Badge
                    variant={showGrammar ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] h-5"
                    onClick={() => setShowGrammar(!showGrammar)}
                  >
                    语法 {stats.grammar}
                  </Badge>
                  <Badge
                    variant={showPunctuation ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] h-5"
                    onClick={() => setShowPunctuation(!showPunctuation)}
                  >
                    标点 {stats.punctuation}
                  </Badge>
                  <Badge
                    variant={showStyle ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] h-5"
                    onClick={() => setShowStyle(!showStyle)}
                  >
                    风格 {stats.style}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[320px] -mx-2 px-2">
                  {filteredErrors.length > 0 ? (
                    <div className="space-y-1.5">
                      {filteredErrors.map((err, i) => {
                        const config = typeConfig[err.type];
                        return (
                          <motion.div
                            key={err.id}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.15 }}
                            className={cn(
                              'p-2.5 rounded-lg border transition-colors cursor-pointer',
                              selectedErrorId === err.id
                                ? `${config.bgColor} border-transparent`
                                : 'border-border/40 hover:border-border',
                            )}
                            onClick={() => setSelectedErrorId(selectedErrorId === err.id ? null : err.id)}
                          >
                            <div className="flex items-start gap-2">
                              <span className={cn('size-1.5 rounded-full mt-1.5 shrink-0', config.color.replace('text', 'bg'))} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium line-clamp-1">
                                    <span className="font-mono">{err.text}</span>
                                  </span>
                                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-normal ml-auto shrink-0">
                                    {config.label}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                  {err.message}
                                </p>
                                {selectedErrorId === err.id && err.suggestions.length > 0 && (
                                  <div className="flex gap-1 mt-2 flex-wrap">
                                    {err.suggestions.map((s) => (
                                      <button
                                        key={s}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCorrect(err, s);
                                        }}
                                        className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                                      >
                                        <Check className="size-2.5 inline mr-0.5" />
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <CheckCircle className="size-10 mx-auto mb-2 text-emerald-500" />
                      <p className="text-sm">没有发现问题</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">检查设置</CardTitle>
              <CardDescription>自定义拼写语法检查的规则和范围</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">检查语言</Label>
                  <p className="text-xs text-muted-foreground">选择需要检查的语言</p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="zh-TW">繁体中文</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">检查范围</Label>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm">拼写错误</span>
                    <p className="text-xs text-muted-foreground">检测错别字、形近字、同音字误用</p>
                  </div>
                  <Switch checked={showSpelling} onCheckedChange={setShowSpelling} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm">语法问题</span>
                    <p className="text-xs text-muted-foreground">检测句子成分残缺、搭配不当等</p>
                  </div>
                  <Switch checked={showGrammar} onCheckedChange={setShowGrammar} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm">标点规范</span>
                    <p className="text-xs text-muted-foreground">检测中英文标点混用、误用等</p>
                  </div>
                  <Switch checked={showPunctuation} onCheckedChange={setShowPunctuation} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm">风格建议</span>
                    <p className="text-xs text-muted-foreground">提供表述优化、文风一致性建议</p>
                  </div>
                  <Switch checked={showStyle} onCheckedChange={setShowStyle} />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">的地得检查</Label>
                  <p className="text-xs text-muted-foreground">专项检测「的/地/得」误用</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dictionary" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4 text-primary" />
                  自定义词典
                </span>
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {dictionary.length} 个词
                </Badge>
              </CardTitle>
              <CardDescription>添加到词典的词语将不再被标记为拼写错误</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dictInput}
                  onChange={(e) => setDictInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDictInput()}
                  placeholder="输入要添加的词语..."
                  className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button onClick={handleAddDictInput}>
                  <Plus className="size-4 mr-1.5" />
                  添加
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {dictionary.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="group text-xs pl-2 pr-1 py-1 h-6 gap-1"
                  >
                    {word}
                    <button
                      onClick={() => setDictionary((prev) => prev.filter((w) => w !== word))}
                      className="size-4 rounded-full hover:bg-background/50 flex items-center justify-center ml-1"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
