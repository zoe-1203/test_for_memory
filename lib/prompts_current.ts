// ==========================================
// SECTION 1: TYPE DEFINITIONS
// ==========================================

/**
 * Parameters for memory compression prompts
 */
export interface MemoryCompressionParams {
  events: string;
  eventsMonth?: string;
  eventsThisMonth?: string;
}

/**
 * Parameters for Stage 1 XML extraction prompt
 */
export interface Stage1XmlParams {
  this_session_raw: string;
}

// ==========================================
// SECTION 2: PROMPT TEMPLATES
// ==========================================

/**
 * Stage 1 XML 格式提取 Prompt
 * 用于从对话中提取事实性记忆，输出 XML 格式
 */
export const EXTRACT_MEMORY_STAGE1_XML_PROMPT = `
请你帮我从这段对话中提取出值得被记住的关于用户的部分，放进 facts 里。facts 上限为2000字。

注意，塔罗师说的内容可能不是事实，只有用户说的内容才是事实。

facts 只存入用户口述的事实，而不存塔罗师说的内容，不要对用户没说的做揣测。

facts 结构分为两块。第一块是 personRelatedContent，代表用户涉及某个/几个具体人物的内容，重点关注用户和这个人物间发生的具体事件。
第二块是仅仅有关用户自身的内容userSelfContent。可以为空，不要做出揣测。如果为空则写一句话：未提及与具体人物无关的自身情况，此部分为空。

topic area 存入 感情/事业/学业/生活/运势/决策/自我成长 中的一个。
topic summary 存入10个字的具体内容，比如用户这次关心的主题，以及用户关心的人物名等。topic 简单一句话即可。

请你不要做揣测，而只记录事实。
如果提及不同的人物，需要在 fact 中另开一段。

输出格式：
请用自然语言输出，但不要用list，而是用自然语言段落。

输出格式比如：
<facts>
<personRelatedContent>涉及某个具体人物的内容</personRelatedContent>
<userSelfContent>用户自身的内容...
</userSelfContent>
</facts>

<topicArea>...</topicArea>

<topicSummary>...</topicSummary>

对话内容：
{{this_session_raw}}
`;

/**
 * 上月记忆压缩 Prompt
 * 用于整理上个月的占卜记忆
 */
export const COMPRESS_MONTHLY_MEMORIES_PROMPT = `
这是上个月（{{eventsMonth}}）用户曾经进行过的占卜和占卜事件。请你帮我整理成用户上个月发生的事情、询问过的内容、不要编造。
事件如下：
{{events}}

请你用纯文本的形式输出，不要加小标题。
`;

/**
 * 本月记忆压缩 Prompt
 * 用于整理本月的占卜记忆
 */
export const COMPRESS_CURRENT_MONTH_MEMORIES_PROMPT = `
这是这个月（{{eventsThisMonth}}）用户曾经进行过的占卜和占卜事件。请你帮我整理成用户这个月发生的事情、询问过的内容、不要编造。
事件如下：
{{events}}

请你用纯文本的形式输出，不要加小标题。
`;

// ==========================================
// SECTION 3: PROCESSING FUNCTIONS
// ==========================================

/**
 * 替换 Prompt 模板中的占位符
 * @param template - Prompt 模板字符串
 * @param placeholders - 占位符键值对，如 { events: "...", eventsMonth: "2025年11月" }
 * @returns 替换后的 Prompt 字符串
 *
 * @example
 * const prompt = replacePlaceholders(
 *   "这是{{month}}的数据：{{data}}",
 *   { month: "十一月", data: "内容" }
 * );
 */
export function replacePlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value || "");
  }
  return result;
}

/**
 * 清理 XML 格式的 Stage 1 facts
 * 提取 personRelatedContent 和 userSelfContent，过滤空内容
 *
 * @param facts - XML 格式的 facts 字符串
 * @returns 清理后的纯文本 facts
 *
 * @example
 * const cleaned = cleanFactsXml(`
 *   <facts>
 *     <personRelatedContent>用户提到了小明</personRelatedContent>
 *     <userSelfContent>未提及与具体人物无关的自身情况，此部分为空。</userSelfContent>
 *   </facts>
 * `);
 * // 返回: "用户提到了小明"
 */
export function cleanFactsXml(facts: string): string {
  // 提取 <facts> 标签内容
  const factsMatch = facts.match(/<facts>([\s\S]*?)<\/facts>/i);
  if (!factsMatch) {
    return facts.trim(); // 如果没有 facts 标签，返回原文
  }

  const factsContent = factsMatch[1];
  const parts: string[] = [];

  // 提取 personRelatedContent
  const personMatch = factsContent.match(/<personRelatedContent>([\s\S]*?)<\/personRelatedContent>/i);
  if (personMatch && personMatch[1].trim()) {
    parts.push(personMatch[1].trim());
  }

  // 提取 userSelfContent（跳过"未提及"的情况）
  const selfMatch = factsContent.match(/<userSelfContent>([\s\S]*?)<\/userSelfContent>/i);
  if (selfMatch && selfMatch[1].trim()) {
    const selfContent = selfMatch[1].trim();
    if (!selfContent.includes('未提及') && !selfContent.includes('此部分为空')) {
      parts.push(selfContent);
    }
  }

  return parts.join('\n\n').trim();
}

/**
 * 生成模拟日期（每天3条记忆）
 * @param index - 记忆索引（从0开始）
 * @param baseDate - 基准日期
 * @returns 格式化的中文日期字符串，如 "2025年11月01日"
 *
 * @example
 * const baseDate = new Date(2025, 10, 1); // 2025年11月1日
 * getSimulatedDate(0, baseDate);  // "2025年11月01日"
 * getSimulatedDate(3, baseDate);  // "2025年11月02日" (第二天)
 * getSimulatedDate(6, baseDate);  // "2025年11月03日" (第三天)
 */
export function getSimulatedDate(index: number, baseDate: Date): string {
  const date = new Date(baseDate);
  // 每3条记忆对应1天
  const daysToAdd = Math.floor(index / 3);
  date.setDate(date.getDate() + daysToAdd);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}年${month}月${day}日`;
}

/**
 * 获取月份字符串
 * @param date - 日期对象
 * @returns 格式化的中文月份字符串，如 "2025年11月"
 *
 * @example
 * const date = new Date(2025, 10, 15);
 * getMonthString(date);  // "2025年11月"
 */
export function getMonthString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}年${month}月`;
}
