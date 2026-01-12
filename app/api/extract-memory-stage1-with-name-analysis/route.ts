import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts, ANALYZE_NAME_PROMPT, replacePlaceholders } from "@/lib/prompts_current";

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

// 截断塔罗师第一次回复的第一个自然段
function truncateFirstTarotReply(session: string): string {
  const tarotReplyStart = session.indexOf('塔罗师回："');
  if (tarotReplyStart === -1) {
    return session;
  }

  const quoteStart = tarotReplyStart + '塔罗师回："'.length;
  const replyContent = session.substring(quoteStart);

  const firstNewlineIndex = replyContent.indexOf('\n');
  if (firstNewlineIndex === -1) {
    return session;
  }

  const firstParagraph = replyContent.substring(0, firstNewlineIndex);
  const afterFirstParagraph = replyContent.substring(firstNewlineIndex);
  const separatorIndex = afterFirstParagraph.indexOf('\n---');
  const searchEnd = separatorIndex !== -1 ? firstNewlineIndex + separatorIndex : replyContent.length;

  let endQuoteIndex = -1;
  for (let i = searchEnd - 1; i >= firstNewlineIndex; i--) {
    if (replyContent[i] === '"') {
      endQuoteIndex = i;
      break;
    }
  }

  if (endQuoteIndex === -1) {
    return session;
  }

  const beforeReply = session.substring(0, quoteStart);
  const afterReply = replyContent.substring(endQuoteIndex + 1);

  return beforeReply + firstParagraph + '"' + afterReply;
}

// 解析对话文件，按 === 分割
function parseDialogueFile(contentOverride?: string, fileName?: string): string[] {
  const defaultFile = "0B862A48-0A75-4D60-8427-952E9B15B2EC_extracted_timeOrder.txt";
  const targetFile = fileName || defaultFile;

  const content = contentOverride ?? fs.readFileSync(
    path.join(process.cwd(), "data", "raw_dialogue", targetFile),
    "utf-8"
  );

  return content
    .split(/^===\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => truncateFirstTarotReply(s));
}

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Stage1 + Name Analysis] ===== 开始处理请求 =====`);

  try {
    const body = await req.json();
    const { provider = "openai", fileContent, roundLimit, startFrom, saveToFile, selectedFile } = body as {
      provider?: "openai" | "deepseek";
      fileContent?: string;
      roundLimit?: number;
      startFrom?: number;
      saveToFile?: boolean;
      selectedFile?: string;
    };
    const shouldSave = saveToFile ?? true;
    const startIndex = Math.max(0, startFrom ?? 0);

    console.log(`[Stage1 + Name Analysis] 使用模型提供方: ${provider}, 文件: ${selectedFile || '默认'}`);

    // 1. 加载 prompt 模板（只提取 facts 的版本）
    const stage1Template = EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts.trim();

    // 2. 解析对话文件
    const dialogueSessions = parseDialogueFile(fileContent, selectedFile);

    if (dialogueSessions.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "对话文件为空或格式不正确"
      }, { status: 400 });
    }

    const sliceEnd = typeof roundLimit === "number" && roundLimit > 0
      ? startIndex + roundLimit
      : dialogueSessions.length;
    const limitedSessions = dialogueSessions.slice(startIndex, sliceEnd);

    console.log(`[Stage1 + Name Analysis] 找到 ${limitedSessions.length} 个对话轮次（原始 ${dialogueSessions.length}），startFrom=${startIndex}，roundLimit=${roundLimit ?? 'all'}`);

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录（可选）
    let outputDir = "";
    if (shouldSave) {
      outputDir = path.join(process.cwd(), "data", "extracted_memories_stage1_with_name_analysis");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    // 5. 循环处理每一轮对话
    const results: Array<{
      round: number;
      stage1Summary: string;
      stage1RawOutput: string;
      nameAnalysis: string;
      ifHasOtherName: boolean | null;
      thisSessionRaw: string;
      savedPath?: string;
    }> = [];

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    for (let i = 0; i < limitedSessions.length; i++) {
      // 检查请求是否已被中止
      if (req.signal?.aborted) {
        console.log(`[Stage1 + Name Analysis] 请求已被中止，停止处理。已完成 ${results.length}/${limitedSessions.length} 轮`);
        return NextResponse.json({
          ok: true,
          results,
          aborted: true,
          totalRounds: results.length,
          totalTimeMs: Date.now() - startTime,
          message: `已中止，完成了 ${results.length}/${limitedSessions.length} 轮`
        });
      }

      const thisSessionRaw = limitedSessions[i];
      const round = startIndex + i + 1;

      console.log(`[Stage1 + Name Analysis] 处理第 ${round} 轮对话`);

      if (!thisSessionRaw || thisSessionRaw.trim().length === 0) {
        const errorMsg = `第 ${round} 轮对话内容为空！`;
        console.error(`[Stage1 + Name Analysis] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // ===== 第一轮：提取 facts =====
      console.log(`[Stage1 + Name Analysis] 第 ${round} 轮：开始第一轮（提取 facts）...`);
      const stage1Prompt = replacePlaceholders(stage1Template, {
        this_session_raw: thisSessionRaw
      });

      const stage1ApiStartTime = Date.now();
      let stage1Response;
      try {
        stage1Response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: stage1Prompt },
            { role: "user", content: "请根据上述规则提取事实信息。" }
          ]
        });
        console.log(`[Stage1 + Name Analysis] 第 ${round} 轮 第一轮：API 调用成功（耗时 ${Date.now() - stage1ApiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Stage1 + Name Analysis] 第 ${round} 轮 第一轮：API 调用出错:`, e?.message);
        throw e;
      }

      const stage1Output = stage1Response.choices[0]?.message?.content || "";

      // ===== 第二轮：分析是否有明确称呼 =====
      console.log(`[Stage1 + Name Analysis] 第 ${round} 轮：开始第二轮（分析称呼）...`);
      const analyzeApiStartTime = Date.now();
      let analyzeResponse;
      try {
        analyzeResponse = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: stage1Prompt },
            { role: "user", content: "请根据上述规则提取事实信息。" },
            { role: "assistant", content: stage1Output },
            { role: "user", content: ANALYZE_NAME_PROMPT }
          ]
        });
        console.log(`[Stage1 + Name Analysis] 第 ${round} 轮 第二轮：API 调用成功（耗时 ${Date.now() - analyzeApiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Stage1 + Name Analysis] 第 ${round} 轮 第二轮：API 调用出错:`, e?.message);
        throw e;
      }

      const analyzeOutput = analyzeResponse.choices[0]?.message?.content || "";

      // 解析 ifHasOtherName 的值
      let ifHasOtherName: boolean | null = null;
      const ifHasNameMatch = analyzeOutput.match(/<ifHasOtherName>\s*(True|False)\s*<\/ifHasOtherName>/i);
      if (ifHasNameMatch) {
        ifHasOtherName = ifHasNameMatch[1].toLowerCase() === 'true';
      }

      // 合并输出
      const combinedOutput = `${stage1Output}\n\n${analyzeOutput}`;

      let savedPath: string | undefined;

      if (shouldSave) {
        const fileName = `round_${round}_${timestamp}.md`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, combinedOutput, "utf-8");
        console.log(`[Stage1 + Name Analysis] 第 ${round} 轮输出已保存到: ${filePath}`);
        savedPath = `data/extracted_memories_stage1_with_name_analysis/${fileName}`;
      }

      results.push({
        round,
        stage1Summary: stage1Output,
        stage1RawOutput: stage1Output,
        nameAnalysis: analyzeOutput,
        ifHasOtherName,
        thisSessionRaw,
        savedPath
      });

      console.log(`[Stage1 + Name Analysis] 第 ${round} 轮完成，ifHasOtherName=${ifHasOtherName}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Stage1 + Name Analysis] ===== 处理完成 =====`);
    console.log(`[Stage1 + Name Analysis] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
    console.log(`[Stage1 + Name Analysis] 处理了 ${results.length} 轮对话`);

    return NextResponse.json({
      ok: true,
      results,
      totalRounds: results.length,
      totalTimeMs: totalTime
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Stage1 + Name Analysis] ===== 处理出错 =====`);
    console.error(`[Stage1 + Name Analysis] 错误信息:`, e?.message);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "unknown error"
      },
      { status: 500 }
    );
  }
}
