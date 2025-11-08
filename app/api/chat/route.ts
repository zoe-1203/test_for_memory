import { NextResponse } from "next/server";
import OpenAI from "openai";
import { tarotCardMeanings } from "@/data/tarot_card_meanings_cleanWord";
import { toolDefinitions, formatMemoriesForTools, filterMemoriesByArea } from "@/lib/tools";
import { MEMORY_SELECTION_SYSTEM_PROMPT, getInterpretationSystemPrompt } from "@/lib/prompts";
import { MEMORY_AREAS, type MemoryItem, type MemoryAreaId } from "@/lib/types";

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

// 本地实现：抽牌（不经模型）
function drawOneCard() {
  const idx = Math.floor(Math.random() * tarotCardMeanings.length);
  const reversed = Math.random() < 0.5;
  const cardData = tarotCardMeanings[idx];
  
  // 从 cnName 中提取 id 和 name
  // cnName 格式如: "0 愚者"、"1 魔术师" 等
  const match = cardData.cnName.match(/^(\d+)\s+(.+)$/);
  const id = match ? match[1] : String(idx);
  const name = match ? match[2] : cardData.cnName;
  
  const card = {
    id,
    name,
    cnName: cardData.cnName,
    cardInfo: cardData.cardInfo
  };
  
  return { card, reversed };
}

// 本地实现工具：从指定 area 下的 memory 列表中选择最相关的（基于索引）
function selectMemoriesByArea(args: {
  question: string;
  additionalInfo?: string;
  areaId: string;
  memoryTexts: string[]; // 格式化后的 memory 文本列表
  limit?: number;
}) {
  const { question, additionalInfo = "", memoryTexts, limit = 3 } = args;

  function scoreOf(text: string) {
    const t = text.toLowerCase();
    let score = 0;
    // 简单加分规则：包含问题关键字/附加信息的分
    for (const kw of (question + " " + additionalInfo).split(/[\s，。；、,.;!?]+/).filter(Boolean)) {
      if (kw && t.includes(kw.toLowerCase())) score += 2;
    }
    // 长度轻微惩罚，避免太长
    score -= Math.max(0, Math.floor(t.length / 200));
    return score;
  }

  const ranked = memoryTexts
    .map((text, index) => ({ index, text, _score: scoreOf(text) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, Math.max(1, limit));

  return ranked.map((item) => item.index); // 返回索引列表
}

// 本地实现工具：取最近的 N 条（按日期排序）
function selectLatestMemories(args: { memories: MemoryItem[]; limit?: number }) {
  const { memories, limit = 2 } = args;
  const ranked = memories
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, Math.max(1, limit));
  return ranked.map((m) => m.id);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      provider = "openai",
      question,
      additionalInfo = "",
      questionDate = "", // YYYY-MM-DD（来自前端）
      memories = [] as MemoryItem[]
    } = body as {
      provider?: "openai" | "deepseek";
      question: string;
      additionalInfo?: string;
      questionDate?: string;
      memories: MemoryItem[];
    };

    if (!question || !Array.isArray(memories)) {
      return NextResponse.json({ ok: false, error: "缺少必要参数 question 或 memories" }, { status: 400 });
    }

    // 1) 本地抽牌
    const { card, reversed } = drawOneCard();

    // 2) 通过模型 + tools 选择 memory（工具本地实现）
    const client = getClient(provider);
    const model = getModel(provider);

    // 系统提示：指导模型何时调用哪个工具（Memory 选择）
    const sys = MEMORY_SELECTION_SYSTEM_PROMPT;

    // 准备可用的领域列表
    const availableAreas = Object.values(MEMORY_AREAS).map(area => ({
      id: area.id,
      name: area.name,
      description: area.description
    }));

    // 把候选 memory 和上下文放给模型，让它来"决定调用哪个工具"
    const selection = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            `问题：${question}`,
            `提问日期：${questionDate || "（未提供）"}`,
            `额外信息：${additionalInfo || "（无）"}`,
            `可用的领域（Area）：${JSON.stringify(availableAreas, null, 2)}`,
            `用户存入的记忆包括：\n${formatMemoriesForTools(memories).map((m, i) => `${i}. ${m}`).join('\n')}`
          ].join("\n\n")
        }
      ],
      tools: toolDefinitions as any,
      tool_choice: "auto"
    });

    // 打印模型的完整回复
    console.log('[Memory Selection] 模型回复:', JSON.stringify(selection, null, 2));

    // 处理 tool calls（可能 0~多次）
    const toolCalls = selection.choices[0]?.message?.tool_calls || [];
    console.log('[Memory Selection] 调用的工具数量:', toolCalls.length);
    
    let selectedAreaIds: MemoryAreaId[] = [];
    let selectedMemoryIds: string[] = [];

    for (const call of toolCalls) {
      if (!('function' in call)) continue;
      const name = call.function?.name;
      const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};

      console.log(`[Memory Selection] 工具调用: ${name}`);
      console.log(`[Memory Selection] 工具参数:`, JSON.stringify(args, null, 2));

      if (name === "select_relevant_area") {
        const areaIds = Array.isArray(args.areaIds) ? args.areaIds : [args.areaId].filter(Boolean);
        selectedAreaIds = areaIds as MemoryAreaId[];
        console.log(`[Memory Selection] 选中的领域: ${selectedAreaIds.join(', ')}`);
      }

      if (name === "get_memories_by_area") {
        const areaId = args.areaId as MemoryAreaId;
        if (!areaId || !selectedAreaIds.includes(areaId)) {
          console.warn(`[Memory Selection] 警告：领域 ${areaId} 未在选中的领域列表中，跳过`);
          continue;
        }
        // 获取该领域下的所有 memory
        const areaMemories = filterMemoriesByArea(memories, areaId);
        const areaMemoryTexts = formatMemoriesForTools(areaMemories);
        
        // 从该领域下的 memory 中选择（返回索引）
        const indices = selectMemoriesByArea({
          question: args.question,
          additionalInfo: args.additionalInfo || "",
          areaId: areaId,
          memoryTexts: areaMemoryTexts,
          limit: args.limit || 3
        });
        
        // 将索引转换为 memory IDs
        const ids = indices.map(idx => areaMemories[idx].id);
        console.log(`[Memory Selection] ${name} 返回的 Memory IDs (领域: ${areaId}):`, ids);
        selectedMemoryIds = Array.from(new Set([...selectedMemoryIds, ...ids]));
      }

      if (name === "get_latest_memory") {
        // 从所有 memory 中按时间选择最近的
        const ids = selectLatestMemories({
          memories,
          limit: args.limit || 2
        });
        console.log(`[Memory Selection] ${name} 返回的 Memory IDs:`, ids);
        selectedMemoryIds = Array.from(new Set([...selectedMemoryIds, ...ids]));
      }
    }

    console.log('[Memory Selection] 最终选中的 Memory IDs:', selectedMemoryIds);

    const selectedMemories = memories.filter((m) => selectedMemoryIds.includes(m.id));

    // 格式化 selectedMemories 为字符串
    const memoryText = selectedMemories.length > 0
      ? selectedMemories.map((m) => {
          const areaInfo = MEMORY_AREAS[m.area];
          const relatedPeople = m.relatedPeople || [];
          const peopleText = relatedPeople.length > 0 ? `（涉及：${relatedPeople.join('、')}）` : '';
          const date = new Date(m.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `- ${year}年${month}月${day}日 ${areaInfo.emoji} ${areaInfo.name}${peopleText}：${m.content}`;
        }).join('\n')
      : '（无）';

    // 3) 组合 Prompt，调用模型生成解读
    const interpretPrompt = getInterpretationSystemPrompt({
      question,
      additionalInfo: additionalInfo || "",
      memoryText,
      cardInfo: card.cardInfo,
      questionDate: questionDate || "（未提供）"
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
            `抽到的牌：${card.name}（${reversed ? "逆位" : "正位"}）`,
            `选中的 Memory：${JSON.stringify(selectedMemories)}`,
            `附加信息：${additionalInfo || "（无）"}`
          ].join("\n")
        }
      ]
    });

    const text = interpretation.choices[0]?.message?.content || "";

    return NextResponse.json({
      ok: true,
      providerUsed: provider,
      card: { id: card.id, name: card.name, reversed },
      selectedMemories,
      interpretation: text
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 });
  }
}
