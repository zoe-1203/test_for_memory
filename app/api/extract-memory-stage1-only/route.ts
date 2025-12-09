import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

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

// 读取 YAML prompt 文件
function loadPromptTemplate(yamlFileName: string): string {
  const yamlPath = path.join(process.cwd(), "lib", yamlFileName);
  const content = fs.readFileSync(yamlPath, "utf-8");
  
  // 提取 system content
  const systemMatch = content.match(/system:\s*content:\s*\|\s*\n((?:[\s\S]*?)(?=\n\w+:|$))/);
  if (!systemMatch) {
    throw new Error(`无法解析 YAML 文件 ${yamlFileName} 中的 system content`);
  }
  
  return systemMatch[1].trim();
}

// 替换 prompt 中的占位符
function replacePlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value || "");
  }
  return result;
}

// 解析对话文件，按 === 分割
function parseDialogueFile(contentOverride?: string): string[] {
  const content = contentOverride ?? fs.readFileSync(
    path.join(
      process.cwd(),
      "data",
      "raw_dialogue",
      "0B862A48-0A75-4D60-8427-952E9B15B2EC_extracted_timeOrder.txt"
    ),
    "utf-8"
  );

  return content
    .split(/^===\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);
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
    const { provider = "openai", fileContent, roundLimit } = body as {
      provider?: "openai" | "deepseek";
      fileContent?: string;
      roundLimit?: number;
    };
    
    console.log(`[Extract Memory Stage1 Only] 使用模型提供方: ${provider}`);

    // 1. 加载 prompt 模板（只使用 stage1）
    const stage1Template = loadPromptTemplate("extract_memory_stage1.yaml");
    
    // 2. 解析对话文件
    const dialogueSessions = parseDialogueFile(fileContent);
    
    if (dialogueSessions.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "对话文件为空或格式不正确" 
      }, { status: 400 });
    }

    const limitedSessions = typeof roundLimit === "number" && roundLimit > 0
      ? dialogueSessions.slice(0, roundLimit)
      : dialogueSessions;

    console.log(`[Extract Memory Stage1 Only] 找到 ${limitedSessions.length} 个对话轮次（原始 ${dialogueSessions.length}）`);

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录
    const outputDir = path.join(process.cwd(), "data", "extracted_memories_stage1_only");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
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
      const thisSessionRaw = limitedSessions[i];
      const round = i + 1;

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

      // 保存文件
      const stage1FileName = `round_${round}_${timestamp}_stage1.md`;
      const stage1FilePath = path.join(outputDir, stage1FileName);
      fs.writeFileSync(stage1FilePath, stage1ResponseText, "utf-8");
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1 输出已保存到: ${stage1FilePath}`);

      const stage1PromptFileName = `round_${round}_${timestamp}_stage1_prompt.txt`;
      const stage1PromptFilePath = path.join(outputDir, stage1PromptFileName);
      fs.writeFileSync(stage1PromptFilePath, stage1Prompt, "utf-8");
      console.log(`[Extract Memory Stage1 Only] 第 ${round} 轮 Stage 1 Prompt 已保存到: ${stage1PromptFilePath}`);

      // 保存结果
      const relativeStage1Path = `data/extracted_memories_stage1_only/${stage1FileName}`;
      const relativeStage1PromptPath = `data/extracted_memories_stage1_only/${stage1PromptFileName}`;

      results.push({
        round,
        stage1Summary,
        stage1RawOutput: stage1ResponseText,
        stage1PromptText: stage1Prompt,
        savedStage1Path: relativeStage1Path,
        savedStage1PromptPath: relativeStage1PromptPath
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

