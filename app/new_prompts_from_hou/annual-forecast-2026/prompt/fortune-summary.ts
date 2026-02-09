import type { PromptLang } from './types'
import type { FortuneSummaryPromptOptions } from './types'
import { MONTH_NAMES, getUserLabels, NOT_PROVIDED } from './constants'

/**
 * 获取领域名称（根据职业状态）
 */
function getCareerAreaName(lang: 'cn' | 'tc' | 'en', careerStatus?: string): string {
  const isStudent = careerStatus === 'middle_high_school' || careerStatus === 'college_above'
  const names = {
    cn: isStudent ? '学业' : '事业',
    tc: isStudent ? '學業' : '事業',
    en: isStudent ? 'studies' : 'career',
  }
  return names[lang]
}

/**
 * 年度运势 - 年度总览 Prompt
 * 用于生成年度运势总览和月度评分
 */
export const annualForecast2026SummaryPrompt: PromptLang<FortuneSummaryPromptOptions> = {
  cn(ctx) {
    const { monthlyContents, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('cn', userInfo)
    const careerAreaName = getCareerAreaName('cn', userInfo.careerStatus)

    const monthlyFortunes = monthlyContents
      .map((content, index) => {
        const monthName = MONTH_NAMES.cn[index]
        return `${monthName}运势：\n${content}`
      })
      .join('\n\n')

    return `请你根据我的12个月抽到的牌和运势，告诉我，我每个月的运势指数大概是多少？（0~100评分）

${monthlyFortunes}
## 如何写hookStarting
- 要传递希望感，邀请用户进入新的一年的感觉。
- 第一句可以隐喻用户的整组牌的重点，可以指出模式。比如"...的事情会如你所愿"。
- 第二句可以指出方向的转变、转折点。
- 第三局可以邀请用户看每个月细节运势。
- 不要使用比喻句，太土了。
- 要稍微设置悬念。

## 如何写 summary
- 注意时态，现在是在抽取将要发生的年运的运势，所以是将来时。

用户基本资料如下：
- 昵称：${userInfo.nickname || NOT_PROVIDED.cn}
- 身份类型：${careerLabel}
- 性别：${genderLabel}
- 感情状态：${loveLabel}

输出格式，用 Json 格式输出：

{
  "analysis": "分析整体运势走向，以及各个月的运势大概是多少分。",
  "hookStarting": "放在年运的开头段落，引人入胜的一小段口语化内容，引出下面12个月运势。",
  "summary": "对全年运势和关键变化的预测的总结。口吻口语化而有亲和力，多用"你"、"我看到"。注意时态是将来时。在summary结尾可以引出后面还有六个细分领域（感情、${careerAreaName}、财富、健康与身心状态、人际关系与社交氛围、内在成长与心理能量）的运势，引导用户抽牌。",
  "January": "一月运势得分（int 格式，0~100）",
  "February": "二月运势得分（int 格式，0~100）",
  "March": "三月运势得分（int 格式，0~100）",
  "April": "四月运势得分（int 格式，0~100）",
  "May": "五月运势得分（int 格式，0~100）",
  "June": "六月运势得分（int 格式，0~100）",
  "July": "七月运势得分（int 格式，0~100）",
  "August": "八月运势得分（int 格式，0~100）",
  "September": "九月运势得分（int 格式，0~100）",
  "October": "十月运势得分（int 格式，0~100）",
  "November": "十一月运势得分（int 格式，0~100）",
  "December": "十二月运势得分（int 格式，0~100）"
}`
  },

  tc(ctx) {
    const { monthlyContents, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('tc', userInfo)
    const careerAreaName = getCareerAreaName('tc', userInfo.careerStatus)

    const monthlyFortunes = monthlyContents
      .map((content, index) => {
        const monthName = MONTH_NAMES.tc[index]
        return `${monthName}運勢：\n${content}`
      })
      .join('\n\n')

    return `請你根據我的12個月抽到的牌和運勢，告訴我，我每個月的運勢指數大概是多少？（0~100評分）

${monthlyFortunes}
## 如何寫hookStarting
- 要傳遞希望感，邀請用戶進入新的一年的感覺。
- 第一句可以隱喻用戶的整組牌的重點，可以指出模式。比如「...的事情會如你所願」。
- 第二句可以指出方向的轉變、轉折點。
- 第三句可以邀請用戶看每個月細節運勢。
- 不要使用比喻句，太土了。
- 要稍微設置懸念。

## 如何寫 summary
- 注意時態，現在是在抽取將要發生的年運的運勢，所以是將來時。
- 使用繁體中文。

用戶基本資料如下：
- 暱稱：${userInfo.nickname || NOT_PROVIDED.tc}
- 身份類型：${careerLabel}
- 性別：${genderLabel}
- 感情狀態：${loveLabel}

輸出格式，用 Json 格式輸出：

{
  "analysis": "分析整體運勢走向，以及各個月的運勢大概是多少分。",
  "hookStarting": "放在年運的開頭段落，引人入勝的一小段口語化內容，引出下面12個月運勢。",
  "summary": "對全年運勢和關鍵變化的預測的總結。口吻口語化而有親和力，多用「你」、「我看到」。注意時態是將來時。在summary結尾可以引出後面還有六個細分領域（感情、${careerAreaName}、財富、健康與身心狀態、人際關係與社交氛圍、內在成長與心理能量）的運勢，引導用戶抽牌。",
  "January": "一月運勢得分（int 格式，0~100）",
  "February": "二月運勢得分（int 格式，0~100）",
  "March": "三月運勢得分（int 格式，0~100）",
  "April": "四月運勢得分（int 格式，0~100）",
  "May": "五月運勢得分（int 格式，0~100）",
  "June": "六月運勢得分（int 格式，0~100）",
  "July": "七月運勢得分（int 格式，0~100）",
  "August": "八月運勢得分（int 格式，0~100）",
  "September": "九月運勢得分（int 格式，0~100）",
  "October": "十月運勢得分（int 格式，0~100）",
  "November": "十一月運勢得分（int 格式，0~100）",
  "December": "十二月運勢得分（int 格式，0~100）"
}`
  },

  en(ctx) {
    const { monthlyContents, userInfo } = ctx
    const { genderLabel, careerLabel, loveLabel } = getUserLabels('en', userInfo)
    const careerAreaName = getCareerAreaName('en', userInfo.careerStatus)

    const monthlyFortunes = monthlyContents
      .map((content, index) => {
        const monthName = MONTH_NAMES.en[index]
        return `${monthName} Fortune:\n${content}`
      })
      .join('\n\n')

    return `Based on my 12 monthly cards and fortunes, please tell me what my fortune index is for each month (0-100 rating)?

${monthlyFortunes}
## How to write hookStarting
- Convey a sense of hope, inviting the user into the new year.
- The first sentence can hint at the key theme of the user's card set, pointing out patterns. For example, "...things will go as you wish."
- The second sentence can point out changes in direction or turning points.
- The third sentence can invite the user to see each month's detailed fortune.
- Don't use metaphors - they're outdated.
- Create a bit of suspense.

## How to write summary
- Pay attention to tense - we are predicting future annual fortune, so use future tense.
- Use ${ctx.lang} as the output language.

User information:
- Nickname: ${userInfo.nickname || NOT_PROVIDED.en}
- Identity type: ${careerLabel}
- Gender: ${genderLabel}
- Relationship status: ${loveLabel}

Output format in JSON:

{
  "analysis": "Analyze the overall fortune trend and approximately how many points each month's fortune is.",
  "hookStarting": "An engaging conversational paragraph at the beginning of the annual fortune, introducing the 12 monthly fortunes below.",
  "summary": "A summary of the full year's fortune and key change predictions. Keep it conversational and friendly, use 'you' and 'I see' often. Use future tense. At the end of summary, introduce that there are six more detailed areas (love, ${careerAreaName}, wealth, health & wellness, social connections, inner growth & psychological energy) coming up, guiding the user to draw cards.",
  "January": "January fortune score (int format, 0-100)",
  "February": "February fortune score (int format, 0-100)",
  "March": "March fortune score (int format, 0-100)",
  "April": "April fortune score (int format, 0-100)",
  "May": "May fortune score (int format, 0-100)",
  "June": "June fortune score (int format, 0-100)",
  "July": "July fortune score (int format, 0-100)",
  "August": "August fortune score (int format, 0-100)",
  "September": "September fortune score (int format, 0-100)",
  "October": "October fortune score (int format, 0-100)",
  "November": "November fortune score (int format, 0-100)",
  "December": "December fortune score (int format, 0-100)"
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
