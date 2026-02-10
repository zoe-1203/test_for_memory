import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { tarotCards } from "@/app/new_prompts_from_hou/cards";
import { LLM_TEMPERATURES } from "@/lib/prompts";
import { annualForecast2026AreaPrompt } from "@/app/new_prompts_from_hou/annual-forecast-2026/prompt";

type Lang = 'cn' | 'tc' | 'en' | 'ja' | 'ko' | 'es';

// ========== 连接池复用：模块级 Client 缓存 ==========
const clientCache = new Map<"openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet", OpenAI | Anthropic>();

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

type AreaId = "love" | "career" | "wealth" | "health" | "relationship" | "innerGrowth";

type AreaCardInput = {
  areaId: AreaId;
  areaName: string;
  id: string;
  name: string;
  cnName: string;
  reversed: boolean;
};

function findCardInfo(card: { id: string; name: string; cnName: string }, lang: Lang = 'cn'): string {
  const matchById = tarotCards.find((tc) =>
    tc.key === card.id || tc.cnName === card.cnName || tc.enName === card.name
  );

  if (!matchById) return "";

  // 根据语言返回对应的牌意
  // ja/ko/es 使用英文牌意（匹配英文 Prompt）
  const isEnglishBased = lang === 'en' || lang === 'ja' || lang === 'ko' || lang === 'es';
  return isEnglishBased ? (matchById.en || matchById.cn) : matchById.cn;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    preparation: 0,
    networkRequests: [] as Array<{ areaId: AreaId; startTime: number; endTime: number; duration: number; tokens?: { prompt: number; completion: number; total: number } }>,
    totalNetworkTime: 0,
    parsing: 0,
    totalTokens: { prompt: 0, completion: 0, total: 0 }
  };

  try {
    const prepStart = Date.now();
    const body = await req.json();
    const {
      provider = "openai",
      language = "cn",
      areaCards,
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
      areaCards: AreaCardInput[];
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      careerStatusLabel?: string;
      genderLabel?: string;
      loveStatusLabel?: string;
      includeRawData?: boolean; // 新增
    };

    if (!Array.isArray(areaCards) || areaCards.length !== 6) {
      return NextResponse.json({ ok: false, error: "需要提供 6 张领域牌" }, { status: 400 });
    }

    const client = getCachedClient(provider);
    const model = getModel(provider);

    // 准备输出目录 & 时间戳（保存 prompt 用）
    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prepEnd = Date.now();
    timeStats.preparation = prepEnd - prepStart;

    const promptsToSave: Array<{ areaId: AreaId; areaName: string; prompt: string }> = [];
    // 新增：存储原始数据用于返回给前端
    const rawDataCollection: Array<{ areaId: AreaId; areaName: string; prompt: string; rawResponse: string }> = [];

    const areaPromises = areaCards.map(async (card) => {
      const cardInfo = findCardInfo(card, language);
      const cardContent = cardInfo || "（未找到对应牌意信息）";

      // 根据身份类型动态调整「事业·学业」在 Prompt 中的文案：
      // - 学生（middle_high_school / college_above）：使用「学业」
      // - 职场人/自由职业（worker / freelance）：使用「事业」
      // - 其他情况：保持原有 areaName（通常是「事业·学业」）
      let areaForPrompt = card.areaName;
      if (card.areaId === "career") {
        if (language === 'en') {
          areaForPrompt = (careerStatus === "middle_high_school" || careerStatus === "college_above") ? "Studies" : "Career";
        } else if (language === 'tc') {
          areaForPrompt = (careerStatus === "middle_high_school" || careerStatus === "college_above") ? "學業" : "事業";
        } else {
          areaForPrompt = (careerStatus === "middle_high_school" || careerStatus === "college_above") ? "学业" : "事业";
        }
      }

      const prompt = annualForecast2026AreaPrompt[language]({
        uid: '',
        lang: language,
        question: '',
        history: '',
        area: areaForPrompt,
        cardContent,
        userInfo: {
          nickname: nickName,
          gender,
          careerStatus,
          loveStatus
        }
      });

      promptsToSave.push({ areaId: card.areaId, areaName: card.areaName, prompt });

      const requestStart = Date.now();
      try {
        let rawContent: string;
        let tokenUsage: { prompt: number; completion: number; total: number } | undefined;

        if (provider === "anthropic-haiku" || provider === "anthropic-sonnet") {
          // Anthropic API 调用
          const anthropicClient = client as Anthropic;
          const response = await anthropicClient.messages.create({
            model,
            max_tokens: 4096,
            temperature: LLM_TEMPERATURES.annualArea,
            messages: [{ role: "user", content: prompt }]
          });

          rawContent = response.content[0].type === 'text' ? response.content[0].text : "{}";

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
            temperature: LLM_TEMPERATURES.annualArea,
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

        const requestEnd = Date.now();
        const duration = requestEnd - requestStart;

        if (tokenUsage) {
          timeStats.totalTokens.prompt += tokenUsage.prompt;
          timeStats.totalTokens.completion += tokenUsage.completion;
          timeStats.totalTokens.total += tokenUsage.total;
        }

        timeStats.networkRequests.push({
          areaId: card.areaId,
          startTime: requestStart - startTime,
          endTime: requestEnd - startTime,
          duration,
          tokens: tokenUsage
        });

        const parseStart = Date.now();
        let parsed: any;

        try {
          let text = rawContent.trim();
          const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (fenced) text = fenced[1].trim();
          parsed = JSON.parse(text);
        } catch {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch {
              parsed = {
                hookSentece: "解析失败",
                content: rawContent.substring(0, 500),
                summaryHighlight: ""
              };
            }
          } else {
            parsed = {
              hookSentece: "解析失败",
              content: rawContent.substring(0, 500),
              summaryHighlight: ""
            };
          }
        }

        const parseEnd = Date.now();
        timeStats.parsing += parseEnd - parseStart;

        // 新增：如果需要返回原始数据，保存到集合中
        if (includeRawData) {
          rawDataCollection.push({
            areaId: card.areaId,
            areaName: card.areaName,
            prompt,
            rawResponse: rawContent
          });
        }

        // 兼容两种写法：hookSentece（老拼写）和 hookSentence（更自然的拼写）
        const hookValue = parsed.hookSentece || parsed.hookSentence || "";

        // 如果 AI 返回的 Json 中没有提供 hookSentece / hookSentence，
        // 说明这一轮输出结构可能不完整，把原始输出内容单独保存到 txt 方便排查。
        if (!hookValue) {
          try {
            const safeAreaName = card.areaName.replace(/[\s\\/:*?"<>|]+/g, "_");
            const rawFileName = `area_${card.areaId}_${safeAreaName}_${timestamp}_raw_output.txt`;
            const rawFilePath = path.join(outputDir, rawFileName);
            fs.writeFileSync(rawFilePath, rawContent, "utf-8");
            console.log(`[年度运势领域] 原始输出已保存到: ${rawFilePath}`);
          } catch (err) {
            console.error("[年度运势领域] 保存原始输出失败:", err);
          }
        }

        return {
          areaId: card.areaId,
          areaName: card.areaName,
          card: {
            id: card.id,
            name: card.name,
            cnName: card.cnName,
            reversed: card.reversed
          },
          hookSentece: hookValue,
          content: parsed.content || "",
          summaryHighlight: parsed.summaryHighlight || "",
          success: true
        };
      } catch (e: any) {
        const requestEnd = Date.now();
        const duration = requestEnd - requestStart;
        timeStats.networkRequests.push({
          areaId: card.areaId,
          startTime: requestStart - startTime,
          endTime: requestEnd - startTime,
          duration
        });

        console.error("[年度运势领域] 请求失败:", e);
        return {
          areaId: card.areaId,
          areaName: card.areaName,
          card: {
            id: card.id,
            name: card.name,
            cnName: card.cnName,
            reversed: card.reversed
          },
          hookSentece: "请求失败",
          content: `错误：${e?.message || "unknown error"}`,
          summaryHighlight: "",
          success: false
        };
      }
    });

    const results = await Promise.all(areaPromises);
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    if (timeStats.networkRequests.length > 0) {
      const firstStart = Math.min(...timeStats.networkRequests.map((r) => r.startTime));
      const lastEnd = Math.max(...timeStats.networkRequests.map((r) => r.endTime));
      timeStats.totalNetworkTime = lastEnd - firstStart;
    }
    timeStats.total = elapsedTime;

    // 异步保存 Prompt
    setImmediate(() => {
      promptsToSave.forEach(({ areaId, areaName, prompt }) => {
        try {
          const safeArea = areaId;
          const promptFileName = `area_${safeArea}_${timestamp}_prompt.txt`;
          const promptFilePath = path.join(outputDir, promptFileName);
          fs.writeFileSync(promptFilePath, prompt, "utf-8");
          console.log(`[年度运势领域] 领域 ${areaName} Prompt 已保存到: ${promptFilePath}`);
        } catch (error) {
          console.error(`[年度运势领域] 保存 Prompt 失败:`, error);
        }
      });
    });

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      results,
      elapsedTime,
      timeStats,
      // 新增：有条件返回原始数据
      ...(includeRawData && { rawData: rawDataCollection })
    });
  } catch (e: any) {
    console.error("[年度运势领域] API 错误:", e);
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


