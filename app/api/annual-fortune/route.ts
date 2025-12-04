import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { tarotCardMeanings } from "@/data/tarot_card_meanings_cleanWord";
import { getAnnualFortunePrompt, LLM_TEMPERATURES } from "@/lib/prompts";

// ========== 连接池复用：模块级 Client 缓存 ==========
// 在模块级别创建 client 缓存，所有请求复用同一个 client 实例
// 这样可以复用 HTTP keep-alive 连接，减少 TCP/TLS 握手时间
const clientCache = new Map<'openai' | 'deepseek', OpenAI>();

function getCachedClient(provider: "openai" | "deepseek"): OpenAI {
  if (!clientCache.has(provider)) {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
      clientCache.set(provider, new OpenAI({ apiKey }));
    } else {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
      const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
      clientCache.set(provider, new OpenAI({ apiKey, baseURL }));
    }
  }
  return clientCache.get(provider)!;
}

function getModel(provider: "openai" | "deepseek"): string {
  return provider === "openai" ? "gpt-4o-mini" : "deepseek-chat";
}

// 抽取12张牌（保证不重复）
function drawTwelveCards() {
  const indices = new Set<number>();
  while (indices.size < 12 && indices.size < tarotCardMeanings.length) {
    indices.add(Math.floor(Math.random() * tarotCardMeanings.length));
  }

  const cards = Array.from(indices).map((idx) => {
    const reversed = Math.random() < 0.5;
    const cardData = tarotCardMeanings[idx];

    const match = cardData.cnName.match(/^(\d+)\s+(.+)$/);
    const id = match ? match[1] : String(idx);
    const name = match ? match[2] : cardData.cnName;

    return {
      id,
      name,
      cnName: cardData.cnName,
      cardInfo: cardData.cardInfo,
      reversed
    };
  });

  return cards;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    preparation: 0, // 准备阶段（抽牌、格式化等）
    networkRequests: [] as Array<{ month: number; startTime: number; endTime: number; duration: number }>,
    totalNetworkTime: 0, // 所有网络请求的总时间（并发，所以是最大时间）
    parsing: 0 // JSON解析时间
  };
  
  try {
    const prepStartTime = Date.now();
    const body = await req.json();
    const {
      provider = "openai",
      cards: providedCards, // 如果前端已经抽好牌，直接使用；否则后端抽取
      nickName,
      careerStatus,
      gender,
      loveStatus,
      careerStatusLabel,
      genderLabel,
      loveStatusLabel
    } = body as {
      provider?: "openai" | "deepseek";
      cards?: Array<{ id: string; name: string; reversed: boolean; cnName: string; cardInfo: string }>;
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      careerStatusLabel?: string;
      genderLabel?: string;
      loveStatusLabel?: string;
    };

    // 获取缓存的 client（复用连接）
    const client = getCachedClient(provider);
    const model = getModel(provider);

    // 抽取或使用提供的12张牌
    let cards: ReturnType<typeof drawTwelveCards>;
    
    if (providedCards && providedCards.length === 12) {
      // 如果前端提供了卡牌，需要补充 cardInfo
      cards = providedCards.map(c => {
        // 从 tarotCardMeanings 中查找对应的 cardInfo
        const cardData = tarotCardMeanings.find(tc => {
          const match = tc.cnName.match(/^(\d+)\s+(.+)$/);
          const id = match ? match[1] : '';
          const name = match ? match[2] : tc.cnName;
          return id === c.id || name === c.name || tc.cnName === c.cnName;
        });
        
        return {
          id: c.id,
          name: c.name,
          cnName: c.cnName || c.name,
          cardInfo: c.cardInfo || cardData?.cardInfo || '',
          reversed: c.reversed
        };
      });
    } else {
      cards = drawTwelveCards();
    }

    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    // 当前时间信息（用于 Prompt）
    const now = new Date();
    const hour = now.getHours();
    let period = "上午";
    if (hour >= 18) period = "晚上";
    else if (hour >= 12) period = "下午";
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const timeInfo = `${month}月${day}日${period}${hour}点`;


    // 准备保存 Prompt 文件的目录和时间戳（在时间统计之外准备）
    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    
    // 确保目录存在（同步操作，但很快，不影响统计）
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prepEndTime = Date.now();
    timeStats.preparation = prepEndTime - prepStartTime;

    // 存储所有 prompts，用于后续异步保存（不阻塞主流程）
    const promptsToSave: Array<{ monthNumber: number; prompt: string }> = [];

    // 并发调用12次AI（每个月一次）
    // 所有请求使用同一个 client，复用 HTTP 连接
    const overviewLines = cards.map((card, index) => {
      const monthName = monthNames[index];
      const position = card.reversed ? "逆位" : "正位";
      // 这里只描述每个月抽到哪张牌和正逆位，不附带详细牌意
      return `${monthName}抽到了${position}的${card.name}（${card.cnName}）。`;
    });
    const overviewText = overviewLines.join('\n');

    const monthPromises = Array.from({ length: 12 }, async (_, index) => {
      const monthNumber = index + 1;
      const currentCard = cards[index];
      const currentCardDetail = `${currentCard.name}（${currentCard.cnName}）\n\n${currentCard.cardInfo || ''}`;

      const prompt = getAnnualFortunePrompt({
        overviewText,
        monthNumber,
        currentCardDetail,
        nickName,
        careerStatus,
        gender,
        loveStatus,
        careerStatusLabel,
        genderLabel,
        loveStatusLabel,
        timeInfo
      });
      
      // 保存 prompt 到数组，后续异步保存（不阻塞）
      promptsToSave.push({ monthNumber, prompt });

      // 记录网络请求开始时间
      const requestStartTime = Date.now();

      try {
        // 尝试使用 response_format（如果模型支持）
        const requestOptions: any = {
          model,
          temperature: LLM_TEMPERATURES.annualMonth,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        };

        // OpenAI 的 gpt-4o-mini 支持 response_format，DeepSeek 可能不支持
        if (provider === "openai") {
          requestOptions.response_format = { type: "json_object" };
        }

        const response = await client.chat.completions.create(requestOptions);
        
        // 记录网络请求结束时间
        const requestEndTime = Date.now();
        const requestDuration = requestEndTime - requestStartTime;
        timeStats.networkRequests.push({
          month: monthNumber,
          startTime: requestStartTime - startTime,
          endTime: requestEndTime - startTime,
          duration: requestDuration
        });

        const parseStartTime = Date.now();
        const rawContent = response.choices[0]?.message?.content || "{}";
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
    // 使用 setImmediate 确保在响应返回后才执行文件保存
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
        other: timeStats.total - timeStats.preparation - timeStats.totalNetworkTime - timeStats.parsing
      }
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

