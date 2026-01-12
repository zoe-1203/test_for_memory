import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { EXTRACT_MEMORY_MARKDOWN_PROMPT } from "@/lib/prompts_memory";

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

// 读取 Markdown prompt 文件
function loadPromptTemplate(): string {
  return EXTRACT_MEMORY_MARKDOWN_PROMPT.trim();
}

// 替换占位符
function replacePlaceholders(
  template: string,
  oldFacts: string,
  oldTarotOverview: string,
  thisSessionRaw: string
): string {
  return template
    .replace(/\{\{old_factual_memory\}\}/g, oldFacts || "（无）")
    .replace(/\{\{old_tarot_overview\}\}/g, oldTarotOverview || "（无）")
    .replace(/\{\{this_session_raw\}\}/g, thisSessionRaw);
}

// 截断塔罗师第一次回复的第一个自然段
function truncateFirstTarotReply(session: string): string {
  // 找到"用户问："后面的"塔罗师回："
  const tarotReplyStart = session.indexOf('塔罗师回："');
  if (tarotReplyStart === -1) {
    return session; // 如果没有找到，返回原内容
  }
  
  const quoteStart = tarotReplyStart + '塔罗师回："'.length;
  const replyContent = session.substring(quoteStart);
  
  // 找到第一个自然段（到第一个换行符）
  const firstNewlineIndex = replyContent.indexOf('\n');
  if (firstNewlineIndex === -1) {
    return session; // 如果没有换行符，返回原内容
  }
  
  // 找到第一个自然段
  const firstParagraph = replyContent.substring(0, firstNewlineIndex);
  
  // 找到整个回复的结束引号（应该在---分隔符之前或文件末尾）
  const afterFirstParagraph = replyContent.substring(firstNewlineIndex);
  const separatorIndex = afterFirstParagraph.indexOf('\n---');
  const searchEnd = separatorIndex !== -1 ? firstNewlineIndex + separatorIndex : replyContent.length;
  
  // 在搜索范围内找到最后一个引号
  let endQuoteIndex = -1;
  for (let i = searchEnd - 1; i >= firstNewlineIndex; i--) {
    if (replyContent[i] === '"') {
      endQuoteIndex = i;
      break;
    }
  }
  
  if (endQuoteIndex === -1) {
    return session; // 如果没有找到结束引号，返回原内容
  }
  
  // 构建替换后的内容：保留第一个自然段，删除中间的内容
  const beforeReply = session.substring(0, quoteStart);
  const afterReply = replyContent.substring(endQuoteIndex + 1);
  
  return beforeReply + firstParagraph + '"' + afterReply;
}

function parseDialogueFile(): string[] {
  const dialoguePath = path.join(
    process.cwd(),
    "data",
    "raw_dialogue",
    "0B862A48-0A75-4D60-8427-952E9B15B2EC_extracted_timeOrder.txt"
  );

  const content = fs.readFileSync(dialoguePath, "utf-8");
  return content
    .split(/^===\s*$/m)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => truncateFirstTarotReply(s)); // 应用截断函数
}

function parseMarkdownResponse(text: string) {
  const trimmed = text.trim();
  const factsMatch = trimmed.match(/#\s*facts:\s*([\s\S]*?)(?:\n\s*#\s*tarot overview:|\s*$)/i);
  const tarotMatch = trimmed.match(/#\s*tarot overview:\s*([\s\S]*)$/i);

  if (!factsMatch || !tarotMatch) {
    throw new Error("模型返回格式不符合预期（缺少 facts 或 tarot overview）");
  }

  return {
    facts: factsMatch[1].trim(),
    tarotOverview: tarotMatch[1].trim(),
    rawOutput: trimmed
  };
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Extract Memory Markdown] ===== 开始处理请求 =====`);

  try {
    const body = await req.json();
    const { provider = "openai" } = body as { provider?: "openai" | "deepseek" };
    console.log(`[Extract Memory Markdown] 使用模型提供方: ${provider}`);

    const promptTemplate = loadPromptTemplate();
    const dialogueSessions = parseDialogueFile();

    if (dialogueSessions.length === 0) {
      return NextResponse.json({ ok: false, error: "对话文件为空或格式不正确" }, { status: 400 });
    }

    console.log(`[Extract Memory Markdown] 找到 ${dialogueSessions.length} 个对话轮次`);

    const client = getClient(provider);
    const model = getModel(provider);

    const outputDir = path.join(process.cwd(), "data", "extracted_memories_markdown");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results: Array<{
      round: number;
      facts: string;
      tarotOverview: string;
      rawOutput: string;
      savedFilePath?: string;
      savedPromptPath?: string;
      promptText?: string;
    }> = [];

    let oldFacts = "";
    let oldTarotOverview = "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    for (let i = 0; i < dialogueSessions.length; i++) {
      const round = i + 1;
      const thisSessionRaw = dialogueSessions[i];
      console.log(`[Extract Memory Markdown] 处理第 ${round} 轮对话`);

      const prompt = replacePlaceholders(promptTemplate, oldFacts, oldTarotOverview, thisSessionRaw);

      console.log(`[Extract Memory Markdown] 第 ${round} 轮：开始调用模型 API...`);
      const apiStartTime = Date.now();
      let response;
      try {
        response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: "请根据上述要求输出 Markdown 结果。" }
          ]
        });
        console.log(`[Extract Memory Markdown] 第 ${round} 轮：调用成功（耗时 ${Date.now() - apiStartTime}ms）`);
      } catch (error: any) {
        console.error(`[Extract Memory Markdown] 第 ${round} 轮调用失败:`, error?.message);
        throw error;
      }

      const responseText = response.choices[0]?.message?.content || "";
      console.log(`[Extract Memory Markdown] 第 ${round} 轮：收到响应，长度 ${responseText.length} 字符`);

      const parsed = parseMarkdownResponse(responseText);

      const markdownFileName = `round_${round}_${timestamp}.md`;
      const markdownFilePath = path.join(outputDir, markdownFileName);
      fs.writeFileSync(markdownFilePath, parsed.rawOutput, "utf-8");
      console.log(`[Extract Memory Markdown] 第 ${round} 轮 Markdown 已保存到: ${markdownFilePath}`);

      const promptFileName = `round_${round}_${timestamp}_prompt.txt`;
      const promptFilePath = path.join(outputDir, promptFileName);
      fs.writeFileSync(promptFilePath, prompt, "utf-8");

      results.push({
        round,
        facts: parsed.facts,
        tarotOverview: parsed.tarotOverview,
        rawOutput: parsed.rawOutput,
        savedFilePath: `data/extracted_memories_markdown/${markdownFileName}`,
        savedPromptPath: `data/extracted_memories_markdown/${promptFileName}`,
        promptText: prompt
      });

      oldFacts = parsed.facts;
      oldTarotOverview = parsed.tarotOverview;

      const roundEndTime = Date.now();
      console.log(`[Extract Memory Markdown] 第 ${round} 轮完成（总耗时 ${roundEndTime - apiStartTime}ms）`);
      console.log(`[Extract Memory Markdown] 进度: ${round}/${dialogueSessions.length} (${Math.round(round / dialogueSessions.length * 100)}%)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Extract Memory Markdown] ===== 处理完成 ===== 总耗时 ${totalTime}ms`);

    return NextResponse.json({
      ok: true,
      results,
      totalRounds: results.length,
      totalTimeMs: totalTime
    });
  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Extract Memory Markdown] ===== 处理出错 =====`);
    console.error(`[Extract Memory Markdown] 错误信息:`, e?.message);
    console.error(`[Extract Memory Markdown] 出错前耗时: ${totalTime}ms`);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "unknown error",
        errorDetails: process.env.NODE_ENV === "development" ? e?.stack : undefined
      },
      { status: 500 }
    );
  }
}

