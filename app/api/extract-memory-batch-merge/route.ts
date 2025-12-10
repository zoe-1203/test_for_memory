import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { EXTRACT_MEMORY_STAGE2_PROMPT } from "@/lib/prompts_memory";

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

function loadPromptTemplate(yamlFileName: string): string {
  if (yamlFileName === "extract_memory_stage2.yaml") return EXTRACT_MEMORY_STAGE2_PROMPT.trim();
  throw new Error(`未知的 prompt 文件: ${yamlFileName}`);
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

// 解析 stage2 输出（提取 facts）
function parseStage2Output(text: string): string {
  // 尝试提取 ## facts： 或 ## facts 后面的内容
  const factsMatch = text.match(/##\s*facts[：:]\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (factsMatch) {
    return factsMatch[1].trim();
  }
  // 如果没有找到，返回整个文本
  return text.trim();
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

// 读取 Stage 1 记忆文件
function readStage1Memories(
  provided?: Array<{ round?: number; summary: string }>
): Array<{ round: number; content: string; filePath: string }> {
  if (provided && provided.length > 0) {
    return provided.map((item, idx) => ({
      round: item.round ?? idx + 1,
      content: item.summary,
      filePath: ""
    }));
  }

  const stage1Dir = path.join(process.cwd(), "data", "extracted_memories_stage1_only");
  
  if (!fs.existsSync(stage1Dir)) {
    throw new Error("Stage 1 记忆文件夹不存在，请先运行「仅提取 Stage 1」");
  }

  // 读取所有 .md 文件（排除 prompt 文件）
  const files = fs.readdirSync(stage1Dir)
    .filter(file => file.endsWith('_stage1.md'))
    .sort((a, b) => {
      // 按文件名中的 round 数字排序
      const roundA = parseInt(a.match(/round_(\d+)_/)?.[1] || '0');
      const roundB = parseInt(b.match(/round_(\d+)_/)?.[1] || '0');
      return roundA - roundB;
    });

  if (files.length === 0) {
    throw new Error("Stage 1 记忆文件夹中没有找到记忆文件");
  }

  const memories: Array<{ round: number; content: string; filePath: string }> = [];

  for (const file of files) {
    const filePath = path.join(stage1Dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const roundMatch = file.match(/round_(\d+)_/);
    const round = roundMatch ? parseInt(roundMatch[1]) : 0;
    
    // 解析 Stage 1 输出，提取 facts
    const facts = parseStage1Output(content);
    
    memories.push({
      round,
      content: facts,
      filePath: file
    });
  }

  return memories;
}

// 生成模拟日期（第一个5个是11月1日，第二个5个是11月2日，以此类推）
function getSimulatedDate(batchIndex: number): string {
  const baseDate = new Date(2025, 10, 1); // 2025年11月1日（月份从0开始）
  const daysToAdd = batchIndex;
  const date = new Date(baseDate);
  date.setDate(date.getDate() + daysToAdd);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}年${month}月${day}日`;
}

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Batch Merge Memory] ===== 开始处理请求 =====`);
  
  try {
    const body = await req.json();
    const { provider = "openai", stage1Summaries, saveToFile, oldGlobalMemory: initialGlobalMemory } = body as {
      provider?: "openai" | "deepseek";
      stage1Summaries?: Array<{ round?: number; summary: string }>;
      saveToFile?: boolean;
      oldGlobalMemory?: string;
    };
    const shouldSave = saveToFile ?? true;
    let globalMemoryCarry = initialGlobalMemory ?? "";
    
    console.log(`[Batch Merge Memory] 使用模型提供方: ${provider}`);

    // 1. 读取所有 Stage 1 记忆文件
    console.log(`[Batch Merge Memory] 读取 Stage 1 记忆文件...`);
    const stage1Memories = readStage1Memories(stage1Summaries);
    console.log(`[Batch Merge Memory] 找到 ${stage1Memories.length} 个 Stage 1 记忆`);

    if (stage1Memories.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "没有找到 Stage 1 记忆文件，请先运行「仅提取 Stage 1」" 
      }, { status: 400 });
    }

    // 2. 加载 Stage 2 prompt 模板
    const stage2Template = loadPromptTemplate("extract_memory_stage2.yaml");

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录（可选）
    let outputDir = "";
    if (shouldSave) {
      outputDir = path.join(process.cwd(), "data", "extracted_memories_batch_merge");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    // 5. 按每5个为一组进行批量合并
    const BATCH_SIZE = 5;
    const results: Array<{
      batch: number;
      date: string;
      memoryCount: number;
      globalMemory: string;
      stage2RawOutput: string;
      stage2PromptText?: string;
      savedStage2Path?: string;
      savedStage2PromptPath?: string;
    }> = [];

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    let oldGlobalMemory = globalMemoryCarry; // 上一批的全局记忆

    for (let batchIndex = 0; batchIndex < Math.ceil(stage1Memories.length / BATCH_SIZE); batchIndex++) {
      const batch = batchIndex + 1;
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, stage1Memories.length);
      const batchMemories = stage1Memories.slice(startIdx, endIdx);
      
      const simulatedDate = getSimulatedDate(batchIndex);
      
      console.log(`[Batch Merge Memory] 处理第 ${batch} 批（${simulatedDate}，包含 ${batchMemories.length} 个记忆）`);

      // 合并这一批的 Stage 1 记忆
      const batchFacts = batchMemories
        .map((m, idx) => `### 记忆 ${m.round}（第 ${startIdx + idx + 1} 个）\n${m.content}`)
        .join('\n\n');

      // 构建 Stage 2 prompt
      const stage2Prompt = replacePlaceholders(stage2Template, {
        old: oldGlobalMemory || "（无旧记忆）",
        facts: batchFacts,
        timeInfo: simulatedDate
      });

      console.log(`[Batch Merge Memory] 第 ${batch} 批：开始调用 Stage 2 API...`);
      const stage2ApiStartTime = Date.now();
      
      let stage2Response;
      try {
        stage2Response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: stage2Prompt
            },
            {
              role: "user",
              content: "请根据上述规则合并更新记忆。"
            }
          ]
        });
        console.log(`[Batch Merge Memory] 第 ${batch} 批 Stage 2：API 调用成功（耗时 ${Date.now() - stage2ApiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Batch Merge Memory] 第 ${batch} 批 Stage 2：API 调用出错:`, e?.message);
        throw e;
      }

      const stage2RawOutput = stage2Response.choices[0]?.message?.content || "";
      const globalMemory = parseStage2Output(stage2RawOutput);
      console.log(`[Batch Merge Memory] 第 ${batch} 批 Stage 2：合并完成`);

      let savedStage2Path: string | undefined;
      let savedStage2PromptPath: string | undefined;

      if (shouldSave) {
        const stage2FileName = `batch_${batch}_${timestamp}_stage2.md`;
        const stage2FilePath = path.join(outputDir, stage2FileName);
        fs.writeFileSync(stage2FilePath, stage2RawOutput, "utf-8");
        console.log(`[Batch Merge Memory] 第 ${batch} 批 Stage 2 输出已保存到: ${stage2FilePath}`);

        const stage2PromptFileName = `batch_${batch}_${timestamp}_stage2_prompt.txt`;
        const stage2PromptFilePath = path.join(outputDir, stage2PromptFileName);
        fs.writeFileSync(stage2PromptFilePath, stage2Prompt, "utf-8");
        console.log(`[Batch Merge Memory] 第 ${batch} 批 Stage 2 Prompt 已保存到: ${stage2PromptFilePath}`);

        savedStage2Path = `data/extracted_memories_batch_merge/${stage2FileName}`;
        savedStage2PromptPath = `data/extracted_memories_batch_merge/${stage2PromptFileName}`;
      }

      results.push({
        batch,
        date: simulatedDate,
        memoryCount: batchMemories.length,
        globalMemory,
        stage2RawOutput,
        stage2PromptText: stage2Prompt,
        savedStage2Path,
        savedStage2PromptPath
      });

      // 更新旧全局记忆，用于下一批
      oldGlobalMemory = globalMemory;

      const batchEndTime = Date.now();
      console.log(`[Batch Merge Memory] 第 ${batch} 批完成（总耗时 ${batchEndTime - stage2ApiStartTime}ms）`);
      console.log(`[Batch Merge Memory] 进度: ${batch}/${Math.ceil(stage1Memories.length / BATCH_SIZE)}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Batch Merge Memory] ===== 处理完成 =====`);
    console.log(`[Batch Merge Memory] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
    console.log(`[Batch Merge Memory] 处理了 ${results.length} 批记忆`);

    return NextResponse.json({
      ok: true,
      results,
      totalBatches: results.length,
      totalTimeMs: totalTime,
      lastGlobalMemory: results[results.length - 1]?.globalMemory || oldGlobalMemory
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Batch Merge Memory] ===== 处理出错 =====`);
    console.error(`[Batch Merge Memory] 错误信息:`, e?.message);
    console.error(`[Batch Merge Memory] 错误堆栈:`, e?.stack);
    console.error(`[Batch Merge Memory] 出错前耗时: ${totalTime}ms`);
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

