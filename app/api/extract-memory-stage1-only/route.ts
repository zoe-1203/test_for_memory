import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { EXTRACT_MEMORY_STAGE1_PROMPT } from "@/lib/prompts_memory";
import { EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts, replacePlaceholders } from "@/lib/prompts_current";

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

// 获取 Prompt
function loadPromptTemplate(yamlFileName: string): string {
  if (yamlFileName === "extract_memory_stage1.yaml") return EXTRACT_MEMORY_STAGE1_PROMPT.trim();
  if (yamlFileName === "extract_memory_stage1_xml.yaml") return EXTRACT_MEMORY_STAGE1_XML_PROMPT_OnlyFacts.trim();
  throw new Error(`未知的 prompt 文件: ${yamlFileName}`);
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
  // 从第一个换行符之后开始查找，找到最后一个引号（在---之前）
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
    .map(s => truncateFirstTarotReply(s)); // 应用截断函数
}

// 解析 stage1 输出（提取 facts）
function parseStage1Output(text: string): string {
  // 尝试提取 ## facts 后面的内容
  const factsMatch = text.match(/##\s*facts\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (factsMatch) {
    return factsMatch[1].trim();
  }
  // 如果没有找到，返回整个文本
  return text.trim();
}

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Extract Memory Stage1 Only] ===== 开始处理请求 =====`);
  
  try {
    const body = await req.json();
    const { provider = "openai", fileContent, roundLimit, startFrom, saveToFile, format = "markdown", selectedFile } = body as {
      provider?: "openai" | "deepseek";
      fileContent?: string;
      roundLimit?: number;
      startFrom?: number;
      saveToFile?: boolean;
      format?: "markdown" | "xml";
      selectedFile?: string;
    };
    const shouldSave = saveToFile ?? true;
    const startIndex = Math.max(0, startFrom ?? 0);

    console.log(`[Extract Memory Stage1 Only] 使用模型提供方: ${provider}, 格式: ${format}, 文件: ${selectedFile || '默认'}`);

    // 1. 加载 prompt 模板（根据格式选择）
    const templateName = format === "xml" ? "extract_memory_stage1_xml.yaml" : "extract_memory_stage1.yaml";
    const stage1Template = loadPromptTemplate(templateName);

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

    console.log(`[Extract Memory Stage1 Only] 找到 ${limitedSessions.length} 个对话轮次（原始 ${dialogueSessions.length}），startFrom=${startIndex}，roundLimit=${roundLimit ?? 'all'}`);

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录（可选，根据格式选择不同目录）
    let outputDir = "";
    if (shouldSave) {
      const dirName = format === "xml" ? "extracted_memories_stage1_only_xml" : "extracted_memories_stage1_only";
      outputDir = path.join(process.cwd(), "data", dirName);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    // 5. 循环处理每一轮对话（只做 Stage 1）
    const results: Array<{
      round: number;
      stage1Summary: string; // stage1 的摘要
      stage1RawOutput: string; // stage1 的原始输出
      stage1PromptText?: string; // stage1 的 prompt
      savedStage1Path?: string; // stage1 保存的文件路径
      savedStage1PromptPath?: string; // stage1 prompt 保存的文件路径
    }> = [];

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    for (let i = 0; i < limitedSessions.length; i++) {
      // 检查请求是否已被中止
      if (req.signal?.aborted) {
        console.log(`[Extract Memory Stage1 Only] 请求已被中止，停止处理。已完成 ${results.length}/${limitedSessions.length} 轮`);
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

      console.log(`[Extract Memory Stage1 Only] 处理第 ${round} 轮对话`);

      // 检查对话内容是否为空
      if (!thisSessionRaw || thisSessionRaw.trim().length === 0) {
        const errorMsg = `第 ${round} 轮对话内容为空！请检查对话文件格式是否正确。`;
        console.error(`[Extract Memory Stage1 Only] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮对话内容长度: ${thisSessionRaw.length} 字符`);
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮对话内容预览: ${thisSessionRaw.substring(0, 100)}...`);

      // ===== Stage 1: 提取本轮对话的摘要 =====
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮：开始 Stage 1...`);
      const stage1Prompt = replacePlaceholders(stage1Template, {
        this_session_raw: thisSessionRaw
      });

      // 检查占位符是否被成功替换
      if (stage1Prompt.includes('{{this_session_raw}}') || stage1Prompt.includes('{{dialogue}}')) {
        const errorMsg = `第 ${round} 轮：占位符未被替换！Prompt 中仍包含占位符。请检查 YAML 文件中的占位符名称是否与代码中的 key 一致。`;
        console.error(`[Extract Memory Stage1 Only] ${errorMsg}`);
        console.error(`[Extract Memory Stage1 Only] Prompt 预览: ${stage1Prompt.substring(0, 500)}`);
        throw new Error(errorMsg);
      }

      const stage1ApiStartTime = Date.now();
      let stage1Response;
      try {
        stage1Response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: stage1Prompt
            },
            {
              role: "user",
              content: "请根据上述规则提取事实信息。"
            }
          ]
        });
        console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1：API 调用成功（耗时 ${Date.now() - stage1ApiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1：API 调用出错:`, e?.message);
        throw e;
      }

      const stage1ResponseText = stage1Response.choices[0]?.message?.content || "";
      const stage1Summary = parseStage1Output(stage1ResponseText);
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1：提取摘要完成`);

      let savedStage1Path: string | undefined;
      let savedStage1PromptPath: string | undefined;

      if (shouldSave) {
        const stage1FileName = `round_${round}_${timestamp}_stage1.md`;
        const stage1FilePath = path.join(outputDir, stage1FileName);
        fs.writeFileSync(stage1FilePath, stage1ResponseText, "utf-8");
        console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1 输出已保存到: ${stage1FilePath}`);

        const stage1PromptFileName = `round_${round}_${timestamp}_stage1_prompt.txt`;
        const stage1PromptFilePath = path.join(outputDir, stage1PromptFileName);
        fs.writeFileSync(stage1PromptFilePath, stage1Prompt, "utf-8");
        console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1 Prompt 已保存到: ${stage1PromptFilePath}`);

        savedStage1Path = `data/extracted_memories_stage1_only/${stage1FileName}`;
        savedStage1PromptPath = `data/extracted_memories_stage1_only/${stage1PromptFileName}`;
      }

      results.push({
        round,
        stage1Summary,
        stage1RawOutput: stage1ResponseText,
        stage1PromptText: stage1Prompt,
        savedStage1Path,
        savedStage1PromptPath
      });

      const roundEndTime = Date.now();
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮完成（总耗时 ${roundEndTime - stage1ApiStartTime}ms）`);
      console.log(`[Extract Memory Stage1 Only] 进度: ${round}/${dialogueSessions.length} (${Math.round(round / dialogueSessions.length * 100)}%)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Extract Memory Stage1 Only] ===== 处理完成 =====`);
    console.log(`[Extract Memory Stage1 Only] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
    console.log(`[Extract Memory Stage1 Only] 处理了 ${results.length} 轮对话`);

    return NextResponse.json({
      ok: true,
      results,
      totalRounds: results.length,
      totalTimeMs: totalTime
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Extract Memory Stage1 Only] ===== 处理出错 =====`);
    console.error(`[Extract Memory Stage1 Only] 错误信息:`, e?.message);
    console.error(`[Extract Memory Stage1 Only] 错误堆栈:`, e?.stack);
    console.error(`[Extract Memory Stage1 Only] 出错前耗时: ${totalTime}ms`);
    return NextResponse.json(
      { 
        ok: false, 
        error: e?.message || "unknown error",
        errorDetails: process.env.NODE_ENV === 'development' ? e?.stack : undefined
      },
      { status: 500 }
    );
  }
}

