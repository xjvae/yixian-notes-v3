import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  Wand2,
  Minimize2,
  Maximize2,
  FileText,
  Languages,
  Check,
  RotateCcw,
  Copy,
  MessageSquare,
  Zap,
  FileEdit,
  ListOrdered,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { aiComplete, getAiConfig } from '@/lib/ai';

const AI_ACTIONS = [
  { key: 'continue', label: '续写', icon: Wand2, desc: '基于当前内容继续扩展' },
  { key: 'polish', label: '润色', icon: Sparkles, desc: '优化表达使文字更流畅' },
  { key: 'shorten', label: '缩短', icon: Minimize2, desc: '精简文字保留核心意思' },
  { key: 'expand', label: '扩写', icon: Maximize2, desc: '丰富内容和细节' },
  { key: 'summarize', label: '总结', icon: FileText, desc: '提炼要点和结论' },
  { key: 'translate', label: '翻译', icon: Languages, desc: '翻译成英文' },
  { key: 'headline', label: '起标题', icon: FileEdit, desc: '生成吸引人的标题' },
  { key: 'outline', label: '列大纲', icon: ListOrdered, desc: '梳理内容结构大纲' },
] as const;

type AIActionKey = (typeof AI_ACTIONS)[number]['key'];

interface AIAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedText?: string;
  onAccept?: (newText: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// 模拟 AI 生成内容的映射
function mockGenerate(action: AIActionKey, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '（请先在编辑器中选择一段文字，或在对话中直接输入你的需求）';
  }
  switch (action) {
    case 'continue':
      return `${trimmed}\n\n进一步地，我们可以从以下几个角度来思考这个问题：\n\n1. **背景与现状**：当前行业正处于快速变革期，技术迭代速度加快，用户需求也在不断演变。\n2. **核心挑战**：如何在保持产品体验简洁的同时，满足不同层次用户的多样化需求，是需要平衡的关键。\n3. **可行方案**：可以通过分层设计、渐进式披露等方式，让用户按需发现功能，既不干扰核心流程，又能提供深度选项。\n4. **预期效果**：通过上述优化，预计能显著提升用户留存和使用深度，同时降低新用户的上手门槛。`;
    case 'polish':
      return trimmed
        .replace(/很好/g, '相当出色')
        .replace(/很多/g, '为数众多')
        .replace(/因为/g, '鉴于')
        .replace(/所以/g, '因此')
        .replace(/但是/g, '然而')
        .replace(/我觉得/g, '个人认为')
        .concat('\n\n（已优化措辞，使表达更加流畅自然，增强了书面感和逻辑性）');
    case 'shorten': {
      const sentences = trimmed.split(/[。！？.]/).filter(Boolean);
      if (sentences.length <= 2) return trimmed;
      return sentences
        .slice(0, Math.ceil(sentences.length / 2))
        .join('。')
        .concat('。\n\n（已精简至核心观点，去除冗余表述）');
    }
    case 'expand':
      return `${trimmed}\n\n详细来说，这个话题可以从多个维度展开。\n\n首先，从用户角度来看，这直接影响到日常使用的体验和效率。一个设计良好的功能，应该能让用户在最短的时间内完成目标，而不需要反复摸索。\n\n其次，从产品角度来看，这关系到整体的定位和差异化竞争。在同质化严重的市场中，细节上的打磨往往是脱颖而出的关键。\n\n最后，从技术角度来看，实现方式的选择会影响后续的维护成本和扩展可能性。采用模块化、可扩展的架构，能够为未来的迭代打下坚实的基础。`;
    case 'summarize':
      const words = trimmed.slice(0, 100);
      return `## 内容摘要\n\n- **核心主题**：${words}...\n- **要点提炼**：\n  1. 围绕核心问题展开了多方面论述\n  2. 提出了可行的解决方案和思路\n  3. 强调了执行过程中的注意事项\n- **结论**：整体逻辑清晰，建议可操作性强，值得进一步落地实践。`;
    case 'translate':
      return `Here is the English translation:\n\n---\n\n${trimmed}\n\n---\n\n_Translation completed. The original text has been converted to standard English while preserving the original tone and meaning._`;
    case 'headline':
      return `## 推荐标题\n\n1. 《${trimmed.slice(0, 10)}——深度解析与实践指南》\n2. 《关于${trimmed.slice(0, 8)}的几点思考》\n3. 《${trimmed.slice(0, 6)}：从入门到精通》\n4. 《${trimmed.slice(0, 8)}背后的底层逻辑》\n5. 《一文读懂${trimmed.slice(0, 6)}的核心要点》\n\n_以上标题从不同角度切入，可根据目标读者群体选择最合适的版本。_`;
    case 'outline':
      return `## 内容大纲\n\n### 一、引言\n- 背景介绍\n- 问题提出\n- 本文目的\n\n### 二、现状分析\n- 当前情况概述\n- 存在的主要问题\n- 原因剖析\n\n### 三、解决方案\n- 方案一：思路与实施步骤\n- 方案二：思路与实施步骤\n- 方案对比与选择建议\n\n### 四、落地建议\n- 短期行动项\n- 中长期规划\n- 风险与应对\n\n### 五、总结\n- 核心观点回顾\n- 预期效果展望`;
    default:
      return trimmed;
  }
}

// 模拟流式逐字输出
function useStreamText(targetText: string, isStreaming: boolean, speed = 15) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      indexRef.current = 0;
      return;
    }
    setDisplayed('');
    indexRef.current = 0;

    let rafId: number;
    let lastTime = 0;
    const tick = (time: number) => {
      if (time - lastTime < speed) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      lastTime = time;
      indexRef.current = Math.min(indexRef.current + 2, targetText.length);
      setDisplayed(targetText.slice(0, indexRef.current));
      if (indexRef.current < targetText.length) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetText, isStreaming, speed]);

  return displayed;
}

export default function AIAssistantPanel({
  open,
  onOpenChange,
  selectedText = '',
  onAccept,
}: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'chat'>('actions');
  const [mode, setMode] = useState<'idle' | 'generating' | 'result'>('idle');
  const [currentAction, setCurrentAction] = useState<AIActionKey | null>(null);
  const [generatedText, setGeneratedText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是一闲 AI 写作助手 ✨\n\n我可以帮你：\n- 续写 / 润色 / 缩短 / 扩写选中的文字\n- 总结要点、翻译内容\n- 列大纲、起标题\n\n在编辑器中选中文本，或直接在这里输入你的需求试试吧～',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [latestChatReply, setLatestChatReply] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  // AI 生成的最终文本（由 useStreamText 播放）
  const [fullText, setFullText] = useState('');
  const streamedText = useStreamText(fullText, mode === 'generating');

  // 各快捷操作对应的系统提示
  function systemPromptFor(action: AIActionKey): string {
    const map: Record<AIActionKey, string> = {
      continue: '你是一个写作助手。请根据原文续写，风格保持一致，直接输出续写内容，不要重复原文。',
      polish: '你是一个文字润色助手。请优化原文表达，使其更流畅专业，保持原意，直接输出润色结果。',
      shorten: '你是一个精简助手。请压缩原文，保留核心意思，去除冗余，直接输出精简结果。',
      expand: '你是一个扩写助手。请扩写原文，丰富细节与深度，保持原意，直接输出扩写结果。',
      summarize: '你是一个摘要生成器。请生成简洁摘要，200 字以内，直接输出摘要。',
      translate: '请将原文翻译为英文，保持语义与语气，直接输出翻译结果。',
      headline: '请根据原文生成 3-5 个吸引人的标题，直接输出标题列表。',
      outline: '请根据原文生成层次化大纲，直接输出大纲。',
    };
    return map[action];
  }

  // 执行 AI 生成（配 Key 走真实接口，否则回退本地 mock），统一交打字机播放
  const beginGeneration = useCallback(
    async (action: AIActionKey) => {
      const input = selectedText.trim();
      setMode('generating');
      setGeneratedText('');
      setCurrentAction(action);
      setFullText('');

      if (!input) {
        setFullText('（请先在编辑器中选择一段文字，或在对话中直接输入你的需求）');
        return;
      }

      const cfg = getAiConfig();
      let target: string;
      if (cfg.apiKey) {
        try {
          const res = await aiComplete(input, { systemPrompt: systemPromptFor(action) });
          target = res.text;
        } catch (err) {
          target = `（AI 调用失败，可重试或检查设置中的 API 配置）\n\n${(err as Error).message}`;
        }
      } else {
        target = mockGenerate(action, selectedText);
      }
      setFullText(target);
    },
    [selectedText],
  );

  // 监听右键菜单的快捷 action 事件
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ action: string }>;
      const action = custom.detail?.action as AIActionKey;
      if (action && AI_ACTIONS.some((a) => a.key === action)) {
        setActiveTab('actions');
        beginGeneration(action);
      }
    };
    window.addEventListener('ai-quick-action', handler);
    return () => window.removeEventListener('ai-quick-action', handler);
  }, [beginGeneration]);

  // 生成结束后切到 result
  useEffect(() => {
    if (mode === 'generating' && streamedText === fullText && fullText.length > 0) {
      setMode('result');
      setGeneratedText(fullText);
    }
  }, [streamedText, fullText, mode]);

  // 滚动到聊天底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, latestChatReply]);

  const handleActionClick = useCallback(
    (action: AIActionKey) => {
      setActiveTab('actions');
      beginGeneration(action);
    },
    [beginGeneration],
  );

  const handleAccept = useCallback(() => {
    if (onAccept && generatedText) {
      onAccept(generatedText);
      toast.success('已应用 AI 建议');
    }
    setMode('idle');
    setCurrentAction(null);
  }, [onAccept, generatedText]);

  const handleReject = useCallback(() => {
    setMode('idle');
    setCurrentAction(null);
    setGeneratedText('');
  }, []);

  const handleRetry = useCallback(() => {
    if (currentAction) {
      beginGeneration(currentAction);
    }
  }, [currentAction, beginGeneration]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedText || streamedText).then(() => {
      toast.success('已复制到剪贴板');
    });
  }, [generatedText, streamedText]);

  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const content = chatInput.trim();
      if (!content || isChatStreaming) return;

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content,
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput('');
      setIsChatStreaming(true);
      setLatestChatReply('');

      // 生成回复（配 Key 走真实大模型，否则回退本地 mock）
      let reply: string;
      const cfg = getAiConfig();
      if (cfg.apiKey) {
        try {
          const res = await aiComplete(content, {
            systemPrompt: '你是一闲笔记的 AI 助理，请用简体中文简洁友好地回答用户的问题。',
          });
          reply = res.text || '（AI 返回了空内容）';
        } catch (err) {
          reply = `（AI 调用失败，可重试或检查设置中的 API 配置）\n\n${(err as Error).message}`;
        }
      } else {
        reply = `好的，关于「${content.slice(0, 20)}${content.length > 20 ? '...' : ''}」这个问题，我来回答你：

根据我的理解，这是一个很值得探讨的话题。以下是我的几点看法：

1. **首先**，我们需要明确问题的核心是什么。很多时候，看似复杂的问题，只要抓住了本质，就能找到清晰的解决方案。

2. **其次**，可以从多个角度来分析。不同的视角会带来不同的启发，避免陷入单一思维的局限。

3. **最后**，落地执行时要循序渐进。从小处着手，快速验证，再逐步扩大范围，是比较稳妥的做法。

希望这些建议对你有帮助～ 如果还有其他问题，随时问我就好 ✨`;
      }

      // 流式打字展示
      let i = 0;
      const interval = setInterval(() => {
        i = Math.min(i + 3, reply.length);
        setLatestChatReply(reply.slice(0, i));
        if (i >= reply.length) {
          clearInterval(interval);
          setIsChatStreaming(false);
          setChatMessages((prev) => [
            ...prev,
            { id: `a_${Date.now()}`, role: 'assistant', content: reply },
          ]);
          setLatestChatReply('');
        }
      }, 20);
    },
    [chatInput, isChatStreaming],
  );

  const displayText = mode === 'result' ? generatedText : streamedText;
  const hasSelection = selectedText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">AI 写作助手</DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                智能辅助，让写作更高效
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'actions' | 'chat')}>
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="actions" className="text-xs">
                <Zap className="size-3.5 mr-1.5" />
                快捷操作
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                <MessageSquare className="size-3.5 mr-1.5" />
                对话
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 快捷操作 Tab */}
          <TabsContent value="actions" className="m-0">
            <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
              {mode === 'idle' ? (
                <>
                  {hasSelection && (
                    <div className="mb-3 p-2.5 rounded-lg bg-muted/50 border border-border/40">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="secondary" className="text-[10px] font-normal h-4">
                          已选 {selectedText.length} 字
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {selectedText}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {AI_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.key}
                          variant="outline"
                          className="h-auto py-3 px-3 flex flex-col items-start gap-1 hover:border-primary/40 hover:bg-primary/5 transition-all"
                          onClick={() => handleActionClick(action.key)}
                          disabled={!hasSelection && action.key !== 'outline'}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Icon className="size-4 text-primary" />
                            {action.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground text-left font-normal">
                            {action.desc}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                  {!hasSelection && (
                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                      💡 请先在编辑器中选中一段文字，再使用 AI 操作
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* 生成结果 / 生成中 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {currentAction && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {AI_ACTIONS.find((a) => a.key === currentAction)?.label}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {mode === 'generating' ? '生成中...' : '生成完成'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleRetry}
                        aria-label="重新生成"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCopy}
                        aria-label="复制"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* diff 对比区 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg border border-border/40 overflow-hidden">
                      <div className="px-2 py-1.5 bg-muted/30 border-b border-border/40 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">原文</span>
                      </div>
                      <div className="p-2.5 text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto">
                        {selectedText || <span className="italic opacity-50">（无选中文本）</span>}
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
                      <div className="px-2 py-1.5 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-primary">AI 建议</span>
                        {mode === 'generating' && (
                          <span className="text-[10px] text-primary/70 animate-pulse">
                            生成中
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {displayText}
                        {mode === 'generating' && (
                          <span className="inline-block w-1.5 h-3 bg-primary ml-0.5 animate-pulse align-text-bottom" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={handleReject}
                    >
                      <X className="size-3.5 mr-1.5" />
                      放弃
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs h-8"
                        onClick={handleRetry}
                      >
                        <RotateCcw className="size-3.5 mr-1.5" />
                        重新生成
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-8"
                        onClick={handleAccept}
                        disabled={mode !== 'result'}
                      >
                        <Check className="size-3.5 mr-1.5" />
                        接受
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* 对话 Tab */}
          <TabsContent value="chat" className="m-0">
            <div className="flex flex-col" style={{ height: '50vh' }}>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-2 text-sm leading-relaxed',
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    <div
                      className={cn(
                        'size-6 shrink-0 rounded-full flex items-center justify-center',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground',
                      )}
                    >
                      {msg.role === 'user' ? (
                        <span className="text-[10px] font-bold">我</span>
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-xl px-3 py-2 whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted/60 rounded-tl-sm',
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {(isChatStreaming || latestChatReply) && (
                  <div className="flex gap-2 text-sm leading-relaxed">
                    <div className="size-6 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center">
                      <Sparkles className="size-3.5" />
                    </div>
                    <div className="max-w-[75%] rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 whitespace-pre-wrap">
                      {latestChatReply}
                      {isChatStreaming && (
                        <span className="inline-block w-1 h-3 bg-primary ml-0.5 animate-pulse align-text-bottom" />
                      )}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleChatSubmit}
                className="border-t border-border/40 p-3 flex items-end gap-2"
              >
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="输入你的问题，Shift+Enter 换行"
                  className="min-h-[60px] max-h-32 resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  disabled={isChatStreaming}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={!chatInput.trim() || isChatStreaming}
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
