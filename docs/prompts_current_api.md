# Prompts Current API 文档

## 概述

`prompts_current.ts` 提供了三个主要的 Prompt 模板，用于记忆提取和压缩功能。

---

## 1. Stage 1 XML 格式提取

### Prompt 名称
`EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts`

### 用途
从塔罗对话中提取用户的事实性记忆（只记录用户说的，不记录塔罗师说的）

### 输入参数
```typescript
{
  this_session_raw: string  // 用户和塔罗师的完整对话内容
}
```

### 输出格式
```xml
<facts>
  <personRelatedContent>涉及具体人物的事件（如果有多个人物需分段）</personRelatedContent>
  <userSelfContent>用户自身情况（如无则输出"未提及与具体人物无关的自身情况，此部分为空。"）</userSelfContent>
</facts>

<topicArea>感情/事业/学业/生活/运势/决策/自我成长（选其一）</topicArea>

<topicSummary>10个字的具体内容概括</topicSummary>
```

### 后端需要提取的字段
- `facts` 标签内的 `personRelatedContent` 和 `userSelfContent`
- `topicArea` - 主题分类
- `topicSummary` - 主题摘要

### 后处理
使用 `cleanFactsXml()` 函数清理：
- 提取 `<personRelatedContent>` 和 `<userSelfContent>` 内容
- 过滤掉"未提及"、"此部分为空"等空内容
- 返回纯文本格式（两部分用双换行分隔）

### 输入输出示例

**输入：**
```typescript
{
  this_session_raw: `
用户：最近我和男朋友小明总是吵架，我不知道该怎么办
塔罗师：让我为你抽一张牌看看
用户：我们上周因为他忘记我的生日吵了一架，他说工作太忙了
塔罗师：愚者正位，这代表需要以开放的心态沟通...
用户：我最近工作压力也很大，经常加班到很晚
  `
}
```

**AI 输出：**
```xml
<facts>
<personRelatedContent>用户有一个男朋友叫小明，两人最近总是吵架。上周因为小明忘记用户的生日而吵了一架，小明表示是因为工作太忙。</personRelatedContent>
<userSelfContent>用户最近工作压力很大，经常加班到很晚。</userSelfContent>
</facts>

<topicArea>感情</topicArea>

<topicSummary>与男友小明吵架</topicSummary>
```

**经过 `cleanFactsXml()` 处理后：**
```
用户有一个男朋友叫小明，两人最近总是吵架。上周因为小明忘记用户的生日而吵了一架，小明表示是因为工作太忙。

用户最近工作压力很大，经常加班到很晚。
```

---

## 2. 上月记忆压缩

### Prompt 名称
`COMPRESS_MONTHLY_MEMORIES_PROMPT`

### 用途
整理用户上个月的占卜记忆成连贯文本

### 输入参数
```typescript
{
  events: string,        // 上月所有占卜事件（多条）
  eventsMonth: string    // 如 "2025年11月"
}
```

### 输出格式
纯文本格式，无小标题，自然段落叙述用户上月发生的事情和询问的内容

### 后端需要提取的字段
直接使用整个输出文本

### 输入输出示例

**输入：**
```typescript
{
  events: `
2025年11月01日 - 用户询问了与男友小明的感情问题，最近总是吵架。
2025年11月05日 - 用户咨询了工作晋升的机会，考虑是否要跳槽。
2025年11月12日 - 用户询问了考研复习的进展，担心时间不够。
2025年11月20日 - 用户再次咨询感情问题，和小明的关系有所缓和。
  `,
  eventsMonth: "2025年11月"
}
```

**AI 输出：**
```
用户在11月主要关注感情和事业发展。感情方面，用户与男友小明在月初经常吵架，但到月底关系有所缓和。事业方面，用户在考虑跳槽和晋升的机会。同时用户也在准备考研，对复习进度感到担忧，担心时间不够用。
```

---

## 3. 本月记忆压缩

### Prompt 名称
`COMPRESS_CURRENT_MONTH_MEMORIES_PROMPT`

### 用途
整理用户本月的占卜记忆成连贯文本

### 输入参数
```typescript
{
  events: string,           // 本月所有占卜事件（多条）
  eventsThisMonth: string   // 如 "2025年12月"
}
```

### 输出格式
纯文本格式，无小标题，自然段落叙述用户本月发生的事情和询问的内容

### 后端需要提取的字段
直接使用整个输出文本

### 输入输出示例

**输入：**
```typescript
{
  events: `
2025年12月03日 - 用户询问了年终奖的预期，不确定公司会发多少。
2025年12月10日 - 用户咨询了过年是否要回老家的问题，担心疫情影响。
2025年12月15日 - 用户询问了新年计划，想要减肥和学习新技能。
  `,
  eventsThisMonth: "2025年12月"
}
```

**AI 输出：**
```
用户这个月关注年终相关事宜。用户对年终奖的金额有所期待但不确定公司会发多少。用户在考虑过年是否回老家，担心疫情可能带来的影响。此外，用户已经开始规划新年计划，希望能够减肥并学习新的技能。
```

---

## 辅助函数

### `replacePlaceholders(template, placeholders)`
替换 Prompt 模板中的 `{{key}}` 占位符

**示例：**
```typescript
const prompt = replacePlaceholders(
  COMPRESS_MONTHLY_MEMORIES_PROMPT,
  { 
    events: "用户询问了感情问题...", 
    eventsMonth: "2025年11月" 
  }
);
```

### `cleanFactsXml(facts)`
清理 Stage 1 输出的 XML 格式，提取纯文本内容

**示例：**
```typescript
const cleaned = cleanFactsXml(xmlOutput);
// 返回: "用户提到了小明\n\n用户最近压力较大"
```

### `getSimulatedDate(index, baseDate)`
生成模拟日期（每3条记忆对应1天）

**示例：**
```typescript
getSimulatedDate(0, new Date(2025, 10, 1));  // "2025年11月01日"
getSimulatedDate(3, new Date(2025, 10, 1));  // "2025年11月02日"
```

### `getMonthString(date)`
获取月份字符串

**示例：**
```typescript
getMonthString(new Date(2025, 10, 15));  // "2025年11月"
```

---

## 使用流程

### 典型场景：提取用户对话记忆

1. **替换占位符**
   ```typescript
   const prompt = replacePlaceholders(
     EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts,
     { this_session_raw: "对话内容..." }
   );
   ```

2. **发送给 AI 获取 XML 输出**

3. **清理 XML 格式**
   ```typescript
   const cleanedFacts = cleanFactsXml(aiResponse);
   ```

4. **提取其他字段**
   ```typescript
   const topicArea = aiResponse.match(/<topicArea>(.*?)<\/topicArea>/)?.[1];
   const topicSummary = aiResponse.match(/<topicSummary>(.*?)<\/topicSummary>/)?.[1];
   ```

5. **存储结构化数据**
   ```typescript
   {
     facts: cleanedFacts,
     topicArea: topicArea,
     topicSummary: topicSummary,
     date: getSimulatedDate(index, baseDate)
   }
   ```

---

## 注意事项

1. **Stage 1 提取原则**
   - 只记录用户明确说的事实，不做推测
   - 塔罗师的解读不算事实
   - 不同人物需要分段记录

2. **月度压缩原则**
   - 输出纯文本，不要添加小标题或格式化
   - 不编造内容，只整理已有事件

3. **字数限制**
   - Stage 1 facts 上限 2000 字

4. **XML 清理**
   - 自动过滤"未提及"、"此部分为空"等空白内容
   - 保留实质性的用户信息

