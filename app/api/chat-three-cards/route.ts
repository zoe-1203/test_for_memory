import { NextResponse } from "next/server";
import OpenAI from "openai";
import { tarotCardMeanings } from "@/data/tarot_card_meanings_cleanWord";
import { getInterpretationSystemPrompt } from "@/lib/prompts";

// 兼容 openai / deepseek
function getClient(provider: "openai" | "deepseek") {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    return new OpenAI({ apiKey });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  return new OpenAI({ apiKey, baseURL });
}

function getModel(provider: "openai" | "deepseek") {
  return provider === "openai" ? "gpt-4o-mini" : "deepseek-chat";
}

// 抽取多张牌（不经模型），保证不重复
function drawCards(count: number) {
  const indices = new Set<number>();
  while (indices.size < count && indices.size < tarotCardMeanings.length) {
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
  try {
    const body = await req.json();
    const {
      provider = "openai",
      question,
      additionalInfo = "",
      questionDate = "",
      memoryText = ""
    } = body as {
      provider?: "openai" | "deepseek";
      question: string;
      additionalInfo?: string;
      questionDate?: string;
      memoryText?: string;
    };

    if (!question) {
      return NextResponse.json({ ok: false, error: "缺少必要参数 question" }, { status: 400 });
    }

    const client = getClient(provider);
    const model = getModel(provider);

    // 1) 抽三张牌
    const cards = drawCards(3);

    // 组合牌意信息
    const cardInfo = cards
      .map((c, index) => {
        const pos = index === 0 ? "第1张" : index === 1 ? "第2张" : "第3张";
        return `${pos}：${c.cnName}（${c.reversed ? "逆位" : "正位"}）\n${c.cardInfo}`;
      })
      .join("\n\n");

    // 2) 组合 Prompt，调用模型生成解读
    const interpretPrompt = getInterpretationSystemPrompt({
      question,
      additionalInfo: additionalInfo || "",
      memoryText: memoryText || "（无）",
      cardInfo,
      questionDate: questionDate || "（未提供）",
      cardCount: 3
    });

    const interpretation = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: interpretPrompt },
        {
          role: "user",
          content: [
            `问题：${question}`,
            `提问日期：${questionDate || "（未提供）"}`,
            `抽到的牌：${cards
              .map((c, i) => `第${i + 1}张 ${c.name}（${c.reversed ? "逆位" : "正位"}）`)
              .join("，")}`,
            `用户提供的 Memory：${memoryText || "（无）"}`,
            `附加信息：${additionalInfo || "（无）"}`
          ].join("\n")
        }
      ]
    });

    const text = interpretation.choices[0]?.message?.content || "";

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      cards: cards.map((c) => ({ id: c.id, name: c.name, reversed: c.reversed })),
      interpretation: text
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 });
  }
}









