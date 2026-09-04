// ---- plugin:ai_writing_assistant_1 ----
// ============================================================
// 插件 ai_writing_assistant_1 (AI 写作助手) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface AiWritingAssistantOneInput {
  /** 用户输入的原始文本内容 */
  original_content: string;
  /** 用户自定义的补充要求（可选） */
  additional_requirements?: string;
  /** 操作类型，可选值：续写、润色、缩短、扩写、总结 */
  operation_type: string;
}

/**
 * capabilityClient.load('ai_writing_assistant_1').callStream<AiWritingAssistantOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 AiWritingAssistantOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface AiWritingAssistantOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:ai_writing_assistant_1 ----