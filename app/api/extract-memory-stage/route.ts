import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { EXTRACT_MEMORY_STAGE1_PROMPT, EXTRACT_MEMORY_STAGE2_PROMPT } from "@/lib/prompts_memory";

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

// 格式化日期为 “YYYY年MM月DD日 星期X”
function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  
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
  const oldMonth = String(date.getMonth() + 1).padStart(2, "0");
  const oldDay = String(date.getDate()).padStart(2, "0");
  
  // 添加星期几
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];
  
  return `${oldYear}年${oldMonth}月${oldDay}日 ${weekday}`;
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

// 解析对话文件，按 === 分割
function parseDialogueFile(): string[] {
  const dialoguePath = path.join(
    process.cwd(),
    "data",
    "raw_dialogue",
    "0B862A48-0A75-4D60-8427-952E9B15B2EC_extracted_timeOrder.txt"
  );
  
  const content = fs.readFileSync(dialoguePath, "utf-8");
  
  // 按 === 分割，过滤空字符串
  const sessions = content
    .split(/^===\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => truncateFirstTarotReply(s)); // 应用截断函数
  
  return sessions;
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

// 设置路由配置
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Extract Memory Stage] ===== 开始处理请求 =====`);
  
  try {
    const body = await req.json();
    const { provider = "openai" } = body as { provider?: "openai" | "deepseek" };
    
    console.log(`[Extract Memory Stage] 使用模型提供方: ${provider}`);

    // 1. 加载 prompt 模板
    const stage1Template = loadPromptTemplate("extract_memory_stage1.yaml");
    const stage2Template = loadPromptTemplate("extract_memory_stage2.yaml");
    
    // 2. 解析对话文件
    const dialogueSessions = parseDialogueFile();
    
    if (dialogueSessions.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "对话文件为空或格式不正确" 
      }, { status: 400 });
    }

    console.log(`[Extract Memory Stage] 找到 ${dialogueSessions.length} 个对话轮次`);

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录
    const outputDir = path.join(process.cwd(), "data", "extracted_memories_batch_merge_xml");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 5. 循环处理每一轮对话
    const results: Array<{
      round: number;
      stage1Summary: string; // stage1 的摘要
      stage2GlobalMemory: string; // stage2 的全局记忆
      stage1RawOutput: string; // stage1 的原始输出
      stage2RawOutput: string; // stage2 的原始输出
      stage1PromptText?: string; // stage1 的 prompt
      stage2PromptText?: string; // stage2 的 prompt
      savedStage1Path?: string; // stage1 保存的文件路径
      savedStage2Path?: string; // stage2 保存的文件路径
      savedStage1PromptPath?: string; // stage1 prompt 保存的文件路径
      savedStage2PromptPath?: string; // stage2 prompt 保存的文件路径
    }> = [];

    let oldGlobalMemory = ""; // 上一轮的 stage2 结果
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const todayStr = formatDateYMD(new Date());

    for (let i = 0; i < dialogueSessions.length; i++) {
      const thisSessionRaw = dialogueSessions[i];
      const round = i + 1;

      console.log(`[Extract Memory Stage] 处理第 ${round} 轮对话`);

      // ===== Stage 1: 提取本轮对话的摘要 =====
      console.log(`[Extract Memory Stage] 第 ${round} 轮：开始 Stage 1...`);
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
        console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 1：API 调用成功（耗时 ${Date.now() - stage1ApiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Extract Memory Stage] 第 ${round} 轮 Stage 1：API 调用出错:`, e?.message);
        throw e;
      }

      const stage1ResponseText = stage1Response.choices[0]?.message?.content || "";
      const stage1Summary = parseStage1Output(stage1ResponseText);
      const stage1CleanedFacts = cleanFacts(stage1Summary);
      console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 1：提取摘要完成`);

      // ===== Stage 2: 合并到全局记忆（从第2轮开始） =====
      let stage2GlobalMemory = "";
      let stage2RawOutput = "";
      let stage2Prompt = "";

      if (round === 1) {
        // 第1轮：stage2 结果就是 stage1 的结果（已清理）
        stage2GlobalMemory = stage1CleanedFacts;
        stage2RawOutput = stage1ResponseText;
        console.log(`[Extract Memory Stage] 第 ${round} 轮：第1轮，Stage 2 使用 Stage 1 的结果`);
      } else {
        // 第2轮开始：使用 stage2 合并
        console.log(`[Extract Memory Stage] 第 ${round} 轮：开始 Stage 2...`);

        // 计算旧事实发生的时间（新事实时间减去一天）
        const oldTimeInfo = getOldTimeInfo(todayStr);

        stage2Prompt = replacePlaceholders(stage2Template, {
          old: oldGlobalMemory,
          oldTimeInfo: oldTimeInfo,
          facts: stage1CleanedFacts,
          timeInfo: todayStr
        });

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
          console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 2：API 调用成功（耗时 ${Date.now() - stage2ApiStartTime}ms）`);
        } catch (e: any) {
          console.error(`[Extract Memory Stage] 第 ${round} 轮 Stage 2：API 调用出错:`, e?.message);
          throw e;
        }

        stage2RawOutput = stage2Response.choices[0]?.message?.content || "";
        stage2GlobalMemory = parseStage2Output(stage2RawOutput);
        console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 2：合并完成`);
      }

      // 保存文件
      const stage1FileName = `round_${round}_${timestamp}_stage1.md`;
      const stage1FilePath = path.join(outputDir, stage1FileName);
      fs.writeFileSync(stage1FilePath, stage1ResponseText, "utf-8");
      console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 1 输出已保存到: ${stage1FilePath}`);

      const stage1PromptFileName = `round_${round}_${timestamp}_stage1_prompt.txt`;
      const stage1PromptFilePath = path.join(outputDir, stage1PromptFileName);
      fs.writeFileSync(stage1PromptFilePath, stage1Prompt, "utf-8");
      console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 1 Prompt 已保存到: ${stage1PromptFilePath}`);

      const stage2FileName = `round_${round}_${timestamp}_stage2.md`;
      const stage2FilePath = path.join(outputDir, stage2FileName);
      fs.writeFileSync(stage2FilePath, stage2RawOutput, "utf-8");
      console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 2 输出已保存到: ${stage2FilePath}`);

      if (round > 1) {
        const stage2PromptFileName = `round_${round}_${timestamp}_stage2_prompt.txt`;
        const stage2PromptFilePath = path.join(outputDir, stage2PromptFileName);
        fs.writeFileSync(stage2PromptFilePath, stage2Prompt, "utf-8");
        console.log(`[Extract Memory Stage] 第 ${round} 轮 Stage 2 Prompt 已保存到: ${stage2PromptFilePath}`);
      }

      // 保存结果
      const relativeStage1Path = `data/extracted_memories_batch_merge_xml/${stage1FileName}`;
      const relativeStage2Path = `data/extracted_memories_batch_merge_xml/${stage2FileName}`;
      const relativeStage1PromptPath = `data/extracted_memories_batch_merge_xml/${stage1PromptFileName}`;
      const relativeStage2PromptPath = round > 1 ? `data/extracted_memories_batch_merge_xml/round_${round}_${timestamp}_stage2_prompt.txt` : undefined;

      results.push({
        round,
        stage1Summary,
        stage2GlobalMemory,
        stage1RawOutput: stage1ResponseText,
        stage2RawOutput,
        stage1PromptText: stage1Prompt,
        stage2PromptText: round > 1 ? stage2Prompt : undefined,
        savedStage1Path: relativeStage1Path,
        savedStage2Path: relativeStage2Path,
        savedStage1PromptPath: relativeStage1PromptPath,
        savedStage2PromptPath: relativeStage2PromptPath
      });

      // 更新旧全局记忆，用于下一轮
      oldGlobalMemory = stage2GlobalMemory;

      const roundEndTime = Date.now();
      console.log(`[Extract Memory Stage] 第 ${round} 轮完成（总耗时 ${roundEndTime - stage1ApiStartTime}ms）`);
      console.log(`[Extract Memory Stage] 进度: ${round}/${dialogueSessions.length} (${Math.round(round / dialogueSessions.length * 100)}%)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Extract Memory Stage] ===== 处理完成 =====`);
    console.log(`[Extract Memory Stage] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
    console.log(`[Extract Memory Stage] 处理了 ${results.length} 轮对话`);

    return NextResponse.json({
      ok: true,
      results,
      totalRounds: results.length,
      totalTimeMs: totalTime
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Extract Memory Stage] ===== 处理出错 =====`);
    console.error(`[Extract Memory Stage] 错误信息:`, e?.message);
    console.error(`[Extract Memory Stage] 错误堆栈:`, e?.stack);
    console.error(`[Extract Memory Stage] 出错前耗时: ${totalTime}ms`);
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


