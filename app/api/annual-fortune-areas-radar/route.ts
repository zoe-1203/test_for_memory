import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { LLM_TEMPERATURES } from "@/lib/prompts";
import { annualForecast2026RadarPrompt } from "@/app/new_prompts_from_hou/annual-forecast-2026/prompt";

type Lang = 'cn' | 'tc' | 'en' | 'ja' | 'ko' | 'es';

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

type RadarAreaInput = {
  areaId: AreaId;
  areaName: string;
  hookSentece: string;
  content: string;
  summaryHighlight: string;
};

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    preparation: 0,
    aiApiCall: 0,
    responseParsing: 0,
    other: 0,
    tokens: { prompt: 0, completion: 0, total: 0 }
  };

  try {
    const prepStart = Date.now();
    const body = await req.json();
    const {
      provider = "openai",
      language = "cn",
      areas,
      nickName,
      careerStatus,
      gender,
      loveStatus,
      includeRawData = false // 新增：是否返回原始 prompt 和 response
    } = body as {
      provider?: "openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet";
      language?: Lang;
      areas: RadarAreaInput[];
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      includeRawData?: boolean; // 新增
    };

    if (!Array.isArray(areas) || areas.length !== 6) {
      return NextResponse.json({ ok: false, error: "需要提供 6 个领域的解读结果" }, { status: 400 });
    }

    const notProvided = language === 'en' ? '(Not provided)' : '（未提供）';
    const themeLabel = language === 'en' ? 'Theme' : '一句话主命题';
    const contentLabel = language === 'en' ? 'Content' : '解读内容';
    const highlightLabel = language === 'en' ? 'Key reminder' : '关键提醒';

    const areaInfoText = areas
      .map((a) => {
        return [
          `【${a.areaName}】`,
          `${themeLabel}：${a.hookSentece || notProvided}`,
          `${contentLabel}：${a.content || notProvided}`,
          `${highlightLabel}：${a.summaryHighlight || notProvided}`
        ].join("\n");
      })
      .join("\n\n");

    const prompt = annualForecast2026RadarPrompt[language]({
      uid: '',
      lang: language,
      question: '',
      history: '',
      areaInfoText
    });

    const client = getCachedClient(provider);
    const model = getModel(provider);

    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prepEnd = Date.now();
    timeStats.preparation = prepEnd - prepStart;

    const apiStart = Date.now();
    let rawContent: string;

    if (provider === "anthropic-haiku" || provider === "anthropic-sonnet") {
      // Anthropic API 调用
      const anthropicClient = client as Anthropic;
      const response = await anthropicClient.messages.create({
        model,
        max_tokens: 4096,
        temperature: LLM_TEMPERATURES.annualAreaRadar,
        messages: [{ role: "user", content: prompt }]
      });

      rawContent = response.content[0].type === 'text' ? response.content[0].text : "{}";

      timeStats.tokens.prompt = response.usage.input_tokens;
      timeStats.tokens.completion = response.usage.output_tokens;
      timeStats.tokens.total = response.usage.input_tokens + response.usage.output_tokens;
    } else {
      // OpenAI/DeepSeek API 调用
      const openaiClient = client as OpenAI;
      const requestOptions: any = {
        model,
        temperature: LLM_TEMPERATURES.annualAreaRadar,
        messages: [{ role: "user", content: prompt }]
      };

      if (provider === "openai") {
        requestOptions.response_format = { type: "json_object" };
      }

      const response = await openaiClient.chat.completions.create(requestOptions);
      rawContent = response.choices[0]?.message?.content || "{}";

      if (response.usage) {
        timeStats.tokens.prompt = response.usage.prompt_tokens || 0;
        timeStats.tokens.completion = response.usage.completion_tokens || 0;
        timeStats.tokens.total = response.usage.total_tokens || 0;
      }
    }

    const apiEnd = Date.now();
    timeStats.aiApiCall = apiEnd - apiStart;

    const parseStart = Date.now();
    let result: {
      analysis: string;
      love: number;
      career: number;
      wealth: number;
      health: number;
      social: number;
      innerGrowth: number;
      startingOverview?: string;
    };

    try {
      let text = rawContent.trim();
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced) text = fenced[1].trim();
      result = JSON.parse(text);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { ok: false, error: "无法解析雷达图评分 JSON" },
          { status: 500 }
        );
      }
    }

    const parseEnd = Date.now();
    timeStats.responseParsing = parseEnd - parseStart;

    const endTime = Date.now();
    timeStats.total = endTime - startTime;
    timeStats.other = timeStats.total - timeStats.preparation - timeStats.aiApiCall - timeStats.responseParsing;

    // 异步保存 Prompt
    setImmediate(() => {
      try {
        const promptFileName = `areas_radar_${timestamp}_prompt.txt`;
        const promptFilePath = path.join(outputDir, promptFileName);
        fs.writeFileSync(promptFilePath, prompt, "utf-8");
        console.log(`[年度运势领域雷达] Prompt 已保存到: ${promptFilePath}`);
      } catch (error) {
        console.error("[年度运势领域雷达] 保存 Prompt 失败:", error);
      }
    });

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      result,
      elapsedTime: timeStats.total,
      timeStats,
      // 新增：有条件返回原始数据
      ...(includeRawData && {
        rawData: {
          prompt,
          rawResponse: rawContent
        }
      })
    });
  } catch (e: any) {
    console.error("[年度运势领域雷达] API 错误:", e);
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


