import type { PromptLang } from './types'
import type { ClosingPromptOptions } from './types'

/**
 * 年度运势 - 结尾总结语 Prompt
 * 用于生成结尾收束 + 年末 anchor 一句话
 */
export const annualForecast2026ClosingPrompt: PromptLang<ClosingPromptOptions> = {
  cn(ctx) {
    const { overviewText, yearSummary, areaInfoText } = ctx

    return `请你根据我之前的年度运势，给我一个总结语。这个总结语是预测明年运势的。

我抽到的12张牌如下：

${overviewText}

年运总结：

${yearSummary}

我在六个领域的年度解读如下（纯文本）：

${areaInfoText}

## 总结语包括：
- 结尾收束
- 年末 anchor 一句话：≤30 字，可加粗，用作整份报告的情绪收束
  * 结尾总结段落：约 120–180 字，包含：
    * 这一年最重要的1个或者2个主线主题，用"/"分隔
    * 如果顺着这条发展线往下走，年末的自己大致处在什么状态

## 注意
- 请你注意时态，现在是在26年还没开始时进行下一年的运势的预测。
- 语气要有希望感。

请你使用 Json 格式输出，字段为：
{
  "anchorSentence": "≤30 字，整年的情绪收束句子，可以使用**加粗**包裹整句话（不需要再出现 explain 等前缀）",
  "closingParagraph": "120-180 字的结尾总结段落，口吻口语化、有亲和力，多用"你""我看到""
}

注意：你只需要输出上述 Json 对象本身，不需要额外说明文字。`
  },

  tc(ctx) {
    const { overviewText, yearSummary, areaInfoText } = ctx

    return `請你根據我之前的年度運勢，給我一個總結語。這個總結語是預測明年運勢的。

我抽到的12張牌如下：

${overviewText}

年運總結：

${yearSummary}

我在六個領域的年度解讀如下（純文本）：

${areaInfoText}

## 總結語包括：
- 結尾收束
- 年末 anchor 一句話：≤30 字，可加粗，用作整份報告的情緒收束
  * 結尾總結段落：約 120–180 字，包含：
    * 這一年最重要的1個或者2個主線主題，用「/」分隔
    * 如果順著這條發展線往下走，年末的自己大致處在什麼狀態

## 注意
- 請你注意時態，現在是在26年還沒開始時進行下一年的運勢的預測。
- 語氣要有希望感。
- 使用繁體中文。

請你使用 Json 格式輸出，字段為：
{
  "anchorSentence": "≤30 字，整年的情緒收束句子，可以使用**加粗**包裹整句話（不需要再出現 explain 等前綴）",
  "closingParagraph": "120-180 字的結尾總結段落，口吻口語化、有親和力，多用「你」「我看到」"
}

注意：你只需要輸出上述 Json 對象本身，不需要額外說明文字。`
  },

  en(ctx) {
    const { overviewText, yearSummary, areaInfoText } = ctx

    return `Based on my previous annual fortune, please give me a closing statement. This closing statement is a prediction for next year's fortune.

The 12 cards I drew are as follows:

${overviewText}

Annual fortune summary:

${yearSummary}

My annual interpretations for the six areas (plain text):

${areaInfoText}

## Closing statement includes:
- Ending wrap-up
- Year-end anchor sentence: ≤40 characters, can be bolded, used as the emotional closure for the entire report
  * Closing summary paragraph: about 100-150 words, containing:
    * The 1 or 2 most important main themes of the year, separated by "/"
    * If following this development trajectory, what state you'll roughly be in at year's end

## Notes
- Pay attention to tense - we are predicting next year's fortune before 2026 has started.
- Maintain a hopeful tone.
- Use ${ctx.lang} as the output language.

Please output in JSON format with the following fields:
{
  "anchorSentence": "≤40 characters, an emotional closure sentence for the whole year, can use **bold** to wrap the entire sentence (no need for 'explain' or other prefixes)",
  "closingParagraph": "100-150 word closing summary paragraph, conversational and friendly tone, use 'you' and 'I see' often"
}

Note: You only need to output the JSON object itself, no additional explanatory text.`
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
