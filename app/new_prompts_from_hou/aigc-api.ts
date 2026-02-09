import { Readable } from 'stream'
import { config } from '../config'
import { ErrorCode } from '../../shared/error-code'
import { env } from '../../env'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAzure } from '@ai-sdk/azure'
import { streamText, generateObject, CoreMessage, LanguageModelV1 } from 'ai'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { URL } from 'url'
import { z } from 'zod'
import { tarotCardDetectionPrompt } from './prompt'
import { logger } from '~/server/utils/logger'

export function streamToString(stream: Readable) {
  const chunks: Buffer[] = []
  return new Promise<string>((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
    stream.on('error', err => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8')))
  })
}

export async function streamToJson(stream: Readable) {
  let jsonStr = ''
  try {
    jsonStr = await streamToString(stream)
    jsonStr = jsonStr.replace(/^```json/i, '')?.replace(/```$/, '')
    return JSON.parse(jsonStr)
  } catch (err) {
    logger.error({ err, jsonStr }, 'streamToJson error')
    return {}
  }
}

export enum Model {
  volcEngineDeepSeekV31 = `volcengine:deepseek-v3-1-250821`,
  aliyunDeepSeekV3 = 'aliyun:deepseek-v3',
  deepSeekV3 = 'deepseek:deepseek-chat',
  gpt4o = 'openai:gpt-4o',
  gpt4oMini = 'openai:gpt-4o-mini',
  openrouterGpt4oMini = 'openrouter:openai/gpt-4o-mini',
  gpt41 = 'openai:gpt-4.1',
  bedrockHaiku45 = 'bedrock:anthropic.claude-haiku-4-5-20251001-v1:0',
  bedrockSonnet45 = 'bedrock:anthropic.claude-sonnet-4-5-20250929-v1:0',
}

// ============ AI SDK Providers ============

// 设置 Bedrock Bearer Token 认证
if (env.AWS_BEDROCK_API_KEY) {
  process.env.AWS_BEARER_TOKEN_BEDROCK = env.AWS_BEDROCK_API_KEY
}

const providers = {
  openai: createOpenAI({}),
  // 非 OpenAI 的兼容 API 使用 @ai-sdk/openai-compatible
  deepseek: createOpenAICompatible({
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: config.ai.deepseekKey,
  }),
  volcEngine: createOpenAICompatible({
    name: 'volcengine',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: env.VOLCENGINE_MODEL_API_KEY,
  }),
  aliyun: createOpenAICompatible({
    name: 'aliyun',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: env.ALIYUN_BAILIAN_API_KEY,
  }),
  openRouter: createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.ai.openRouterApiKey,
  }),
  bedrock: createAmazonBedrock({
    region: 'ap-northeast-1',
  }),
}

// Model -> Provider + ModelId 映射
// Claude 4.5 模型需要使用 inference profile ID (global.xxx)
const MODEL_CONFIG: Record<Model, { provider: keyof typeof providers; modelId: string }> = {
  [Model.gpt4oMini]: { provider: 'openai', modelId: 'gpt-4o-mini' },
  [Model.gpt4o]: { provider: 'openai', modelId: 'gpt-4o' },
  [Model.gpt41]: { provider: 'openai', modelId: 'gpt-4.1' },
  [Model.deepSeekV3]: { provider: 'deepseek', modelId: 'deepseek-chat' },
  [Model.volcEngineDeepSeekV31]: { provider: 'volcEngine', modelId: 'deepseek-v3-1-250821' },
  [Model.aliyunDeepSeekV32]: { provider: 'aliyun', modelId: 'deepseek-v3.2' },
  [Model.aliyunDeepSeekV3]: { provider: 'aliyun', modelId: 'deepseek-v3' },
  [Model.openrouterGpt4oMini]: { provider: 'openRouter', modelId: 'openai/gpt-4o-mini' },
  [Model.bedrockHaiku45]: { provider: 'bedrock', modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' },
  [Model.bedrockSonnet45]: { provider: 'bedrock', modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' },
}

// ============ Generate Interface ============

export interface GenerateInput {
  messages: CoreMessage[]
  model: Model | string
  firstByteTimeout?: number
  max_tokens?: number
  temperature?: number
  top_p?: number
}

export type GenerateResult =
  | { errorCode: number }
  | { stream: Readable; getUsage: () => Promise<{ model: string; inputToken: number; outputToken: number; inputCacheToken: number }> }

// ============ Main Generate Function ============

export const generate = async (args: GenerateInput): Promise<GenerateResult> => {
  const { model, messages, firstByteTimeout = 10_000, max_tokens, temperature, top_p } = args

  try {
    const modelConfig = MODEL_CONFIG[model as Model]
    if (!modelConfig) {
      logger.error({ message: `Unsupported model: ${model}` })
      throw new Error(`Unsupported model: ${model}`)
    }

    const { provider: providerKey, modelId } = modelConfig
    const provider = providers[providerKey]
    const languageModel = provider(modelId) as LanguageModelV1

    // Claude 模型要求第一条消息必须是 user 角色，如果第一条是 system 则在其后插入一条 user 消息
    const isClaude = providerKey === 'bedrock' && modelId.includes('anthropic')
    let processedMessages = messages
    if (isClaude && messages.length > 0 && messages[0].role === 'system') {
      processedMessages = [
        messages[0],
        { role: 'user' as const, content: 'Please follow the instructions above to complete the task.' },
        ...messages.slice(1),
      ]
    }

    logger.info({
      message: `Using AI SDK for model ${model}`,
      provider: providerKey,
      modelId,
    })

    // 包装成现有接口格式
    const { promise: usagePromise, resolve: resolveUsage, reject: rejectUsage } = withResolvers<{
      model: string
      inputToken: number
      outputToken: number
      inputCacheToken: number
    }>()

    // 创建 Readable 流
    const stream = new Readable({
      read() {},
    })

    // 在后台处理流
    ;(async () => {
      let firstChunkReceived = false
      let timeoutId: NodeJS.Timeout | undefined

      try {
        // 设置首字节超时
        timeoutId = setTimeout(() => {
          if (!firstChunkReceived) {
            stream.destroy(new Error(`First byte timeout after ${firstByteTimeout}ms`))
          }
        }, firstByteTimeout)

        // 使用 AI SDK streamText
        const result = await streamText({
          model: languageModel,
          messages: processedMessages,
          maxTokens: max_tokens,
          temperature,
          topP: top_p,
        })

        // 遍历 textStream
        for await (const chunk of result.textStream) {
          if (!firstChunkReceived) {
            firstChunkReceived = true
            if (timeoutId) clearTimeout(timeoutId)
          }
          stream.push(chunk)
        }

        // 流结束
        stream.push(null)

        // 获取 usage
        const usage = await result.usage
        resolveUsage({
          model,
          inputToken: usage?.inputTokens ?? 0,
          outputToken: usage?.outputTokens ?? 0,
          inputCacheToken: 0,
        })
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)
        logger.error({ err, model, modelId }, 'Error in stream processing')
        stream.destroy(err as Error)
        rejectUsage(err)
      }
    })()

    return {
      stream,
      getUsage: () => usagePromise,
    }
  } catch (error) {
    let errorCode: ErrorCode

    // 检查常见错误类型
    const errorMessage = String(error)
    const statusCode = (error as any)?.status || (error as any)?.statusCode

    if (statusCode === 429 || statusCode === 418 || errorMessage.includes('rate') || errorMessage.includes('throttl')) {
      errorCode = ErrorCode.RateLimit
    } else {
      errorCode = ErrorCode.GenerationError
    }

    logger.error({
      message: `Generate error: ${error}`,
      error,
      params: args,
    })

    return { errorCode }
  }
}

// ============ Generate with Fallback ============

export const generateWithFallback = async <T>(
  args: Omit<GenerateInput, 'model'> & { models: Model[]; onFallback?: (input: GenerateInput) => GenerateInput },
) => {
  const { onFallback = input => input, models } = args
  const argsClone: Omit<typeof args, 'models' | 'onFallback'> = { ...args }
  delete (argsClone as any).models
  delete (argsClone as any).onFallback

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const input = onFallback({
      ...argsClone,
      model,
    })
    const res = await generate(input)

    if ('errorCode' in res && i !== models.length - 1) {
      logger.error({ errorCode: res.errorCode, input, output: res }, `Error using model ${input.model}`)
      continue
    }
    return res
  }
}

// ============ Tarot Card Detection ============

export async function findTarotCardsInPhoto(image: string) {
  const model = 'gpt-4o'
  const quinAzureEndpoint = env.AZURE_ENDPOINT_URL || 'https://quin-openai-japan-east-xminfo002.openai.azure.com'
  const azureUrl = `${quinAzureEndpoint}/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview`
  const url = new URL(azureUrl)
  const azure = createAzure({
    resourceName: url.hostname.split('.')[0],
  })

  const providerModels = [azure(model)]

  if (env.NUXT_PUBLIC_QUIN_REGION === 'global') {
    providerModels.push(openai(model))
  }

  const messages: CoreMessage[] = [
    {
      role: 'system',
      content: tarotCardDetectionPrompt,
    },
    {
      role: 'user',
      content: [
        {
          type: 'image',
          image: image,
        },
      ],
    },
  ]

  for (const providerModel of providerModels) {
    try {
      const { object, usage } = await generateObject({
        model: providerModel,
        schema: z.object({
          detected: z.array(z.object({ card: z.string(), position: z.enum(['upright', 'reverse']) })),
        }),
        messages,
      })
      logger.info({ object }, 'card info')
      return {
        usage,
        detected: object.detected,
      }
    } catch (error) {
      logger.error(error, `Error using provider ${providerModel}`)
    }
  }
  throw new Error('All providers failed to generate tarot card detection.')
}

// ============ Utilities ============

const withResolvers = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
