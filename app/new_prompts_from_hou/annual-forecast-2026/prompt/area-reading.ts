import type { PromptLang } from './types'
import type { AreaReadingPromptOptions } from './types'
import { getUserLabels } from './constants'

/**
 * 年度运势 - 六大领域解读 Prompt
 * 用于在已有 12 个月运势的基础上，对单个领域做 1 张牌的深度解读
 */
export const annualForecast2026AreaPrompt: PromptLang<AreaReadingPromptOptions> = {
  cn(ctx) {
    const { area, cardContent, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('cn', userInfo)

    return `你需要帮我进行塔罗占卜。帮我输出年度运势的内容，之前你已经输出完12个月的运势了，现在我希望你输出的是单个领域「${area}」的内容。

我抽到的塔罗牌是：

${cardContent}

## 注意
- 可以先解释这张牌核心是什么，在${area}这个位置抽到这张牌意味着什么。不要使用比喻。
- 如果抽到的牌很好，可以在开头进行强调！在结尾进行总结和祝福。
- 对${area}做出细致的分析说明。
- 如果抽到坏牌，需要注入希望。比如可以在结尾跟用户说怎么做可以让这个领域的运势变好，转逆为安。
注入希望指的是**只要做了这些行动**，那么就**一定会好起来**！

## 语气风格
1. 如果抽到坏牌，可以对用户做出共情猜测。
2. 请你深入但口语化地解读。用"你/我"第一人称对话，口语化，简短句。
3. 多停顿词（比如某种语气词、"我觉得"等）。但开头句里不要用停顿词。
4. 使用感性材料，如生活里的细节、感性素材是能唤起画面感、听觉感和情绪的材料。与抽象的概念相对，它通过具体、感性的内容影响听者。使用感性材料来展开抽象概念，让人不需要思考就能明白含义。
5. 不要描绘牌面内容。

## 如何写 hookSentence
1. 口语化，同时深入而直击核心。
2. 充满哲理。
3. 省略人称和主语。
4. 不要用比喻句。

输出格式：用 Json 格式输出
{
  "hookSentence": "一句话，≤30 字，强调该领域的主命题，用口语化，强代入感的口吻，省略人称和主语",
  "content": "解读结果，总字数不超过300字，可以分成2~3段",
  "summaryHighlight": "用来回答这一年在这个领域最值得记住的一句话，给可实操更具体的内容。30个字以内。"
}

### 我的背景资料如下：
- 身份类型：${careerLabel}
- 性别：${genderLabel}
- 感情状态：${loveLabel}

## 「事业·学业」需要根据身份类型自动调整重点：
学生：偏向课程、考试、升学、未来规划
非学生：偏向工作项目、职业选择、身份切换

## 「财富」需要根据身份类型自动调整重点：
- 只有该牌很明显是关于金钱的牌，才需要进行解读。此外，注意一月、二月、十二月的金钱流动。
区分学生和非学生：学生支出时偏向叙述花钱，而不是投资

`
  },

  tc(ctx) {
    const { area, cardContent, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('tc', userInfo)

    return `你需要幫我進行塔羅占卜。幫我輸出年度運勢的內容，之前你已經輸出完12個月的運勢了，現在我希望你輸出的是單個領域「${area}」的內容。

我抽到的塔羅牌是：

${cardContent}

## 注意
- 可以先解釋這張牌核心是什麼，在${area}這個位置抽到這張牌意味著什麼。不要使用比喻。
- 如果抽到的牌很好，可以在開頭進行強調！在結尾進行總結和祝福。
- 對${area}做出細緻的分析說明。
- 如果抽到壞牌，需要注入希望。比如可以在結尾跟用戶說怎麼做可以讓這個領域的運勢變好，轉逆為安。
注入希望指的是**只要做了這些行動**，那麼就**一定會好起來**！

## 語氣風格
1. 如果抽到壞牌，可以對用戶做出共情猜測。
2. 請你深入但口語化地解讀。用「你/我」第一人稱對話，口語化，簡短句。
3. 多停頓詞（比如某種語氣詞、「我覺得」等）。但開頭句裡不要用停頓詞。
4. 使用感性材料，如生活裡的細節、感性素材是能喚起畫面感、聽覺感和情緒的材料。與抽象的概念相對，它通過具體、感性的內容影響聽者。使用感性材料來展開抽象概念，讓人不需要思考就能明白含義。
5. 不要描繪牌面內容。
6. 使用繁體中文。

## 如何寫 hookSentence
1. 口語化，同時深入而直擊核心。
2. 充滿哲理。
3. 省略人稱和主語。
4. 不要用比喻句。

輸出格式：用 Json 格式輸出
{
  "hookSentence": "一句話，≤30 字，強調該領域的主命題，用口語化，強代入感的口吻，省略人稱和主語",
  "content": "解讀結果，總字數不超過300字，可以分成2~3段",
  "summaryHighlight": "用來回答這一年在這個領域最值得記住的一句話，給可實操更具體的內容。30個字以內。"
}

### 我的背景資料如下：
- 身份類型：${careerLabel}
- 性別：${genderLabel}
- 感情狀態：${loveLabel}

## 「事業·學業」需要根據身份類型自動調整重點：
學生：偏向課程、考試、升學、未來規劃
非學生：偏向工作項目、職業選擇、身份切換

## 「財富」需要根據身份類型自動調整重點：
- 只有該牌很明顯是關於金錢的牌，才需要進行解讀。此外，注意一月、二月、十二月的金錢流動。
區分學生和非學生：學生支出時偏向敘述花錢，而不是投資

`
  },

  en(ctx) {
    const { area, cardContent, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('en', userInfo)

    return `Please help me with tarot reading. I need you to output the annual fortune content. You've already completed the 12 monthly fortunes, now I want you to output the content for the single area "${area}".

The tarot card I drew is:

${cardContent}

## Notes
- Start by explaining the core meaning of this card and what it means to draw this card in the "${area}" position. Don't use metaphors.
- If the card is very good, emphasize it at the beginning! Summarize and bless at the end.
- Provide detailed analysis for ${area}.
- If a challenging card is drawn, inject hope. For example, at the end, tell the user what actions can improve this area's fortune, turning the situation around.
Injecting hope means **as long as these actions are taken**, things **will definitely improve**!

## Tone and Style
1. If a challenging card is drawn, show empathy toward the user.
2. Provide deep but conversational interpretations. Use first-person dialogue ("you/I"), keep it casual with short sentences.
3. Use thinking words (like filler words, "I think", etc.). But don't use them in the opening sentence.
4. Use emotional materials, like life details - materials that evoke imagery, sounds, and emotions. As opposed to abstract concepts, they influence listeners through concrete, emotional content. Use emotional materials to unfold abstract concepts so people can understand without thinking.
5. Don't describe the card imagery.
6. Use ${ctx.lang} as the output language.

## How to write hookSentence
1. Conversational, yet deep and hitting the core.
2. Full of philosophy.
3. Omit pronouns and subjects.
4. Don't use metaphors.

Output format in JSON:
{
  "hookSentence": "One sentence, ≤40 characters, emphasizing the main theme of this area, conversational with strong immersion, omitting pronouns and subjects",
  "content": "Interpretation results, no more than 250 words total, can be divided into 2-3 paragraphs",
  "summaryHighlight": "A sentence answering what's most worth remembering this year in this area, with actionable and specific content. Under 50 characters."
}

### My background information:
- Identity type: ${careerLabel}
- Gender: ${genderLabel}
- Relationship status: ${loveLabel}

## "Career & Studies" should auto-adjust focus based on identity type:
Students: Focus on courses, exams, advancement, future planning
Non-students: Focus on work projects, career choices, role transitions

## "Wealth" should auto-adjust focus based on identity type:
- Only interpret if the card clearly relates to money. Also note money flow in January, February, and December.
Distinguish students from non-students: Students' spending focuses on expenses rather than investments

`
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
