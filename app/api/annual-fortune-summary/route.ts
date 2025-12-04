import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { getAnnualFortuneSummaryPrompt, LLM_TEMPERATURES } from "@/lib/prompts";

// ========== 连接池复用：模块级 Client 缓存 ==========
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

export async function POST(req: Request) {
  const startTime = Date.now();
  const timeStats = {
    total: 0,
    requestParsing: 0, // 请求解析时间
    promptGeneration: 0, // Prompt 生成时间
    aiApiCall: 0, // AI API 调用时间（精确）
    responseParsing: 0, // 响应解析时间
    other: 0 // 其他处理时间
  };
  
  try {
    const parseStartTime = Date.now();
    const body = await req.json();
    const parseEndTime = Date.now();
    timeStats.requestParsing = parseEndTime - parseStartTime;

    const {
      provider = "openai",
      monthlyContents, // 12个月的运势内容数组
      nickName,
      careerStatus,
      gender,
      loveStatus,
      careerStatusLabel,
      genderLabel,
      loveStatusLabel
    } = body as {
      provider?: "openai" | "deepseek";
      monthlyContents: string[];
      nickName?: string;
      careerStatus?: string;
      gender?: string;
      loveStatus?: string;
      careerStatusLabel?: string;
      genderLabel?: string;
      loveStatusLabel?: string;
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
    const prompt = getAnnualFortuneSummaryPrompt(monthlyContents, {
      nickName,
      careerStatus,
      gender,
      loveStatus
    });
    const promptEndTime = Date.now();
    timeStats.promptGeneration = promptEndTime - promptStartTime;

    // 调用 AI
    const requestOptions: any = {
      model,
      temperature: LLM_TEMPERATURES.annualSummary,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    // OpenAI 支持 response_format
    if (provider === "openai") {
      requestOptions.response_format = { type: "json_object" };
    }

    // 精确统计 AI API 调用时间
    const aiApiStartTime = Date.now();
    const response = await client.chat.completions.create(requestOptions);
    const aiApiEndTime = Date.now();
    timeStats.aiApiCall = aiApiEndTime - aiApiStartTime;

    const parseResponseStartTime = Date.now();
    const rawContent = response.choices[0]?.message?.content || "{}";
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
    const outputDir = path.join(process.cwd(), "data", "annual_fortune_prompts");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    
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

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      result,
      elapsedTime: timeStats.total,
      timeStats
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

