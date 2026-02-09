import type { PromptLang } from './types'
import type { AreaRadarPromptOptions } from './types'

/**
 * 年度运势 - 六大领域雷达图评分 Prompt
 * 用于根据每个领域的 hookSentence / content / summaryHighlight 进行 0~100 打分
 */
export const annualForecast2026RadarPrompt: PromptLang<AreaRadarPromptOptions> = {
  cn(ctx) {
    const { areaInfoText } = ctx

    return `请你根据我的六大领域抽到的牌和运势，告诉我，我每个领域的运势指数大概是多少？（0~100评分）

## 六大领域的运势解读如下
${areaInfoText}

## 然后请你：
- 请你根据我的六大领域运势，给我一个适合它们的开头段落。放在 startingOverview 里。
- 第一句可以隐喻用户的整组牌的重点，可以指出六大领域共通模式。
- 这个段落需要对六大领域做出一定的点评。
- 不要使用比喻句。平铺直叙即可。
- 可以适当结合输出的各领域得分，去猜测用户希望看到什么样的开头。
- 在 startingOverview 结尾，可以引出接下来会说的六大领域的详细内容。
- 口吻口语化，保持轻松，多用"你"、"我看到"。
- 100字左右。

输出格式，用 Json 格式输出：

{
  "analysis": "分析各个领域运势是大概多少分。",
  "love": "爱情运势得分（int，0~100）",
  "career": "事业与学业运势得分（int，0~100）",
  "wealth": "财富与金钱运势得分（int，0~100）",
  "health": "健康与身心状态得分（int，0~100）",
  "social": "人际关系与社交氛围得分（int，0~100）",
  "innerGrowth": "内在成长与心理能量得分（int，0~100）",
  "startingOverview": "六大领域的整体总览，100字左右。总结性发言，放在六大领域的开头。"
}`
  },

  tc(ctx) {
    const { areaInfoText } = ctx

    return `請你根據我的六大領域抽到的牌和運勢，告訴我，我每個領域的運勢指數大概是多少？（0~100評分）

## 六大領域的運勢解讀如下
${areaInfoText}

## 然後請你：
- 請你根據我的六大領域運勢，給我一個適合它們的開頭段落。放在 startingOverview 裡。
- 第一句可以隱喻用戶的整組牌的重點，可以指出六大領域共通模式。
- 這個段落需要對六大領域做出一定的點評。
- 不要使用比喻句。平鋪直敘即可。
- 可以適當結合輸出的各領域得分，去猜測用戶希望看到什麼樣的開頭。
- 在 startingOverview 結尾，可以引出接下來會說的六大領域的詳細內容。
- 口吻口語化，保持輕鬆，多用「你」、「我看到」。
- 100字左右。
- 使用繁體中文。

輸出格式，用 Json 格式輸出：

{
  "analysis": "分析各個領域運勢是大概多少分。",
  "love": "愛情運勢得分（int，0~100）",
  "career": "事業與學業運勢得分（int，0~100）",
  "wealth": "財富與金錢運勢得分（int，0~100）",
  "health": "健康與身心狀態得分（int，0~100）",
  "social": "人際關係與社交氛圍得分（int，0~100）",
  "innerGrowth": "內在成長與心理能量得分（int，0~100）",
  "startingOverview": "六大領域的整體總覽，100字左右。總結性發言，放在六大領域的開頭。"
}`
  },

  en(ctx) {
    const { areaInfoText } = ctx

    return `Based on the cards I drew and fortunes for my six life areas, please tell me what my fortune index is for each area (0-100 rating)?

## Six life areas fortune interpretations
${areaInfoText}

## Then please:
- Based on my six areas' fortunes, give me an appropriate opening paragraph. Put it in startingOverview.
- The first sentence can hint at the key theme of the user's card set, pointing out common patterns across the six areas.
- This paragraph should provide some commentary on the six areas.
- Don't use metaphors. Keep it straightforward.
- You can appropriately combine the output scores for each area to guess what kind of opening the user hopes to see.
- At the end of startingOverview, you can introduce the detailed content of the six areas that will follow.
- Keep the tone conversational and relaxed, use "you" and "I see" often.
- About 80-100 words.
- Use ${ctx.lang} as the output language.

Output format in JSON:

{
  "analysis": "Analyze what score each area's fortune is approximately.",
  "love": "Love fortune score (int, 0-100)",
  "career": "Career and studies fortune score (int, 0-100)",
  "wealth": "Wealth and money fortune score (int, 0-100)",
  "health": "Health and wellness score (int, 0-100)",
  "social": "Social connections and atmosphere score (int, 0-100)",
  "innerGrowth": "Inner growth and psychological energy score (int, 0-100)",
  "startingOverview": "Overall overview of the six areas, about 80-100 words. A summary statement placed at the beginning of the six areas section."
}`
  },

  ja(ctx) {
    return this.en(ctx)
  },

  ko(ctx) {
    return this.en(ctx)
  },

  es(ctx) {
    return this.en(ctx)
  },
}
