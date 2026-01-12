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

// 清理 Stage1 facts：去掉小标题，并根据规则过滤内容
function cleanFacts(facts: string): string {
  // 先去掉 "# facts" 标题行（如果存在）
  let cleanedFacts = facts.replace(/^#\s*facts\s*\n/i, '').trim();

  // 按 ## 开头的行分割成段落
  const sections = cleanedFacts.split(/(?=##\s*用户)/);

  const processedSections = sections
    .map(section => {
      const trimmed = section.trim();
      if (!trimmed) return null;

      // 检查是否是"用户自身内容"段落
      if (trimmed.includes('## 用户自身内容')) {
        // 如果包含"未提及"，则跳过整个段落
        if (trimmed.includes('未提及') && trimmed.includes('此部分为空')) {
          return null;
        }
      }

      // 移除 ## 开头的标题行，保留内容
      const lines = trimmed.split('\n');
      const contentLines = lines.filter(line => !line.trim().startsWith('##'));
      const content = contentLines.join('\n').trim();

      return content || null;
    })
    .filter(Boolean);

  return processedSections.join('\n\n').trim();
}

// 清理 XML 格式的 Stage1 facts
function cleanFactsXml(facts: string): string {
  // 提取 <facts> 标签内容
  const factsMatch = facts.match(/<facts>([\s\S]*?)<\/facts>/i);
  if (!factsMatch) {
    return facts.trim(); // 如果没有 facts 标签，返回原文
  }

  const factsContent = factsMatch[1];
  const parts: string[] = [];

  // 提取 personRelatedContent
  const personMatch = factsContent.match(/<personRelatedContent>([\s\S]*?)<\/personRelatedContent>/i);
  if (personMatch && personMatch[1].trim()) {
    parts.push(personMatch[1].trim());
  }

  // 提取 userSelfContent（跳过"未提及"的情况）
  const selfMatch = factsContent.match(/<userSelfContent>([\s\S]*?)<\/userSelfContent>/i);
  if (selfMatch && selfMatch[1].trim()) {
    const selfContent = selfMatch[1].trim();
    if (!selfContent.includes('未提及') || !selfContent.includes('此部分为空')) {
      parts.push(selfContent);
    }
  }

  return parts.join('\n\n').trim();
}

// 读取 Stage 1 记忆文件
function readStage1Memories(
  provided?: Array<{ round?: number; summary: string }>,
  format: "markdown" | "xml" = "markdown"
): Array<{ round: number; content: string; filePath: string }> {
  if (provided && provided.length > 0) {
    return provided.map((item, idx) => ({
      round: item.round ?? idx + 1,
      content: item.summary,
      filePath: ""
    }));
  }

  // 根据 format 选择目录
  const dirName = format === "xml"
    ? "extracted_memories_stage1_only_xml"
    : "extracted_memories_stage1_only";
  const stage1Dir = path.join(process.cwd(), "data", dirName);

  if (!fs.existsSync(stage1Dir)) {
    throw new Error(`Stage 1 记忆文件夹不存在（${dirName}），请先运行「仅提取 Stage 1」`);
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
    throw new Error(`Stage 1 记忆文件夹中没有找到记忆文件（${dirName}）`);
  }

  const memories: Array<{ round: number; content: string; filePath: string }> = [];

  for (const file of files) {
    const filePath = path.join(stage1Dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const roundMatch = file.match(/round_(\d+)_/);
    const round = roundMatch ? parseInt(roundMatch[1]) : 0;

    // 对于 XML 格式，直接返回原始内容（cleanFactsXml 会在后续处理）
    // 对于 markdown 格式，使用 parseStage1Output 提取 facts
    const facts = format === "xml" ? content : parseStage1Output(content);

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
  
  // 添加星期几
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];
  
  return `${year}年${month}月${day}日 ${weekday}`;
}

// 计算旧事实发生的时间（timeInfo 减去一天）
function getOldTimeInfo(timeInfo: string): string {
  // 从 timeInfo 中提取日期信息（格式：YYYY年MM月DD日 星期X）
  const match = timeInfo.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!match) {
    return "（无法解析日期）";
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // Date 对象月份从0开始
  const day = parseInt(match[3]);
  
  const date = new Date(year, month, day);
  date.setDate(date.getDate() - 1); // 减去一天
  
  const oldYear = date.getFullYear();
  const oldMonth = String(date.getMonth() + 1).padStart(2, '0');
  const oldDay = String(date.getDate()).padStart(2, '0');
  
  // 添加星期几
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];
  
  return `${oldYear}年${oldMonth}月${oldDay}日 ${weekday}`;
}

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Batch Merge Memory] ===== 开始处理请求 =====`);
  
  try {
    const body = await req.json();
    const { provider = "openai", stage1Summaries, saveToFile, oldGlobalMemory: initialGlobalMemory, format = "markdown" } = body as {
      provider?: "openai" | "deepseek";
      stage1Summaries?: Array<{ round?: number; summary: string }>;
      saveToFile?: boolean;
      oldGlobalMemory?: string;
      format?: "markdown" | "xml";
    };
    const shouldSave = saveToFile ?? true;
    let globalMemoryCarry = initialGlobalMemory ?? "";

    // 根据 format 选择清理函数
    const cleanFunc = format === "xml" ? cleanFactsXml : cleanFacts;

    console.log(`[Batch Merge Memory] 使用模型提供方: ${provider}, 格式: ${format}`);

    // 1. 读取所有 Stage 1 记忆文件
    console.log(`[Batch Merge Memory] 读取 Stage 1 记忆文件...`);
    const stage1Memories = readStage1Memories(stage1Summaries, format);
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
      outputDir = path.join(process.cwd(), "data", "extracted_memories_batch_merge_xml");
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
        .map((m, idx) => {
          const cleanedFacts = cleanFunc(m.content);
          if (!cleanedFacts) return null;
          return `### 记忆 ${m.round}（第 ${startIdx + idx + 1} 个）\n${cleanedFacts}`;
        })
        .filter(Boolean)
        .join('\n\n');

      // 计算旧事实发生的时间（新事实时间减去一天）
      const oldTimeInfo = getOldTimeInfo(simulatedDate);
      
      // 构建 Stage 2 prompt
      const stage2Prompt = replacePlaceholders(stage2Template, {
        old: oldGlobalMemory || "（无旧记忆）",
        oldTimeInfo: oldTimeInfo,
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

        savedStage2Path = `data/extracted_memories_batch_merge_xml/${stage2FileName}`;
        savedStage2PromptPath = `data/extracted_memories_batch_merge_xml/${stage2PromptFileName}`;
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

