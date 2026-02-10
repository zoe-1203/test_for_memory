import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { tarotCards } from "@/app/new_prompts_from_hou/cards";
import { LLM_TEMPERATURES } from "@/lib/prompts";
import { annualForecast2026MonthlyPrompt, MONTH_NAMES } from "@/app/new_prompts_from_hou/annual-forecast-2026/prompt";

// ========== 多语言辅助函数 ==========
type Lang = 'cn' | 'tc' | 'en' | 'ja' | 'ko' | 'es';

// 获取当前时间信息（多语言）
function getTimeInfo(lang: Lang): string {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // ja/ko/es 使用英文格式（匹配英文 Prompt）
  const isEnglishBased = lang === 'en' || lang === 'ja' || lang === 'ko' || lang === 'es';
  if (isEnglishBased) {
    let period = 'morning';
    if (hour >= 18) period = 'evening';
    else if (hour >= 12) period = 'afternoon';
    return `${MONTH_NAMES.en[month - 1]} ${day}, ${period} ${hour}:00`;
  }

  let period = '上午';
  if (hour >= 18) period = '晚上';
  else if (hour >= 12) period = '下午';
  return `${month}月${day}日${period}${hour}点`;
}

// ========== 连接池复用：模块级 Client 缓存 ==========
// 在模块级别创建 client 缓存，所有请求复用同一个 client 实例
// 这样可以复用 HTTP keep-alive 连接，减少 TCP/TLS 握手时间
const clientCache = new Map<'openai' | 'deepseek' | 'anthropic-haiku' | 'anthropic-sonnet', OpenAI | Anthropic>();

function getCachedClient(provider: "openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet"): OpenAI | Anthropic {
  if (!clientCache.has(provider)) {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
      clientCache.set(provider, new OpenAI({ apiKey }));
    } else if (provider === "anthropic-haiku" || provider === "anthropic-sonnet") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
      clientCache.set(provider, new Anthropic({ apiKey }));
    } else {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
      const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
      clientCache.set(provider, new OpenAI({ apiKey, baseURL }));
    }
  }
  return clientCache.get(provider)!;
}

function getModel(provider: "openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet"): string {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "anthropic-haiku") return "claude-haiku-4-5-20251001";
  if (provider === "anthropic-sonnet") return "claude-sonnet-4-5-20250929";
  return "deepseek-chat";
}

// 抽取12张牌（保证不重复）
function drawTwelveCards(lang: Lang = 'cn') {
  const indices = new Set<number>();
  while (indices.size < 12 && indices.size < tarotCards.length) {
    indices.add(Math.floor(Math.random() * tarotCards.length));
  }

  return Array.from(indices).map((idx) => {
    const reversed = Math.random() < 0.5;
    const cardData = tarotCards[idx];

    // 根据语言选择牌名和牌意
    // ja/ko/es 使用英文牌意（匹配英文 Prompt）
    const isEnglishBased = lang === 'en' || lang === 'ja' || lang === 'ko' || lang === 'es';
    const name = isEnglishBased ? (cardData.enName || cardData.cnName) : cardData.cnName;
    const cardInfo = isEnglishBased ? (cardData.en || cardData.cn) : cardData.cn;

    return {
      id: cardData.key,
      name,
      cnName: cardData.cnName,
      cardInfo,
      reversed
    };
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    preparation: 0, // 准备阶段（抽牌、格式化等）
    networkRequests: [] as Array<{ month: number; startTime: number; endTime: number; duration: number; tokens?: { prompt: number; completion: number; total: number } }>,
    totalNetworkTime: 0, // 所有网络请求的总时间（并发，所以是最大时间）
    parsing: 0, // JSON解析时间
    totalTokens: { prompt: 0, completion: 0, total: 0 } // Token 使用量统计
  };
  
  try {
    const prepStartTime = Date.now();
    const body = await req.json();
    const {
      provider = "openai",
      language = "cn",
      cards: providedCards, // 如果前端已经抽好牌，直接使用；否则后端抽取
      nickName,
      careerStatus,
      gender,
      loveStatus,
      careerStatusLabel,
      genderLabel,
      loveStatusLabel,
      includeRawData = false // 新增：是否返回原始 prompts 和 responses
    } = body as {
      provider?: "openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet";
      language?: Lang;
      cards?: Array<{ id: string; name: string; reversed: boolean; cnName: string; cardInfo: string }>;
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      careerStatusLabel?: string;
      genderLabel?: string;
      loveStatusLabel?: string;
      includeRawData?: boolean; // 新增
    };

    // 获取缓存的 client（复用连接）
    const client = getCachedClient(provider);
    const model = getModel(provider);

    // 抽取或使用提供的12张牌
    let cards: ReturnType<typeof drawTwelveCards>;

    if (providedCards && providedCards.length === 12) {
      // 如果前端提供了卡牌，需要补充 cardInfo
      cards = providedCards.map(c => {
        // 从 tarotCards 中查找对应的 cardInfo
        const cardData = tarotCards.find(tc =>
          tc.key === c.id || tc.cnName === c.cnName || tc.enName === c.name
        );

        // 根据语言选择牌名和牌意
        const name = language === 'en' ? (cardData?.enName || c.name) : (cardData?.cnName || c.cnName);
        const cardInfo = language === 'en' ? (cardData?.en || '') : (cardData?.cn || '');

        return {
          id: c.id,
          name,
          cnName: c.cnName || c.name,
          cardInfo: c.cardInfo || cardInfo || '（未找到对应牌意信息）',
          reversed: c.reversed
        };
      });
    } else {
      cards = drawTwelveCards(language);
    }

    const monthNames = MONTH_NAMES[language];
    // 当前时间信息（用于 Prompt）
    const timeInfo = getTimeInfo(language);


    // 准备保存 Prompt 文件的目录和时间戳（在时间统计之外准备）
    // 只在本地开发环境保存 Prompt，生产环境（Vercel）跳过文件写入
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    // 确保目录存在（同步操作，但很快，不影响统计）
    // 在生产环境跳过，避免 Vercel serverless 只读文件系统错误
    if (!isProduction && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prepEndTime = Date.now();
    timeStats.preparation = prepEndTime - prepStartTime;

    // 存储所有 prompts，用于后续异步保存（不阻塞主流程）
    const promptsToSave: Array<{ monthNumber: number; prompt: string }> = [];
    // 新增：存储原始数据用于返回给前端
    const rawDataCollection: Array<{ month: number; prompt: string; rawResponse: string }> = [];

    // 并发调用12次AI（每个月一次）
    // 所有请求使用同一个 client，复用 HTTP 连接
    const overviewLines = cards.map((card, index) => {
      const monthName = monthNames[index];
      // ja/ko/es 使用英文格式（匹配英文 Prompt）
      const isEnglishBased = language === 'en' || language === 'ja' || language === 'ko' || language === 'es';
      if (isEnglishBased) {
        // English format: For January, the user drew Reversed Three of Cups.
        const position = card.reversed ? "Reversed" : "Upright";
        return `For ${monthName}, the user drew ${position} ${card.name}.`;
      } else {
        // Chinese format: 一月抽到了逆位的圣杯三。
        const position = card.reversed ? "逆位" : "正位";
        return `${monthName}抽到了${position}的${card.name}。`;
      }
    });
    const overviewText = overviewLines.join('\n');

    const monthPromises = Array.from({ length: 12 }, async (_, index) => {
      const monthNumber = index + 1;
      const currentCard = cards[index];
      const currentCardDetail = language === 'en'
        ? `${currentCard.name}\n\n${currentCard.cardInfo || ''}`
        : `${currentCard.name}（${currentCard.cnName}）\n\n${currentCard.cardInfo || ''}`;

      const prompt = annualForecast2026MonthlyPrompt[language]({
        uid: '',
        lang: language,
        question: '',
        history: '',
        overviewText,
        monthNumber,
        currentCardDetail,
        userInfo: {
          nickname: nickName,
          gender,
          careerStatus,
          loveStatus
        },
        timeInfo
      });
      
      // 保存 prompt 到数组，后续异步保存（不阻塞）
      promptsToSave.push({ monthNumber, prompt });

      // 记录网络请求开始时间
      const requestStartTime = Date.now();

      try {
        // 根据 provider 类型使用不同的 API 调用方式
        let rawContent: string;
        let tokenUsage: { prompt: number; completion: number; total: number } | undefined;

        if (provider === "anthropic-haiku" || provider === "anthropic-sonnet") {
          // Anthropic API 调用
          const anthropicClient = client as Anthropic;
          const response = await anthropicClient.messages.create({
            model,
            max_tokens: 8192,
            temperature: LLM_TEMPERATURES.annualMonth,
            messages: [{ role: "user", content: prompt }]
          });

          rawContent = response.content[0].type === 'text' ? response.content[0].text : "{}";

          // Anthropic token usage
          tokenUsage = {
            prompt: response.usage.input_tokens,
            completion: response.usage.output_tokens,
            total: response.usage.input_tokens + response.usage.output_tokens
          };
        } else {
          // OpenAI/DeepSeek API 调用
          const openaiClient = client as OpenAI;
          const requestOptions: any = {
            model,
            temperature: LLM_TEMPERATURES.annualMonth,
            messages: [{ role: "user", content: prompt }]
          };

          if (provider === "openai") {
            requestOptions.response_format = { type: "json_object" };
          }

          const response = await openaiClient.chat.completions.create(requestOptions);
          rawContent = response.choices[0]?.message?.content || "{}";

          tokenUsage = response.usage ? {
            prompt: response.usage.prompt_tokens || 0,
            completion: response.usage.completion_tokens || 0,
            total: response.usage.total_tokens || 0
          } : undefined;
        }

        // 记录网络请求结束时间
        const requestEndTime = Date.now();
        const requestDuration = requestEndTime - requestStartTime;

        if (tokenUsage) {
          timeStats.totalTokens.prompt += tokenUsage.prompt;
          timeStats.totalTokens.completion += tokenUsage.completion;
          timeStats.totalTokens.total += tokenUsage.total;
        }

        timeStats.networkRequests.push({
          month: monthNumber,
          startTime: requestStartTime - startTime,
          endTime: requestEndTime - startTime,
          duration: requestDuration,
          tokens: tokenUsage
        });

        const parseStartTime = Date.now();
        let result: { keyword: string; content: string };

        try {
          // 兼容 ```json ... ``` 或 ``` ... ``` 包裹
          let text = rawContent.trim();
          const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (fenced) text = fenced[1].trim();
          result = JSON.parse(text);
        } catch (e) {
          // 如果解析失败，尝试提取 JSON 对象
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              // 如果还是失败，使用默认值
              result = {
                keyword: "解析失败",
                content: rawContent.substring(0, 500) // 限制长度
              };
            }
          } else {
            // 如果完全无法解析，使用默认值
            result = {
              keyword: "解析失败",
              content: rawContent.substring(0, 500)
            };
          }
        }

        const parseEndTime = Date.now();
        timeStats.parsing += parseEndTime - parseStartTime;

        // 新增：如果需要返回原始数据，保存到集合中
        if (includeRawData) {
          rawDataCollection.push({
            month: monthNumber,
            prompt,
            rawResponse: rawContent
          });
        }

        return {
          month: monthNumber,
          keyword: result.keyword || "未提供关键词",
          content: result.content || "未提供内容",
          card: {
            id: cards[index].id,
            name: cards[index].name,
            reversed: cards[index].reversed
          },
          success: true
        };
      } catch (error: any) {
        console.error(`[年度运势] 第${monthNumber}月请求失败:`, error);
        return {
          month: monthNumber,
          keyword: "请求失败",
          content: `错误：${error?.message || "unknown error"}`,
          card: {
            id: cards[index].id,
            name: cards[index].name,
            reversed: cards[index].reversed
          },
          success: false
        };
      }
    });

    // 等待所有并发请求完成
    const results = await Promise.all(monthPromises);
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    // 计算网络请求统计
    // 由于是并发请求，总网络时间应该是从第一个请求开始到最后一个请求结束的时间
    if (timeStats.networkRequests.length > 0) {
      const firstRequestStart = Math.min(...timeStats.networkRequests.map(r => r.startTime));
      const lastRequestEnd = Math.max(...timeStats.networkRequests.map(r => r.endTime));
      timeStats.totalNetworkTime = lastRequestEnd - firstRequestStart;
    }
    timeStats.total = elapsedTime;

    // 异步保存所有 Prompt 文件（不阻塞响应，不计算在耗时内）
    // 只在本地开发环境保存，生产环境跳过
    if (!isProduction) {
      setImmediate(() => {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        promptsToSave.forEach(({ monthNumber, prompt }) => {
          try {
            const monthName = monthNames[monthNumber - 1];
            const promptFileName = `month_${monthNumber}_${monthName}_${timestamp}_prompt.txt`;
            const promptFilePath = path.join(outputDir, promptFileName);
            fs.writeFileSync(promptFilePath, prompt, "utf-8");
            console.log(`[年度运势] 第${monthNumber}月 Prompt 已保存到: ${promptFilePath}`);
          } catch (error) {
            console.error(`[年度运势] 保存第${monthNumber}月 Prompt 失败:`, error);
          }
        });
      });
    }

    // 调试日志
    if (includeRawData) {
      console.log('[调试] annual-fortune API 返回 rawData:', rawDataCollection.length, '个月份');
    } else {
      console.log('[调试] annual-fortune API 未请求 rawData (includeRawData =', includeRawData, ')');
    }

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      cards: cards.map(c => ({
        id: c.id,
        name: c.name,
        cnName: c.cnName,
        reversed: c.reversed
      })),
      results,
      elapsedTime,
      timeStats: {
        total: timeStats.total,
        preparation: timeStats.preparation,
        networkRequests: timeStats.networkRequests,
        totalNetworkTime: timeStats.totalNetworkTime,
        parsing: timeStats.parsing,
        totalTokens: timeStats.totalTokens,
        other: timeStats.total - timeStats.preparation - timeStats.totalNetworkTime - timeStats.parsing
      },
      // 新增：有条件返回原始数据
      ...(includeRawData && { rawData: rawDataCollection })
    });
  } catch (e: any) {
    console.error('[年度运势] API 错误:', e);
    return NextResponse.json(
      { 
        ok: false, 
        error: e?.message || "unknown error",
        elapsedTime: Date.now() - startTime
      }, 
      { status: 500 }
    );
  }
}

