import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { getAnnualFortuneGoodLuckItemsPrompt, LLM_TEMPERATURES } from "@/lib/prompts";

const clientCache = new Map<"openai" | "deepseek", OpenAI>();

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

type AreaGoodLuckItemsInput = {
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
    other: 0
  };

  try {
    const prepStart = Date.now();
    const body = await req.json();
    const {
      provider = "openai",
      decemberContent,
      areas
    } = body as {
      provider?: "openai" | "deepseek";
      decemberContent: string;
      areas: AreaGoodLuckItemsInput[];
    };

    if (!decemberContent) {
      return NextResponse.json({ ok: false, error: "需要提供十二月运势内容" }, { status: 400 });
    }

    if (!Array.isArray(areas) || areas.length === 0) {
      return NextResponse.json({ ok: false, error: "需要提供至少一个领域解读" }, { status: 400 });
    }

    const areaInfoText = areas
      .map((a) => {
        return [
          `【${a.areaName}】`,
          `一句话主命题：${a.hookSentece || "（未提供）"}`,
          `解读内容：${a.content || "（未提供）"}`,
          `关键提醒：${a.summaryHighlight || "（未提供）"}`
        ].join("\n");
      })
      .join("\n\n");

    const prompt = getAnnualFortuneGoodLuckItemsPrompt({
      decemberContent,
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

    const requestOptions: any = {
      model,
      temperature: LLM_TEMPERATURES.annualGoodLuckItems,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    if (provider === "openai") {
      requestOptions.response_format = { type: "json_object" };
    }

    const apiStart = Date.now();
    const response = await client.chat.completions.create(requestOptions);
    const apiEnd = Date.now();
    timeStats.aiApiCall = apiEnd - apiStart;

    const parseStart = Date.now();
    const rawContent = response.choices[0]?.message?.content || "{}";
    let result: {
      analysis: string;
      goodLuckItem: string;
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
          { ok: false, error: "无法解析玄学指引好物 JSON" },
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
        const promptFileName = `good_luck_items_${timestamp}_prompt.txt`;
        const promptFilePath = path.join(outputDir, promptFileName);
        fs.writeFileSync(promptFilePath, prompt, "utf-8");
        console.log(`[玄学指引好物] Prompt 已保存到: ${promptFilePath}`);
      } catch (error) {
        console.error("[玄学指引好物] 保存 Prompt 失败:", error);
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
    console.error("[玄学指引好物] API 错误:", e);
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

