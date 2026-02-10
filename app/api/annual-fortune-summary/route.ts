import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { LLM_TEMPERATURES } from "@/lib/prompts";
import { annualForecast2026SummaryPrompt } from "@/app/new_prompts_from_hou/annual-forecast-2026/prompt";

type Lang = 'cn' | 'tc' | 'en' | 'ja' | 'ko' | 'es';

// ========== 连接池复用：模块级 Client 缓存 ==========
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

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    requestParsing: 0, // 请求解析时间
    promptGeneration: 0, // Prompt 生成时间
    aiApiCall: 0, // AI API 调用时间（精确）
    responseParsing: 0, // 响应解析时间
    other: 0, // 其他处理时间
    tokens: { prompt: 0, completion: 0, total: 0 } // Token 使用量统计
  };
  
  try {
    const parseStartTime = Date.now();
    const body = await req.json();
    const parseEndTime = Date.now();
    timeStats.requestParsing = parseEndTime - parseStartTime;

    const {
      provider = "openai",
      language = "cn",
      monthlyContents, // 12个月的运势内容数组
      nickName,
      careerStatus,
      gender,
      loveStatus,
      careerStatusLabel,
      genderLabel,
      loveStatusLabel,
      includeRawData = false // 新增：是否返回原始 prompt 和 response
    } = body as {
      provider?: "openai" | "deepseek" | "anthropic-haiku" | "anthropic-sonnet";
      language?: Lang;
      monthlyContents: string[];
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      careerStatusLabel?: string;
      genderLabel?: string;
      loveStatusLabel?: string;
      includeRawData?: boolean; // 新增
    };

    if (!monthlyContents || monthlyContents.length !== 12) {
      return NextResponse.json(
        { ok: false, error: "需要提供12个月的运势内容" },
        { status: 400 }
      );
    }

    // 获取缓存的 client（复用连接）
    const client = getCachedClient(provider);
    const model = getModel(provider);

    // 生成 Prompt 2
    const promptStartTime = Date.now();
    const prompt = annualForecast2026SummaryPrompt[language]({
      uid: '',
      lang: language,
      question: '',
      history: '',
      monthlyContents,
      userInfo: {
        nickname: nickName,
        gender,
        careerStatus,
        loveStatus
      }
    });
    const promptEndTime = Date.now();
    timeStats.promptGeneration = promptEndTime - promptStartTime;

    // 调用 AI
    const aiApiStartTime = Date.now();
    let rawContent: string;

    if (provider === "anthropic-haiku" || provider === "anthropic-sonnet") {
      // Anthropic API 调用
      const anthropicClient = client as Anthropic;
      const response = await anthropicClient.messages.create({
        model,
        max_tokens: 4096,
        temperature: LLM_TEMPERATURES.annualSummary,
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
        temperature: LLM_TEMPERATURES.annualSummary,
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

    const aiApiEndTime = Date.now();
    timeStats.aiApiCall = aiApiEndTime - aiApiStartTime;

    const parseResponseStartTime = Date.now();
    const parseResponseEndTime = Date.now();
    timeStats.responseParsing = parseResponseEndTime - parseResponseStartTime;

    let result: {
      analysis: string;
      hookStarting: string;
      summary: string;
      January: number;
      February: number;
      March: number;
      April: number;
      May: number;
      June: number;
      July: number;
      August: number;
      September: number;
      October: number;
      November: number;
      December: number;
    };

    try {
      // 兼容 ```json ... ``` 或 ``` ... ``` 包裹
      let text = rawContent.trim();
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced) text = fenced[1].trim();
      result = JSON.parse(text);
    } catch (e) {
      // 如果解析失败，尝试提取 JSON
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          return NextResponse.json(
            { ok: false, error: "无法解析AI返回的JSON格式" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { ok: false, error: "AI返回格式不正确" },
          { status: 500 }
        );
      }
    }

    const endTime = Date.now();
    timeStats.total = endTime - startTime;
    timeStats.other = timeStats.total - timeStats.requestParsing - timeStats.promptGeneration - timeStats.aiApiCall - timeStats.responseParsing;

    // 异步保存 Prompt 文件（不阻塞响应，不计算在耗时内）
    // 只在本地开发环境保存
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    if (!isProduction) {
      setImmediate(() => {
        try {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          const promptFileName = `summary_${timestamp}_prompt.txt`;
          const promptFilePath = path.join(outputDir, promptFileName);
          fs.writeFileSync(promptFilePath, prompt, "utf-8");
          console.log(`[年度运势总览] Prompt 已保存到: ${promptFilePath}`);
        } catch (error) {
          console.error(`[年度运势总览] 保存 Prompt 失败:`, error);
        }
      });
    }

    // 调试日志
    if (includeRawData) {
      console.log('[调试] annual-fortune-summary API 返回 rawData (prompt 长度:', prompt.length, 'rawResponse 长度:', rawContent.length, ')');
    } else {
      console.log('[调试] annual-fortune-summary API 未请求 rawData (includeRawData =', includeRawData, ')');
    }

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
    console.error('[年度运势总览] API 错误:', e);
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

