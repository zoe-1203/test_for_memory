import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {
  COMPRESS_MONTHLY_MEMORIES_PROMPT,
  COMPRESS_CURRENT_MONTH_MEMORIES_PROMPT,
  replacePlaceholders,
  cleanFactsXml,
  getSimulatedDate,
  getMonthString
} from "@/lib/prompts_current";

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

// 读取 Stage 1 XML 记忆文件
function readStage1XmlMemories(): Array<{ round: number; content: string; filePath: string }> {
  const stage1Dir = path.join(process.cwd(), "data", "extracted_memories_stage1_only_xml");

  if (!fs.existsSync(stage1Dir)) {
    throw new Error(`Stage 1 XML 记忆文件夹不存在，请先运行「仅提取 Stage 1 (XML)」`);
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
    throw new Error(`Stage 1 XML 记忆文件夹中没有找到记忆文件`);
  }

  const memories: Array<{ round: number; content: string; filePath: string }> = [];

  for (const file of files) {
    const filePath = path.join(stage1Dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const roundMatch = file.match(/round_(\d+)_/);
    const round = roundMatch ? parseInt(roundMatch[1]) : 0;

    memories.push({
      round,
      content,
      filePath: file
    });
  }

  return memories;
}

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Compress Monthly Memories] ===== 开始处理请求 =====`);

  try {
    const body = await req.json();
    const { provider = "openai", limit = 90, mode = "last-month" } = body as {
      provider?: "openai" | "deepseek";
      limit?: number;
      mode?: "last-month" | "this-month";
    };

    console.log(`[Compress Monthly Memories] 使用模型提供方: ${provider}, 限制: ${limit} 条, 模式: ${mode}`);

    // 1. 读取所有 Stage 1 XML 记忆文件
    console.log(`[Compress Monthly Memories] 读取 Stage 1 XML 记忆文件...`);
    const stage1Memories = readStage1XmlMemories();
    console.log(`[Compress Monthly Memories] 找到 ${stage1Memories.length} 个 Stage 1 记忆`);

    if (stage1Memories.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "没有找到 Stage 1 XML 记忆文件，请先运行「仅提取 Stage 1 (XML)」"
      }, { status: 400 });
    }

    // 2. 根据模式确定基准日期
    const now = new Date();
    let baseDate: Date;

    if (mode === "this-month") {
      // 本月：从当前月份的1号开始
      baseDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // 上个月：从上个月的1号开始
      baseDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const monthStr = getMonthString(baseDate);
    console.log(`[Compress Monthly Memories] 模式: ${mode}, 基准日期: ${baseDate.toISOString()}, 月份: ${monthStr}`);

    // 3. 限制处理数量（默认90条，约30天 * 3条/天）
    const memoriesToProcess = stage1Memories.slice(0, Math.min(limit, stage1Memories.length));
    console.log(`[Compress Monthly Memories] 将处理 ${memoriesToProcess.length} 条记忆`);

    // 4. 拼接事件内容
    const events = memoriesToProcess
      .map((memory, index) => {
        const cleanedFacts = cleanFactsXml(memory.content);
        if (!cleanedFacts) return null;

        const dateStr = getSimulatedDate(index, baseDate);
        return `${dateStr}，${cleanedFacts}`;
      })
      .filter(Boolean)
      .join('\n');  // 移除 --- 分隔符，仅使用换行

    if (!events) {
      return NextResponse.json({
        ok: false,
        error: "没有有效的记忆内容可以压缩"
      }, { status: 400 });
    }

    console.log(`[Compress Monthly Memories] 事件内容已拼接，长度: ${events.length} 字符`);

    // 5. 根据模式选择提示模板并构建 Prompt
    const promptTemplate = mode === "this-month"
      ? COMPRESS_CURRENT_MONTH_MEMORIES_PROMPT
      : COMPRESS_MONTHLY_MEMORIES_PROMPT;

    const monthPlaceholderKey = mode === "this-month" ? "eventsThisMonth" : "eventsMonth";
    const prompt = replacePlaceholders(promptTemplate, {
      events,
      [monthPlaceholderKey]: monthStr
    });

    // 5. 调用 AI API 进行压缩
    console.log(`[Compress Monthly Memories] 开始调用 AI API 进行压缩...`);
    const client = getClient(provider);
    const model = getModel(provider);

    const apiStartTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: "请根据上述规则整理输出。"
        }
      ]
    });
    console.log(`[Compress Monthly Memories] API 调用成功（耗时 ${Date.now() - apiStartTime}ms）`);

    const compressedResult = response.choices[0]?.message?.content || "";

    // 6. 保存结果到文件
    const outputDir = path.join(process.cwd(), "data", "monthly_compressed_memories");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const monthForFilename = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
    const modePrefix = mode === "this-month" ? "current" : "last";

    const resultFileName = `${modePrefix}_month_${monthForFilename}_${timestamp}.md`;
    const resultFilePath = path.join(outputDir, resultFileName);
    fs.writeFileSync(resultFilePath, compressedResult, "utf-8");
    console.log(`[Compress Monthly Memories] 压缩结果已保存到: ${resultFilePath}`);

    const promptFileName = `${modePrefix}_month_${monthForFilename}_${timestamp}_prompt.txt`;
    const promptFilePath = path.join(outputDir, promptFileName);
    fs.writeFileSync(promptFilePath, prompt, "utf-8");
    console.log(`[Compress Monthly Memories] Prompt 已保存到: ${promptFilePath}`);

    const totalTime = Date.now() - startTime;
    console.log(`[Compress Monthly Memories] ===== 处理完成 =====`);
    console.log(`[Compress Monthly Memories] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);

    return NextResponse.json({
      ok: true,
      mode,
      monthStr,
      compressedResult,
      originalEventsCount: memoriesToProcess.length,
      savedResultPath: `data/monthly_compressed_memories/${resultFileName}`,
      savedPromptPath: `data/monthly_compressed_memories/${promptFileName}`,
      promptText: prompt,
      totalTimeMs: totalTime
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Compress Monthly Memories] ===== 处理出错 =====`);
    console.error(`[Compress Monthly Memories] 错误信息:`, e?.message);
    console.error(`[Compress Monthly Memories] 错误堆栈:`, e?.stack);
    console.error(`[Compress Monthly Memories] 出错前耗时: ${totalTime}ms`);
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
