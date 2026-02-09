import type { LoveStatusType } from './types'

type Lang = 'cn' | 'tc' | 'en' | 'ja' | 'ko' | 'es'

/**
 * 月份名称
 */
export const MONTH_NAMES: Record<Lang, string[]> = {
  cn: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  tc: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ja: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ko: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

/**
 * 性别标签
 */
export const GENDER_LABELS: Record<Lang, Record<string, string>> = {
  cn: { female: '女', male: '男', other: '其他' },
  tc: { female: '女', male: '男', other: '其他' },
  en: { female: 'Female', male: 'Male', other: 'Other' },
  ja: { female: 'Female', male: 'Male', other: 'Other' },
  ko: { female: 'Female', male: 'Male', other: 'Other' },
  es: { female: 'Female', male: 'Male', other: 'Other' },
}

/**
 * 职业状态标签
 */
export const CAREER_STATUS_LABELS: Record<Lang, Record<string, string>> = {
  cn: {
    worker: '上班族',
    freelance: '自由职业',
    college_above: '大学生及以上',
    middle_high_school: '初高中学生',
  },
  tc: {
    worker: '上班族',
    freelance: '自由職業',
    college_above: '大學生及以上',
    middle_high_school: '初高中學生',
  },
  en: {
    worker: 'Office worker',
    freelance: 'Freelancer',
    college_above: 'College student or above',
    middle_high_school: 'High school student',
  },
  ja: {
    worker: 'Office worker',
    freelance: 'Freelancer',
    college_above: 'College student or above',
    middle_high_school: 'High school student',
  },
  ko: {
    worker: 'Office worker',
    freelance: 'Freelancer',
    college_above: 'College student or above',
    middle_high_school: 'High school student',
  },
  es: {
    worker: 'Office worker',
    freelance: 'Freelancer',
    college_above: 'College student or above',
    middle_high_school: 'High school student',
  },
}

/**
 * 感情状态标签
 */
export const LOVE_STATUS_LABELS: Record<Lang, Record<string, string>> = {
  cn: { single: '单身', in_relationship: '有对象', ambiguous: '暧昧中' },
  tc: { single: '單身', in_relationship: '有對象', ambiguous: '曖昧中' },
  en: { single: 'Single', in_relationship: 'In a relationship', ambiguous: "It's complicated" },
  ja: { single: 'Single', in_relationship: 'In a relationship', ambiguous: "It's complicated" },
  ko: { single: 'Single', in_relationship: 'In a relationship', ambiguous: "It's complicated" },
  es: { single: 'Single', in_relationship: 'In a relationship', ambiguous: "It's complicated" },
}

/**
 * 未提供标签
 */
export const NOT_PROVIDED: Record<Lang, string> = {
  cn: '（未提供）',
  tc: '（未提供）',
  en: '(Not provided)',
  ja: '(Not provided)',
  ko: '(Not provided)',
  es: '(Not provided)',
}

/**
 * 六大领域
 */
export const DOMAIN_AREAS: Record<Lang, { id: string; name: string }[]> = {
  cn: [
    { id: 'love', name: '感情' },
    { id: 'career', name: '事业·学业' },
    { id: 'wealth', name: '财富' },
    { id: 'health', name: '健康' },
    { id: 'social', name: '人际关系' },
    { id: 'innerGrowth', name: '内在成长' },
  ],
  tc: [
    { id: 'love', name: '感情' },
    { id: 'career', name: '事業·學業' },
    { id: 'wealth', name: '財富' },
    { id: 'health', name: '健康' },
    { id: 'social', name: '人際關係' },
    { id: 'innerGrowth', name: '內在成長' },
  ],
  en: [
    { id: 'love', name: 'Love & Relationships' },
    { id: 'career', name: 'Career & Studies' },
    { id: 'wealth', name: 'Wealth & Finance' },
    { id: 'health', name: 'Health & Wellness' },
    { id: 'social', name: 'Social & Connections' },
    { id: 'innerGrowth', name: 'Inner Growth' },
  ],
  ja: [
    { id: 'love', name: 'Love & Relationships' },
    { id: 'career', name: 'Career & Studies' },
    { id: 'wealth', name: 'Wealth & Finance' },
    { id: 'health', name: 'Health & Wellness' },
    { id: 'social', name: 'Social & Connections' },
    { id: 'innerGrowth', name: 'Inner Growth' },
  ],
  ko: [
    { id: 'love', name: 'Love & Relationships' },
    { id: 'career', name: 'Career & Studies' },
    { id: 'wealth', name: 'Wealth & Finance' },
    { id: 'health', name: 'Health & Wellness' },
    { id: 'social', name: 'Social & Connections' },
    { id: 'innerGrowth', name: 'Inner Growth' },
  ],
  es: [
    { id: 'love', name: 'Love & Relationships' },
    { id: 'career', name: 'Career & Studies' },
    { id: 'wealth', name: 'Wealth & Finance' },
    { id: 'health', name: 'Health & Wellness' },
    { id: 'social', name: 'Social & Connections' },
    { id: 'innerGrowth', name: 'Inner Growth' },
  ],
}

/**
 * 感情状态提示语生成器
 */
interface LoveStatusGuidanceGenerator {
  statusChangeNote: (timeInfo: string) => string
  guidance: (monthName: string, monthNumber: number) => string
}

type LoveStatusGuidanceMap = Record<'single' | 'ambiguous' | 'in_relationship', LoveStatusGuidanceGenerator>

export const LOVE_STATUS_GUIDANCE: Record<Lang, LoveStatusGuidanceMap> = {
  cn: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `因为用户是在${timeInfo}的时候，抽2026年的牌，所以如果月份到了下半年，用户的感情状态你需要结合牌来看是否会发生变化。并且解读要用将来时。`,
      guidance: (monthName: string, monthNumber: number) => `
## 关于感情方面怎么解读
- 不要总是提感情相关！只有纵览抽到的12张牌，这个月的牌特别暗示了感情方面的变化，才进行感情的解读。
如果浏览/纵览抽到的12张牌，需要进行感情解读，请按照以下步骤进行：
- 你需要结合牌意，来查看是否${monthName}会遇到用户心动的人，或者对用户心动的人。单身不意味着一直单身。
- 示例"因为你目前是/抽牌时/占卜时是单身，过了${monthNumber - 1}个月/结合牌意，到了${monthNumber}月，感情有可能出现一些变化。"
示例"你目前是单身，到时候可能遇到...，那么..."，或者"现在单身的你，到了${monthNumber}月，结合牌意，感情有可能出现一些变化。"
- 单身时的变化可以是遇到心动的人、或者被喜欢、或者进一步发展、或者维持关系。`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `因为用户是在${timeInfo}的时候，抽2026年的牌，所以如果月份到了下半年，用户的感情状态你需要结合牌来看是否会发生变化。比如下半年不可能还是在暧昧中了。解读要用将来时。`,
      guidance: (monthName: string, monthNumber: number) => `
## 关于感情方面怎么解读
- 不要总是提感情相关！只有纵览抽到的12张牌，这个月的牌特别暗示了感情方面的变化，才进行感情的解读。
如果浏览/纵览抽到的12张牌，需要进行感情解读，请按照以下步骤进行：

- 你可以想一想结合牌意后暧昧的状态会怎么变化？然后给用户解读。
- 到了下半年，就可以不去提及抽牌时是暧昧中了，而是说"如果...那么..."，因为下半年距离抽牌已经很远了。
- 暧昧中的用户，你需要结合牌意，来查看是否这个月会和用户心动的人有更进一步的发展，用户只是在抽牌时是暧昧，不意味着下一年的这个月份都一直暧昧。
- 示例"你目前/此时/抽牌时的感情状态是暧昧中，但结合牌意，到了 ${monthNumber}月，你们的关系可能出现一些变化。"，或者"如果到时候已经在一起/还在暧昧中..."`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `因为用户是在${timeInfo}的时候，抽2026年的牌，所以如果月份到了下半年，感情关系可能会进入不同阶段（磨合、稳定、推进、调整），需要结合牌面判断，解读时用将来时。`,
      guidance: (monthName: string, monthNumber: number) => `
## 关于有对象的用户怎么解读
- 不需要总是提感情相关。只有纵览抽到的12张牌，这个月的牌特别暗示了感情方面的变化，才进行解读。
- 关注关系阶段的可能变化：推进、磨合、稳定期的调整，或需要沟通的议题。
- 结合牌意判断当月是否适合推进更进一步（如见家长/同居/订婚）或需要放慢脚步调整节奏。
- 如果牌面暗示压力或冲突，可给出具体的沟通/边界建议；若暗示稳步推进，可提示共创计划或纪念性的事情。
- 示例："你抽牌时/此时是有对象，结合牌意，到了 ${monthNumber} 月你们可能会迎来【某种变化】，如果到时候状态平稳，可以考虑……；如果出现波动，可以这样调整……"`,
    },
  },
  tc: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `因為用戶是在${timeInfo}的時候，抽2026年的牌，所以如果月份到了下半年，用戶的感情狀態你需要結合牌來看是否會發生變化。並且解讀要用將來時。`,
      guidance: (monthName: string, monthNumber: number) => `
## 關於感情方面怎麼解讀
- 不要總是提感情相關！只有縱覽抽到的12張牌，這個月的牌特別暗示了感情方面的變化，才進行感情的解讀。
如果瀏覽/縱覽抽到的12張牌，需要進行感情解讀，請按照以下步驟進行：
- 你需要結合牌意，來查看是否${monthName}會遇到用戶心動的人，或者對用戶心動的人。單身不意味著一直單身。
- 示例「因為你目前是/抽牌時/占卜時是單身，過了${monthNumber - 1}個月/結合牌意，到了${monthNumber}月，感情有可能出現一些變化。」
示例「你目前是單身，到時候可能遇到...，那麼...」，或者「現在單身的你，到了${monthNumber}月，結合牌意，感情有可能出現一些變化。」
- 單身時的變化可以是遇到心動的人、或者被喜歡、或者進一步發展、或者維持關係。`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `因為用戶是在${timeInfo}的時候，抽2026年的牌，所以如果月份到了下半年，用戶的感情狀態你需要結合牌來看是否會發生變化。比如下半年不可能還是在曖昧中了。解讀要用將來時。`,
      guidance: (monthName: string, monthNumber: number) => `
## 關於感情方面怎麼解讀
- 不要總是提感情相關！只有縱覽抽到的12張牌，這個月的牌特別暗示了感情方面的變化，才進行感情的解讀。
如果瀏覽/縱覽抽到的12張牌，需要進行感情解讀，請按照以下步驟進行：

- 你可以想一想結合牌意後曖昧的狀態會怎麼變化？然後給用戶解讀。
- 到了下半年，就可以不去提及抽牌時是曖昧中了，而是說「如果...那麼...」，因為下半年距離抽牌已經很遠了。
- 曖昧中的用戶，你需要結合牌意，來查看是否這個月會和用戶心動的人有更進一步的發展，用戶只是在抽牌時是曖昧，不意味著下一年的這個月份都一直曖昧。
- 示例「你目前/此時/抽牌時的感情狀態是曖昧中，但結合牌意，到了 ${monthNumber}月，你們的關係可能出現一些變化。」，或者「如果到時候已經在一起/還在曖昧中...」`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `因為用戶是在${timeInfo}的時候，抽2026年的牌，所以如果月份到了下半年，感情關係可能會進入不同階段（磨合、穩定、推進、調整），需要結合牌面判斷，解讀時用將來時。`,
      guidance: (monthName: string, monthNumber: number) => `
## 關於有對象的用戶怎麼解讀
- 不需要總是提感情相關。只有縱覽抽到的12張牌，這個月的牌特別暗示了感情方面的變化，才進行解讀。
- 關注關係階段的可能變化：推進、磨合、穩定期的調整，或需要溝通的議題。
- 結合牌意判斷當月是否適合推進更進一步（如見家長/同居/訂婚）或需要放慢腳步調整節奏。
- 如果牌面暗示壓力或衝突，可給出具體的溝通/邊界建議；若暗示穩步推進，可提示共創計劃或紀念性的事情。
- 示例：「你抽牌時/此時是有對象，結合牌意，到了 ${monthNumber} 月你們可能會迎來【某種變化】，如果到時候狀態平穩，可以考慮……；如果出現波動，可以這樣調整……」`,
    },
  },
  en: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their relationship status might change based on the cards. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:
- Based on the card meanings, consider whether the user might meet someone special in ${monthName}. Being single doesn't mean staying single forever.
- Example: "Since you're currently single, after ${monthNumber - 1} months, by ${monthName}, there might be some changes in your love life based on the cards."
- Changes for single people could include: meeting someone special, being liked by someone, further development, or maintaining current status.`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their complicated situation might evolve. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:

- Think about how the ambiguous situation might evolve based on the card meanings, then interpret for the user.
- For the second half of the year, you can say "if... then..." since it's far from the drawing time.
- For users in a complicated situation, consider whether this month might bring further development with the person they're interested in.
- Example: "Your current relationship status is complicated, but based on the cards, by month ${monthNumber}, your relationship might experience some changes." or "If you're together/still figuring things out by then..."`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, the relationship might enter different phases (adjustment, stability, progression). Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret for users in relationships
- Don't always mention love aspects. Only interpret if the cards specifically suggest relationship changes.
- Focus on possible phase changes: progression, adjustment, stability shifts, or communication topics.
- Based on the cards, determine if this month is suitable for taking things further (meeting parents/moving in/engagement) or if it's better to slow down.
- If cards suggest pressure or conflict, provide specific communication/boundary advice; if they suggest steady progress, mention shared planning or commemorative activities.
- Example: "You're currently in a relationship. Based on the cards, by month ${monthNumber}, you might experience [certain changes]. If things are stable then, consider...; if there's turbulence, you can adjust by..."`,
    },
  },
  ja: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their relationship status might change based on the cards. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:
- Based on the card meanings, consider whether the user might meet someone special in ${monthName}. Being single doesn't mean staying single forever.
- Example: "Since you're currently single, after ${monthNumber - 1} months, by ${monthName}, there might be some changes in your love life based on the cards."
- Changes for single people could include: meeting someone special, being liked by someone, further development, or maintaining current status.`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their complicated situation might evolve. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:

- Think about how the ambiguous situation might evolve based on the card meanings, then interpret for the user.
- For the second half of the year, you can say "if... then..." since it's far from the drawing time.
- For users in a complicated situation, consider whether this month might bring further development with the person they're interested in.
- Example: "Your current relationship status is complicated, but based on the cards, by month ${monthNumber}, your relationship might experience some changes." or "If you're together/still figuring things out by then..."`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, the relationship might enter different phases (adjustment, stability, progression). Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret for users in relationships
- Don't always mention love aspects. Only interpret if the cards specifically suggest relationship changes.
- Focus on possible phase changes: progression, adjustment, stability shifts, or communication topics.
- Based on the cards, determine if this month is suitable for taking things further (meeting parents/moving in/engagement) or if it's better to slow down.
- If cards suggest pressure or conflict, provide specific communication/boundary advice; if they suggest steady progress, mention shared planning or commemorative activities.
- Example: "You're currently in a relationship. Based on the cards, by month ${monthNumber}, you might experience [certain changes]. If things are stable then, consider...; if there's turbulence, you can adjust by..."`,
    },
  },
  ko: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their relationship status might change based on the cards. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:
- Based on the card meanings, consider whether the user might meet someone special in ${monthName}. Being single doesn't mean staying single forever.
- Example: "Since you're currently single, after ${monthNumber - 1} months, by ${monthName}, there might be some changes in your love life based on the cards."
- Changes for single people could include: meeting someone special, being liked by someone, further development, or maintaining current status.`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their complicated situation might evolve. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:

- Think about how the ambiguous situation might evolve based on the card meanings, then interpret for the user.
- For the second half of the year, you can say "if... then..." since it's far from the drawing time.
- For users in a complicated situation, consider whether this month might bring further development with the person they're interested in.
- Example: "Your current relationship status is complicated, but based on the cards, by month ${monthNumber}, your relationship might experience some changes." or "If you're together/still figuring things out by then..."`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, the relationship might enter different phases (adjustment, stability, progression). Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret for users in relationships
- Don't always mention love aspects. Only interpret if the cards specifically suggest relationship changes.
- Focus on possible phase changes: progression, adjustment, stability shifts, or communication topics.
- Based on the cards, determine if this month is suitable for taking things further (meeting parents/moving in/engagement) or if it's better to slow down.
- If cards suggest pressure or conflict, provide specific communication/boundary advice; if they suggest steady progress, mention shared planning or commemorative activities.
- Example: "You're currently in a relationship. Based on the cards, by month ${monthNumber}, you might experience [certain changes]. If things are stable then, consider...; if there's turbulence, you can adjust by..."`,
    },
  },
  es: {
    single: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their relationship status might change based on the cards. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:
- Based on the card meanings, consider whether the user might meet someone special in ${monthName}. Being single doesn't mean staying single forever.
- Example: "Since you're currently single, after ${monthNumber - 1} months, by ${monthName}, there might be some changes in your love life based on the cards."
- Changes for single people could include: meeting someone special, being liked by someone, further development, or maintaining current status.`,
    },
    ambiguous: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, consider whether their complicated situation might evolve. Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret love aspects
- Don't always mention love! Only interpret love aspects if the cards for this month specifically suggest changes in relationships.
If interpretation is needed, follow these steps:

- Think about how the ambiguous situation might evolve based on the card meanings, then interpret for the user.
- For the second half of the year, you can say "if... then..." since it's far from the drawing time.
- For users in a complicated situation, consider whether this month might bring further development with the person they're interested in.
- Example: "Your current relationship status is complicated, but based on the cards, by month ${monthNumber}, your relationship might experience some changes." or "If you're together/still figuring things out by then..."`,
    },
    in_relationship: {
      statusChangeNote: (timeInfo: string) =>
        `Since the user drew cards for 2026 at ${timeInfo}, if we're talking about the second half of the year, the relationship might enter different phases (adjustment, stability, progression). Use future tense in interpretations.`,
      guidance: (monthName: string, monthNumber: number) => `
## How to interpret for users in relationships
- Don't always mention love aspects. Only interpret if the cards specifically suggest relationship changes.
- Focus on possible phase changes: progression, adjustment, stability shifts, or communication topics.
- Based on the cards, determine if this month is suitable for taking things further (meeting parents/moving in/engagement) or if it's better to slow down.
- If cards suggest pressure or conflict, provide specific communication/boundary advice; if they suggest steady progress, mention shared planning or commemorative activities.
- Example: "You're currently in a relationship. Based on the cards, by month ${monthNumber}, you might experience [certain changes]. If things are stable then, consider...; if there's turbulence, you can adjust by..."`,
    },
  },
}

/**
 * 获取感情状态相关的提示语
 */
export function getLoveStatusGuidance(
  lang: Lang,
  loveStatus: LoveStatusType,
  timeInfo: string,
  monthName: string,
  monthNumber: number
): { statusChangeNote: string; guidance: string } {
  if (!loveStatus || !LOVE_STATUS_GUIDANCE[lang][loveStatus as keyof LoveStatusGuidanceMap]) {
    return { statusChangeNote: '', guidance: '' }
  }
  const generator = LOVE_STATUS_GUIDANCE[lang][loveStatus as keyof LoveStatusGuidanceMap]
  return {
    statusChangeNote: generator.statusChangeNote(timeInfo),
    guidance: generator.guidance(monthName, monthNumber),
  }
}

/**
 * 获取用户信息的显示标签
 */
export function getUserLabels(
  lang: Lang,
  userInfo: { gender?: string; careerStatus?: string; loveStatus?: string }
): { genderLabel: string; careerLabel: string; loveLabel: string } {
  const notProvided = NOT_PROVIDED[lang]
  return {
    genderLabel: (userInfo.gender && GENDER_LABELS[lang][userInfo.gender]) || notProvided,
    careerLabel: (userInfo.careerStatus && CAREER_STATUS_LABELS[lang][userInfo.careerStatus]) || notProvided,
    loveLabel: (userInfo.loveStatus && LOVE_STATUS_LABELS[lang][userInfo.loveStatus]) || notProvided,
  }
}

/**
 * 获取月份名称
 */
export function getMonthName(lang: Lang, monthNumber: number): string {
  return MONTH_NAMES[lang][monthNumber - 1] || `${monthNumber}`
}
