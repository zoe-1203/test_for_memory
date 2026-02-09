/**
 * 年度运势 2026 - Prompt 模块
 *
 * 支持多语言（cn/tc/en），符合 PromptLang<T> 接口规范
 */

// 类型导出
export * from './types'

// 常量和工具函数导出
export {
  MONTH_NAMES,
  GENDER_LABELS,
  CAREER_STATUS_LABELS,
  LOVE_STATUS_LABELS,
  NOT_PROVIDED,
  DOMAIN_AREAS,
  LOVE_STATUS_GUIDANCE,
  getLoveStatusGuidance,
  getUserLabels,
  getMonthName,
} from './constants'

// Prompt 导出
export { annualForecast2026MonthlyPrompt } from './monthly-fortune'
export { annualForecast2026SummaryPrompt } from './fortune-summary'
export { annualForecast2026AreaPrompt } from './area-reading'
export { annualForecast2026RadarPrompt } from './area-radar'
export { annualForecast2026ClosingPrompt } from './closing'
