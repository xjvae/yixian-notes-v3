// AI 助手 API 接入框架
//
// 支持的 AI 提供商：
// 1. OpenAI（GPT 系列）— 默认
// 2. Claude（Anthropic）— 通过 OpenAI 兼容接口
// 3. Ollama（本地模型）— 私有部署
//
// 使用方式：
//   1. 在设置中配置 API Key 和模型
//   2. 调用 aiComplete(prompt, options) 获取文本补全
//   3. 调用 aiStreamComplete(prompt, options, onChunk) 获取流式输出

import { useStore } from "@/store/useStore";
import { stripHtmlToText } from "@/lib/text";

export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: AiMessage[];
}

export interface AiResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 获取 AI 配置（从 Store 设置读取，回退到主 settings / 环境变量）
 */
export function getAiConfig(): AiConfig {
  // 优先读取主设置（localStorage yixian_settings，含 aiApiKey/aiModel/aiBaseUrl）
  let mainSettings: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem("yixian_settings");
    if (raw) mainSettings = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // ignore parse errors
  }
  const mainKey = (mainSettings.aiApiKey as string) || "";
  const mainModel = (mainSettings.aiModel as string) || "";
  const mainBaseUrl = (mainSettings.aiBaseUrl as string) || "";

  const settings = useStore.getState().settings;
  const settingsKey = (settings as unknown as Record<string, unknown>).ai_api_key as string || "";
  const settingsModel = (settings as unknown as Record<string, unknown>).ai_model as string || "";
  const settingsBaseUrl = (settings as unknown as Record<string, unknown>).ai_base_url as string || "";

  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AI_API_KEY || "";
  const envModel = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AI_MODEL || "gpt-4o-mini";
  const envBaseUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AI_BASE_URL || "";

  return {
    apiKey: mainKey || settingsKey || envKey,
    model: mainModel || settingsModel || envModel,
    baseUrl: mainBaseUrl || settingsBaseUrl || envBaseUrl || "https://api.openai.com/v1",
    temperature: 0.7,
    maxTokens: 2000,
  };
}

/**
 * AI 文本补全（非流式）
 */
export async function aiComplete(
  prompt: string,
  options: AiOptions = {}
): Promise<AiResult> {
  const config = getAiConfig();

  if (!config.apiKey) {
    throw new Error("未配置 AI API Key，请在设置中配置");
  }

  const messages: AiMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  if (options.messages) {
    messages.push(...options.messages);
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`AI API 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      }
    : undefined;

  return { text, usage };
}

/**
 * AI 流式补全（SSE）
 */
export async function aiStreamComplete(
  prompt: string,
  options: AiOptions = {},
  onChunk: (text: string) => void,
  onDone?: (fullText: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const config = getAiConfig();

  if (!config.apiKey) {
    onError?.(new Error("未配置 AI API Key，请在设置中配置"));
    return;
  }

  const messages: AiMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  if (options.messages) {
    messages.push(...options.messages);
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? config.temperature,
        max_tokens: options.maxTokens ?? config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      onError?.(new Error(`AI API 请求失败 (${response.status}): ${errorText}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.(new Error("无法读取响应流"));
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          onDone?.(fullText);
          return;
        }

        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content || "";
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // 跳过解析失败的行
        }
      }
    }

    onDone?.(fullText);
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}

// ─── AI 模式预设 ─────────────────────────────────────────────

export interface AiMode {
  id: string;
  label: string;
  desc: string;
  systemPrompt: string;
  buildPrompt: (noteContent: string) => string;
}

/** AI 助手模式预设 */
export const AI_MODES: AiMode[] = [
  {
    id: "continue",
    label: "续写",
    desc: "根据当前内容继续写作",
    systemPrompt: "你是一个写作助手，请根据用户提供的文本继续写作，保持风格一致。直接输出续写内容，不要重复原文。",
    buildPrompt: (content) => `请续写以下内容：\n\n${content}`,
  },
  {
    id: "summary",
    label: "总结",
    desc: "生成内容摘要",
    systemPrompt: "你是一个摘要生成器，请生成简洁的摘要，控制在 200 字以内。",
    buildPrompt: (content) => `请总结以下内容：\n\n${content}`,
  },
  {
    id: "translate-en",
    label: "翻译为英文",
    desc: "将内容翻译为英文",
    systemPrompt: "你是一个翻译助手，请将中文翻译为英文，保持原文语义和语气。",
    buildPrompt: (content) => `请翻译为英文：\n\n${content}`,
  },
  {
    id: "translate-zh",
    label: "翻译为中文",
    desc: "将英文翻译为中文",
    systemPrompt: "你是一个翻译助手，请将英文翻译为中文，保持原文语义和语气。",
    buildPrompt: (content) => `请翻译为中文：\n\n${content}`,
  },
  {
    id: "polish",
    label: "润色",
    desc: "优化文笔和表达",
    systemPrompt: "你是一个文字润色助手，请优化文字表达，使其更加流畅、专业，但保持原意不变。",
    buildPrompt: (content) => `请润色以下文字：\n\n${content}`,
  },
  {
    id: "outline",
    label: "生成大纲",
    desc: "根据内容生成结构大纲",
    systemPrompt: "你是一个大纲生成器，请根据内容生成层次化的结构大纲。",
    buildPrompt: (content) => `请为以下内容生成大纲：\n\n${content}`,
  },
  {
    id: "keywords",
    label: "提取关键词",
    desc: "提取核心关键词",
    systemPrompt: "你是一个关键词提取器，请提取 5-10 个核心关键词，用逗号分隔。",
    buildPrompt: (content) => `请提取以下内容的关键词：\n\n${content}`,
  },
  {
    id: "questions",
    label: "生成问答",
    desc: "生成复习问答",
    systemPrompt: "你是一个问答生成器，请根据内容生成 3-5 个问答对，用于复习。",
    buildPrompt: (content) => `请根据以下内容生成问答：\n\n${content}`,
  },
  {
    id: "expand",
    label: "扩写",
    desc: "扩展内容细节",
    systemPrompt: "你是一个扩写助手，请在保持原意的基础上扩展内容细节，增加深度。",
    buildPrompt: (content) => `请扩写以下内容：\n\n${content}`,
  },
  {
    id: "simplify",
    label: "简化",
    desc: "简化复杂表达",
    systemPrompt: "你是一个简化助手，请将复杂的内容简化为易懂的表达。",
    buildPrompt: (content) => `请简化以下内容：\n\n${content}`,
  },
  {
    id: "explain",
    label: "解释",
    desc: "解释专业概念",
    systemPrompt: "你是一个概念解释器，请用通俗的语言解释内容中的专业概念。",
    buildPrompt: (content) => `请解释以下内容中的概念：\n\n${content}`,
  },
];

// ─── 本地文本处理（离线模式）─────────────────────────────────

export function processText(text: string, mode: string): string {
  let result = text;
  switch (mode) {
    case "formal":
      result = result
        .replace(/(咋|怎么)样/g, "如何")
        .replace(/没法/g, "无法")
        .replace(/得行/g, "可行")
        .replace(/特别(好|快|多)/g, "极为$1");
      break;
    case "casual":
      result = result
        .replace(/如何/g, "怎么样")
        .replace(/无法/g, "没法")
        .replace(/极为(好|快|多)/g, "特别$1");
      break;
    case "concise":
      result = result
        .replace(/[ \t]+/g, " ")
        .replace(/(非常|十分|特别|尤其)/g, "很")
        .replace(/(进行了一次|进行了)/g, "")
        .replace(/，+/g, "，")
        .trim();
      break;
    case "expand":
      result = result.replace(/([。.])/g, "$1详细来说，").replace(/，/g, "，具体而言，");
      break;
    case "polish":
      result = result
        .replace(/\s+/g, " ")
        .replace(/([。！？])([^\s])/g, "$1\n$2")
        .trim();
      break;
    case "translate":
      result = result
        .replace(/你好/g, "Hello")
        .replace(/世界/g, "World")
        .replace(/谢谢/g, "Thank you")
        .replace(/笔记/g, "Note");
      break;
    case "continue":
      {
        // 确定性续写：从原文提取高频双字词作为主题，不再用随机套话
        const clean = stripHtmlToText(result).trim().replace(/\s+/g, " ");
        const seg = clean.slice(0, 240);
        const freq: Record<string, number> = {};
        for (let k = 0; k + 2 <= seg.length; k++) {
          const w = seg.slice(k, k + 2);
          if (/^[\u4e00-\u9fff]{2}$/.test(w)) freq[w] = (freq[w] || 0) + 1;
        }
        const kws = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([w]) => w);
        const kwText = kws.length ? kws.join("、") : "这一主题";
        result = `${result}\n\n结合上文对「${kwText}」的梳理，可以进一步延伸到以下几个层面：\n\n### 1. 现状与要点\n\n### 2. 可执行的做法\n\n### 3. 后续安排\n\n（离线续写框架已按原文主题生成，接入 API Key 后可自动补全完整内容）`;
      }
      break;
    case "summary":
      {
        const lines = result.split(/\n+/).filter((l) => l.trim());
        const firstLines = lines.slice(0, 3).map((l) => l.trim().replace(/[#*_`>]/g, ""));
        const wc = result.replace(/\s/g, "").length;
        result = `【摘要】\n\n${firstLines.join("；")}…\n\n（原文约 ${wc} 字，共 ${lines.length} 段）`;
      }
      break;
    case "outline":
      {
        const lines = result.split(/\n+/).filter((l) => l.trim());
        const outline = lines
          .map((l, i) => {
            const clean = l.replace(/[#*_`>]/g, "").trim();
            if (clean.length === 0) return null;
            if (i === 0) return `# ${clean}`;
            if (i % 2 === 1) return `  ## ${clean}`;
            return `    - ${clean}`;
          })
          .filter(Boolean);
        result = `【大纲】\n\n${outline.join("\n")}`;
      }
      break;
    case "rewrite":
      result = result
        .replace(/因此/g, "\uE000TMP1\uE000")
        .replace(/所以/g, "因此")
        .replace(/\uE000TMP1\uE000/g, "所以")
        .replace(/但是/g, "\uE001TMP2\uE001")
        .replace(/然而/g, "但是")
        .replace(/\uE001TMP2\uE001/g, "然而")
        .replace(/因为/g, "\uE002TMP3\uE002")
        .replace(/由于/g, "因为")
        .replace(/\uE002TMP3\uE002/g, "由于")
        .replace(/如果/g, "假如")
        .replace(/虽然/g, "尽管");
      break;
    case "tags":
      {
        const freq = new Map<string, number>();
        const cnWords = result.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        cnWords.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
        const enWords = result.match(/[a-zA-Z]{3,}/g) || [];
        enWords.forEach((w) => freq.set(w.toLowerCase(), (freq.get(w.toLowerCase()) ?? 0) + 1));
        const top = Array.from(freq.entries())
          .filter(([w, c]) => c >= 2 && w.length >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([w]) => w);
        result =
          top.length > 0
            ? `【推荐标签】\n\n${top.map((t) => `#${t}`).join(" ")}\n\n（基于词频统计，可按需选用）`
            : "【推荐标签】\n\n（文本较短，未能提取有效标签，建议手动添加）";
      }
      break;
  }
  return result || text;
}

// ─── AI 工作流：周报告离线聚合（阶段4·回填） ─────────────────

export interface WeeklyWorkflowInput {
  notes: { createdAt?: number; updatedAt?: number; tags?: string[] }[];
  todos: { completed?: boolean; status?: string; updatedAt?: number }[];
  flashcards: { lastReviewedAt?: number; deck?: string }[];
  tags: { name: string; color?: string }[];
  /** 标签 id → 名称映射，用于热点标签展示（无则直接显示 id） */
  tagNameOf?: (id: string) => string;
}

export interface WeeklyWorkflowReport {
  builtAt: string;
  weekNewNotes: number;
  weekTodosDone: number;
  weekReviews: number;
  streak: number;
  hotTags: { name: string; count: number }[];
  incompleteTodos: number;
  summary: string;
  suggestions: string[];
}

const DAY = 86_400_000;
const isCompleted = (t: { completed?: boolean; status?: string }) =>
  !!t.completed || t.status === 'completed';

/**
 * 基于本周真实数据离线生成「AI 工作流周报」。
 * 不需要 AI API Key：用确定性聚合 + 规则化建议即可给出可见产出；
 * 配置了 Key 后可在前端再用 aiComplete 润色为自然语言正文。
 */
export function buildWeeklyWorkflowReport(input: WeeklyWorkflowInput): WeeklyWorkflowReport {
  const now = new Date();
  // 本周一 00:00
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  const weekNewNotes = input.notes.filter((n) => (n.createdAt ?? 0) >= weekStartTs).length;
  const weekTodosDone = input.todos.filter(
    (t) => isCompleted(t) && (t.updatedAt ?? 0) >= weekStartTs,
  ).length;
  const weekReviews = input.flashcards.filter(
    (f) => (f.lastReviewedAt ?? 0) >= weekStartTs,
  ).length;
  const incompleteTodos = input.todos.filter((t) => !isCompleted(t)).length;

  // 连续记录天数（按本地日期）
  const seen = new Set(
    input.notes.map((n) =>
      new Date(n.updatedAt ?? n.createdAt ?? Date.now()).toISOString().slice(0, 10),
    ),
  );
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    if (seen.has(ds)) streak++;
    else break;
  }

  // 热点标签（基于本周笔记）
  const tagCount = new Map<string, number>();
  input.notes.forEach((n) =>
    (n.tags ?? []).forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)),
  );
  const hotTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, count]) => ({ name: input.tagNameOf ? input.tagNameOf(t) : t, count }));

  // 规则化建议
  const suggestions: string[] = [];
  if (weekNewNotes === 0) suggestions.push('本周未新建笔记，建议定一个最小输出计划（如每天 1 条）。');
  if (weekTodosDone < 3) suggestions.push(`本周仅完成 ${weekTodosDone} 项待办，试着把目标拆成更小的下一步。`);
  if (incompleteTodos >= 5) suggestions.push(`仍有 ${incompleteTodos} 项待办未完成，建议优先处理最早到期的那几项。`);
  if (streak === 0) suggestions.push('还没有连续记录，可以从「一条便签 + 一条笔记」开始培养习惯。');
  if (suggestions.length === 0) suggestions.push('本周节奏良好，继续保持并尝试把高价值笔记固化为闪卡。');

  const summary =
    `截至 ${now.toLocaleDateString('zh-CN')}，本周新增笔记 ${weekNewNotes} 篇、` +
    `完成待办 ${weekTodosDone} 项、复习闪卡 ${weekReviews} 次，` +
    `连续记录 ${streak} 天。热点主题：${hotTags.map((t) => `#${t.name}`).join('、') || '暂无'}。`;

  return {
    builtAt: now.toISOString(),
    weekNewNotes,
    weekTodosDone,
    weekReviews,
    streak,
    hotTags,
    incompleteTodos,
    summary,
    suggestions,
  };
}
