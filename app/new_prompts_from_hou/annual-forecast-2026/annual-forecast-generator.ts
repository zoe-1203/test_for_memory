export enum Locale {
  ChineseSimplified = 'chinese simplified',
  ChineseTraditional = 'chinese traditional',
  English = 'english',
  Japanese = 'japanese',
  Korean = 'korean',
  Spanish = 'spanish',
}

import { generate, Model, streamToJson } from '../aigc-api'
import {
  annualForecast2026MonthlyPrompt,
  annualForecast2026SummaryPrompt,
  annualForecast2026AreaPrompt,
  annualForecast2026RadarPrompt,
  annualForecast2026ClosingPrompt,
  MONTH_NAMES,
  DOMAIN_AREAS,
} from './prompt'
import { tarotCards } from '../cards'
import { logger } from '../logger'
import { isChinese, isTraditional } from '../language'
import { env } from '~/env'
import type {
  DrawnCard,
  AnnualForecast2026UserInfo,
  Step1Result,
  Step2Result,
  MonthlyReport,
  DomainReport,
  AnnualForecast2026Domain,
} from '~/server/ddb/next/annual-forecast'

type Lang = 'cn' | 'tc' | 'en'

export const LLM_TEMPERATURES = {
  annualMonth: 0.9,
  annualSummary: 0.7,
  annualArea: 0.9,
  annualAreaRadar: 0.7,
  annualClosing: 0.7,
  annualAreaOverview: 0.7,
} as const

// 幸运物列表（多语言）
const GOOD_LUCK_ITEMS: Record<Lang, string[]> = {
  cn: ['白水晶', '粉水晶', '黄水晶', '香薰蜡烛', '扩香石', '鼠尾草', '干花香囊', '捕梦网', '多肉植物', '幸运御守', '黑曜石'],
  tc: ['白水晶', '粉水晶', '黃水晶', '香薰蠟燭', '擴香石', '鼠尾草', '乾花香囊', '捕夢網', '多肉植物', '幸運御守', '黑曜石'],
  en: ['Clear Quartz', 'Rose Quartz', 'Citrine', 'Scented Candle', 'Diffuser Stone', 'Sage', 'Dried Flower Sachet', 'Dream Catcher', 'Succulent Plant', 'Lucky Charm', 'Obsidian'],
}

function getRandomGoodLuckItem(lang: Lang): string {
  const items = GOOD_LUCK_ITEMS[lang]
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * 将 Locale 转换为 prompt 语言代码
 * - 中文简体 -> cn
 * - 中文繁体 -> tc
 * - 非中文（en/ja/ko/es）-> en（通过 lang 变量让模型输出对应语言）
 */
function localeToLang(locale?: Locale): Lang {
  if (!locale) return 'cn'
  if (isChinese(locale)) {
    return isTraditional(locale) ? 'tc' : 'cn'
  }
  return 'en'
}

// 根据 key 获取牌的详细信息（多语言）
function getCardInfo(key: string, lang: Lang): { name: string; description: string } | null {
  const card = tarotCards.find(c => c.key === key)
  if (!card) return null
  // 根据语言选择牌名和描述
  if (lang === 'en') {
    return {
      name: card.enName || card.cnName,
      description: card.en || card.cn,
    }
  }
  return {
    name: card.cnName,
    description: card.cn,
  }
}

// 获取当前时间信息（多语言）
function getTimeInfo(lang: Lang): string {
  const now = new Date()
  const hour = now.getHours()
  const month = now.getMonth() + 1
  const day = now.getDate()

  if (lang === 'en') {
    let period = 'morning'
    if (hour >= 18) period = 'evening'
    else if (hour >= 12) period = 'afternoon'
    return `${MONTH_NAMES.en[month - 1]} ${day}, ${period} ${hour}:00`
  }

  let period = '上午'
  if (hour >= 18) period = '晚上'
  else if (hour >= 12) period = '下午'
  return `${month}月${day}日${period}${hour}点`
}

// 获取正逆位文本（多语言）
function getPositionText(reversed: boolean, lang: Lang): string {
  if (lang === 'en') return reversed ? 'Reversed' : 'Upright'
  return reversed ? '逆位' : '正位'
}

// 解析 JSON 响应，兼容多种格式
function parseJsonResponse<T>(rawContent: string, defaultValue: T): T {
  try {
    let text = rawContent.trim()
    // 兼容 ```json ... ``` 包裹
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) text = fenced[1].trim()
    return JSON.parse(text) as T
  } catch {
    // 尝试提取 JSON 对象
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        return defaultValue
      }
    }
    return defaultValue
  }
}

// 获取模型
function getModel(): Model {
  return env.NUXT_PUBLIC_QUIN_REGION === 'cn' ? Model.deepSeekV3 : Model.gpt4oMini
}

interface GenerateStep1Args {
  uid: string
  user: AnnualForecast2026UserInfo
  monthlyCards: DrawnCard[]
  locale?: Locale
}

export async function generateStep1(args: GenerateStep1Args): Promise<Step1Result> {
  const { uid, user, monthlyCards, locale } = args
  const model = getModel()
  const lang = localeToLang(locale)
  const timeInfo = getTimeInfo(lang)
  const monthNames = MONTH_NAMES[lang]

  // 准备 12 张牌的信息
  const cardsWithInfo = monthlyCards.map((card, index) => {
    const cardInfo = getCardInfo(card.key, lang)
    const reversed = card.direction === 0
    return {
      index,
      key: card.key,
      reversed,
      name: cardInfo?.name || card.key,
      description: cardInfo?.description || '',
    }
  })

  // 生成概览文本（所有牌的名称和正逆位）
  const overviewLines = cardsWithInfo.map((card, index) => {
    const monthName = monthNames[index]
    const position = getPositionText(card.reversed, lang)
    if (lang === 'en') {
      return `${monthName}: Drew ${position} ${card.name}.`
    }
    return `${monthName}抽到了${position}的${card.name}。`
  })
  const overviewText = overviewLines.join('\n')

  logger.info({ uid, cardsCount: monthlyCards.length, lang }, '[年运 Step1] 开始生成 12 个月运势')

  // 并发生成 12 个月的运势
  const monthlyPromises = cardsWithInfo.map(async (card, index) => {
    const monthNumber = index + 1
    const position = getPositionText(card.reversed, lang)
    const currentCardDetail = lang === 'en'
      ? `${position} ${card.name}\n\n${card.description}`
      : `${position}的${card.name}\n\n${card.description}`

    // 构建 prompt 上下文
    const promptCtx = {
      uid,
      lang: locale || Locale.ChineseSimplified,
      question: '',
      history: '',
      overviewText,
      monthNumber,
      currentCardDetail,
      userInfo: {
        nickname: user.nickname,
        gender: user.gender,
        careerStatus: user.careerStatus,
        loveStatus: user.loveStatus,
      },
      timeInfo,
    }

    // 根据语言调用对应的 prompt
    const prompt = annualForecast2026MonthlyPrompt[lang](promptCtx)

    try {
      const res = await generate({
        model,
        temperature: LLM_TEMPERATURES.annualMonth,
        messages: [{ role: 'user', content: typeof prompt === 'string' ? prompt : prompt.prompt }],
      })

      if ('errorCode' in res) {
        logger.error({ uid, month: monthNumber, errorCode: res.errorCode }, '[年运 Step1] 月度生成失败')
        return {
          month: monthNumber,
          keyword: lang === 'en' ? 'Generation failed' : '生成失败',
          content: '',
          success: false,
        }
      }

      const jsonResult = await streamToJson(res.stream)
      const result = parseJsonResponse<{ keyword: string; content: string }>(JSON.stringify(jsonResult), {
        keyword: lang === 'en' ? 'Parse failed' : '解析失败',
        content: '',
      })

      logger.info({ uid, month: monthNumber }, '[年运 Step1] 月度生成完成')
      return {
        month: monthNumber,
        keyword: result.keyword || (lang === 'en' ? 'No keyword' : '未提供关键词'),
        content: result.content || (lang === 'en' ? 'No content' : '未提供内容'),
        success: true,
      }
    } catch (error) {
      logger.error({ uid, month: monthNumber, error }, '[年运 Step1] 月度生成异常')
      return {
        month: monthNumber,
        keyword: lang === 'en' ? 'Generation error' : '生成异常',
        content: '',
        success: false,
      }
    }
  })

  const monthlyResults = await Promise.all(monthlyPromises)

  // 生成年度总览和评分
  logger.info({ uid }, '[年运 Step1] 开始生成年度总览')
  const monthlyContents = monthlyResults.map(r => r.content)

  const summaryCtx = {
    uid,
    lang: locale || Locale.ChineseSimplified,
    question: '',
    history: '',
    monthlyContents,
    userInfo: {
      nickname: user.nickname,
      gender: user.gender,
      careerStatus: user.careerStatus,
      loveStatus: user.loveStatus,
    },
  }

  const summaryPrompt = annualForecast2026SummaryPrompt[lang](summaryCtx)

  let summaryResult: {
    analysis?: string
    hookStarting?: string
    summary?: string
    January?: number
    February?: number
    March?: number
    April?: number
    May?: number
    June?: number
    July?: number
    August?: number
    September?: number
    October?: number
    November?: number
    December?: number
  } = {}

  try {
    const res = await generate({
      model,
      temperature: LLM_TEMPERATURES.annualSummary,
      messages: [{ role: 'user', content: typeof summaryPrompt === 'string' ? summaryPrompt : summaryPrompt.prompt }],
    })

    if (!('errorCode' in res)) {
      const jsonResult = await streamToJson(res.stream)
      summaryResult = parseJsonResponse(JSON.stringify(jsonResult), {})
    }
  } catch (error) {
    logger.error({ uid, error }, '[年运 Step1] 年度总览生成异常')
  }

  // 组装月度评分
  const monthScores = [
    summaryResult.January,
    summaryResult.February,
    summaryResult.March,
    summaryResult.April,
    summaryResult.May,
    summaryResult.June,
    summaryResult.July,
    summaryResult.August,
    summaryResult.September,
    summaryResult.October,
    summaryResult.November,
    summaryResult.December,
  ]

  // 组装结果
  const monthlyReports: MonthlyReport[] = monthlyResults.map((r, index) => ({
    highlight: r.keyword,
    score: monthScores[index] ?? 70,
    content: r.content,
  }))

  const step1: Step1Result = {
    summary: summaryResult.summary || '',
    scoreTrendSummary: summaryResult.hookStarting || '',
    monthlyReports,
  }

  logger.info({ uid }, '[年运 Step1] 生成完成')
  return step1
}

interface GenerateStep2Args {
  uid: string
  user: AnnualForecast2026UserInfo
  domainsCards: DrawnCard[]
  step1: Step1Result
  monthlyCards: DrawnCard[]
  locale?: Locale
}

export async function generateStep2(args: GenerateStep2Args): Promise<Step2Result> {
  const { uid, user, domainsCards, step1, monthlyCards, locale } = args
  const model = getModel()
  const lang = localeToLang(locale)
  const monthNames = MONTH_NAMES[lang]
  const domainAreas = DOMAIN_AREAS[lang]

  // 生成 12 张牌的概览文本
  const overviewText = monthlyCards.map((card, index) => {
    const cardInfo = getCardInfo(card.key, lang)
    const position = getPositionText(card.direction === 0, lang)
    if (lang === 'en') {
      return `${monthNames[index]}: Drew ${position} ${cardInfo?.name || card.key}.`
    }
    return `${monthNames[index]}抽到了${position}的${cardInfo?.name || card.key}。`
  }).join('\n')

  logger.info({ uid, domainsCount: domainsCards.length, lang }, '[年运 Step2] 开始生成 6 大领域运势')

  // 并发生成 6 个领域的解读
  const areaPromises = domainsCards.map(async (card, index) => {
    const area = domainAreas[index]
    const cardInfo = getCardInfo(card.key, lang)
    const reversed = card.direction === 0
    const position = getPositionText(reversed, lang)
    const cardContent = lang === 'en'
      ? `${position} ${cardInfo?.name || card.key}\n\n${cardInfo?.description || ''}`
      : `${position}的${cardInfo?.name || card.key}\n\n${cardInfo?.description || ''}`

    // 根据身份类型动态调整「事业·学业」
    let areaForPrompt = area.name
    if (area.id === 'career') {
      const isStudent = user.careerStatus === 'middle_high_school' || user.careerStatus === 'college_above'
      if (lang === 'en') {
        areaForPrompt = isStudent ? 'Studies' : 'Career'
      } else if (lang === 'tc') {
        areaForPrompt = isStudent ? '學業' : '事業'
      } else {
        areaForPrompt = isStudent ? '学业' : '事业'
      }
    }

    const areaCtx = {
      uid,
      lang: locale || Locale.ChineseSimplified,
      question: '',
      history: '',
      area: areaForPrompt,
      cardContent,
      userInfo: {
        nickname: user.nickname,
        gender: user.gender,
        careerStatus: user.careerStatus,
        loveStatus: user.loveStatus,
      },
    }

    const prompt = annualForecast2026AreaPrompt[lang](areaCtx)

    try {
      const res = await generate({
        model,
        temperature: LLM_TEMPERATURES.annualArea,
        messages: [{ role: 'user', content: typeof prompt === 'string' ? prompt : prompt.prompt }],
      })

      if ('errorCode' in res) {
        logger.error({ uid, area: area.id, errorCode: res.errorCode }, '[年运 Step2] 领域生成失败')
        return {
          areaId: area.id as AnnualForecast2026Domain,
          areaName: area.name,
          hookSentence: lang === 'en' ? 'Generation failed' : '生成失败',
          content: '',
          summaryHighlight: '',
          success: false,
        }
      }

      const jsonResult = await streamToJson(res.stream)
      const result = parseJsonResponse<{ hookSentece?: string; hookSentence?: string; content?: string; summaryHighlight?: string }>(
        JSON.stringify(jsonResult),
        {},
      )

      // 兼容两种拼写
      const hookSentence = result.hookSentece || result.hookSentence || ''

      logger.info({ uid, area: area.id }, '[年运 Step2] 领域生成完成')
      return {
        areaId: area.id as AnnualForecast2026Domain,
        areaName: area.name,
        hookSentence,
        content: result.content || '',
        summaryHighlight: result.summaryHighlight || '',
        success: true,
      }
    } catch (error) {
      logger.error({ uid, area: area.id, error }, '[年运 Step2] 领域生成异常')
      return {
        areaId: area.id as AnnualForecast2026Domain,
        areaName: area.name,
        hookSentence: lang === 'en' ? 'Generation error' : '生成异常',
        content: '',
        summaryHighlight: '',
        success: false,
      }
    }
  })

  const areaResultsUnsorted = await Promise.all(areaPromises)
  // 按照 DOMAIN_AREAS 顺序排序
  const areaResults = domainAreas.map(area => areaResultsUnsorted.find(r => r.areaId === area.id)!)

  // 生成雷达图评分
  logger.info({ uid }, '[年运 Step2] 开始生成雷达图评分')

  const notProvided = lang === 'en' ? '(Not provided)' : '（未提供）'
  const areaInfoText = areaResults
    .map(a => {
      if (lang === 'en') {
        return [
          `【${a.areaName}】`,
          `Theme: ${a.hookSentence || notProvided}`,
          `Content: ${a.content || notProvided}`,
          `Key reminder: ${a.summaryHighlight || notProvided}`,
        ].join('\n')
      }
      return [
        `【${a.areaName}】`,
        `一句话主命题：${a.hookSentence || notProvided}`,
        `解读内容：${a.content || notProvided}`,
        `关键提醒：${a.summaryHighlight || notProvided}`,
      ].join('\n')
    })
    .join('\n\n')

  let radarResult: {
    analysis?: string
    love?: number
    career?: number
    wealth?: number
    health?: number
    social?: number
    innerGrowth?: number
    startingOverview?: string
  } = {}

  try {
    const radarCtx = {
      uid,
      lang: locale || Locale.ChineseSimplified,
      question: '',
      history: '',
      areaInfoText,
    }
    const radarPrompt = annualForecast2026RadarPrompt[lang](radarCtx)
    const res = await generate({
      model,
      temperature: LLM_TEMPERATURES.annualAreaRadar,
      messages: [{ role: 'user', content: typeof radarPrompt === 'string' ? radarPrompt : radarPrompt.prompt }],
    })

    if (!('errorCode' in res)) {
      const jsonResult = await streamToJson(res.stream)
      radarResult = parseJsonResponse(JSON.stringify(jsonResult), {})
    }
  } catch (error) {
    logger.error({ uid, error }, '[年运 Step2] 雷达图评分生成异常')
  }

  // 生成总结语
  logger.info({ uid }, '[年运 Step2] 开始生成总结语')

  let closingResult: {
    anchorSentence?: string
    closingParagraph?: string
  } = {}

  try {
    const closingCtx = {
      uid,
      lang: locale || Locale.ChineseSimplified,
      question: '',
      history: '',
      overviewText,
      yearSummary: step1.summary,
      areaInfoText,
    }
    const closingPrompt = annualForecast2026ClosingPrompt[lang](closingCtx)
    const res = await generate({
      model,
      temperature: LLM_TEMPERATURES.annualClosing,
      messages: [{ role: 'user', content: typeof closingPrompt === 'string' ? closingPrompt : closingPrompt.prompt }],
    })

    if (!('errorCode' in res)) {
      const jsonResult = await streamToJson(res.stream)
      closingResult = parseJsonResponse(JSON.stringify(jsonResult), {})
    }
  } catch (error) {
    logger.error({ uid, error }, '[年运 Step2] 总结语生成异常')
  }

  // 随机抽取幸运物
  const annualLuckItem = getRandomGoodLuckItem(lang)
  logger.info({ uid, annualLuckItem }, '[年运 Step2] 随机抽取幸运物完成')

  // 组装领域报告
  const domainReports: DomainReport[] = areaResults.map(a => ({
    domain: a.areaId,
    theme: a.hookSentence,
    content: a.content,
    highlight: a.summaryHighlight,
    score: (radarResult as any)?.[a.areaId] ?? 70,
  }))

  const step2: Step2Result = {
    domainReports,
    domainSummary: radarResult.startingOverview || '',
    annualSummary: closingResult.closingParagraph || '',
    annualSummaryHighlight: closingResult.anchorSentence || '',
    annualLuckItem,
  }

  logger.info({ uid }, '[年运 Step2] 生成完成')
  return step2
}
