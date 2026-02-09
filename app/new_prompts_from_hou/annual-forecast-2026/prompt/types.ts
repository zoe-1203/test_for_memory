/**
 * 年度运势 2026 - 类型定义
 *
 * 本模块完全自包含，不依赖外部类型，方便独立调试
 */

// ============ 基础类型（自包含） ============

/**
 * Prompt 基础参数
 * 简化版，仅包含年运模块实际使用的字段
 */
export interface PromptOptionsBase {
  uid: string
  /** 用户语言，如 'chinese simplified', 'english', 'japanese' 等 */
  lang: string
  question: string
  history: string
}

/**
 * Prompt 参数类型工具
 */
export type PromptOptions<T> = PromptOptionsBase & T

/**
 * 多语言 Prompt 接口
 */
export interface PromptLang<T> {
  cn: (params: T) => string
  tc: (params: T) => string
  en: (params: T) => string
  ja: (params: T) => string
  ko: (params: T) => string
  es: (params: T) => string
}

// ============ 年运模块类型 ============

/**
 * 年度运势 2026 用户信息
 */
export interface AnnualForecast2026UserInfo {
  nickname?: string
  gender?: string
  careerStatus?: string
  loveStatus?: string
}

/**
 * 感情状态类型
 */
export type LoveStatusType = 'single' | 'ambiguous' | 'in_relationship' | undefined

/**
 * 月度运势 Prompt 参数
 */
export type MonthlyFortunePromptOptions = PromptOptions<{
  /** 12张牌概览文本 */
  overviewText: string
  /** 月份数字 1-12 */
  monthNumber: number
  /** 当前月份牌的详细牌意 */
  currentCardDetail: string
  /** 用户信息 */
  userInfo: AnnualForecast2026UserInfo
  /** 时间信息 */
  timeInfo: string
}>

/**
 * 年度总览 Prompt 参数
 */
export type FortuneSummaryPromptOptions = PromptOptions<{
  /** 12个月的运势内容 */
  monthlyContents: string[]
  /** 用户信息 */
  userInfo: AnnualForecast2026UserInfo
}>

/**
 * 领域解读 Prompt 参数
 */
export type AreaReadingPromptOptions = PromptOptions<{
  /** 领域名称 */
  area: string
  /** 牌面信息 */
  cardContent: string
  /** 用户信息 */
  userInfo: AnnualForecast2026UserInfo
}>

/**
 * 雷达图评分 Prompt 参数
 */
export type AreaRadarPromptOptions = PromptOptions<{
  /** 六大领域的解读汇总 */
  areaInfoText: string
}>

/**
 * 总结语 Prompt 参数
 */
export type ClosingPromptOptions = PromptOptions<{
  /** 12张牌概览 */
  overviewText: string
  /** 年度总结 */
  yearSummary: string
  /** 六大领域的解读汇总 */
  areaInfoText: string
}>
