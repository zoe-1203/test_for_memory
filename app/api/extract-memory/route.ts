import { NextResponse } from "next/server";
import OpenAI from "openai";
import { EXTRACT_MEMORY_PROMPT } from "@/lib/prompts_memory";

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
function loadPromptTemplate(): string {
  return EXTRACT_MEMORY_PROMPT.trim();
}

// 替换 prompt 中的占位符
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

// 解析对话文件，按 === 分割
function parseDialogueFile(): string[] {
  const dialoguePath = path.join(
    process.cwd(),
    "data",
    "raw_dialogue",
    // "0B862A48-0A75-4D60-8427-952E9B15B2EC_extracted.txt"
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

// 解析模型返回的 JSON
function parseJSONResponse(text: string): {
  facts: string;
  tarot_overview: string;
  analysis: string;
  dialogue_area: string;
} {
  // 尝试提取 JSON（可能被 markdown 代码块包裹）
  let jsonText = text.trim();
  
  // 移除可能的 markdown 代码块标记
  jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  
  // 尝试找到 JSON 对象
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonText);
    return {
      facts: parsed.facts || "",
      tarot_overview: parsed.tarot_overview || "",
      analysis: parsed.analysis || "",
      dialogue_area: parsed.dialogue_area || ""
    };
  } catch (e) {
    console.error("JSON 解析失败:", e);
    console.error("原始文本:", text);
    throw new Error("模型返回的 JSON 格式不正确");
  }
}

// 设置路由配置，增加超时时间
export const maxDuration = 300; // 5 分钟（Vercel 最大支持 300 秒）
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Extract Memory] ===== 开始处理请求 =====`);
  
  try {
    const body = await req.json();
    const { provider = "openai" } = body as { provider?: "openai" | "deepseek" };
    
    console.log(`[Extract Memory] 使用模型提供方: ${provider}`);

    // 1. 加载 prompt 模板
    const promptTemplate = loadPromptTemplate();
    
    // 2. 解析对话文件
    const dialogueSessions = parseDialogueFile();
    
    if (dialogueSessions.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "对话文件为空或格式不正确" 
      }, { status: 400 });
    }

    console.log(`[Extract Memory] 找到 ${dialogueSessions.length} 个对话轮次`);

    // 3. 初始化客户端
    const client = getClient(provider);
    const model = getModel(provider);

    // 4. 准备保存目录
    const outputDir = path.join(process.cwd(), "data", "extracted_memories");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 5. 循环处理每一轮对话
    const results: Array<{
      round: number;
      facts: string;
      tarot_overview: string;
      analysis: string;
      dialogue_area: string;
      rawJson: string; // 原始 JSON 字符串
      savedFilePath?: string; // 保存的 JSON 文件路径
      savedPromptPath?: string; // 保存的 Prompt 文件路径
      promptText?: string; // 发送给模型的 Prompt 原文
    }> = [];

    let oldFacts = "";
    let oldTarotOverview = "";

    // 生成时间戳用于文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    for (let i = 0; i < dialogueSessions.length; i++) {
      const thisSessionRaw = dialogueSessions[i];
      const round = i + 1;

      console.log(`[Extract Memory] 处理第 ${round} 轮对话`);

      // 替换占位符
      const prompt = replacePlaceholders(
        promptTemplate,
        oldFacts,
        oldTarotOverview,
        thisSessionRaw
      );

      // 调用模型
      console.log(`[Extract Memory] 第 ${round} 轮：开始调用模型 API...`);
      const apiStartTime = Date.now();
      
      // 注意：deepseek 可能不支持 response_format，所以先尝试，失败则重试
      let response;
      try {
        response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: prompt
            },
            {
              role: "user",
              content: "请根据上述规则提取并更新记忆信息，输出 JSON 格式。"
            }
          ],
          response_format: { type: "json_object" }
        } as any);
        console.log(`[Extract Memory] 第 ${round} 轮：模型 API 调用成功（耗时 ${Date.now() - apiStartTime}ms）`);
      } catch (e: any) {
        console.error(`[Extract Memory] 第 ${round} 轮：API 调用出错:`, e?.message);
        // 如果不支持 response_format，则不带该参数重试
        if (e?.message?.includes("response_format") || provider === "deepseek") {
          console.log(`[Extract Memory] 第 ${round} 轮：模型不支持 response_format，使用普通模式重试`);
          try {
            response = await client.chat.completions.create({
              model,
              temperature: 0.3,
              messages: [
                {
                  role: "system",
                  content: prompt
                },
                {
                  role: "user",
                  content: "请根据上述规则提取并更新记忆信息，输出 JSON 格式。请确保输出是有效的 JSON 对象，不要包含任何其他文本。"
                }
              ]
            });
            console.log(`[Extract Memory] 第 ${round} 轮：重试成功（耗时 ${Date.now() - apiStartTime}ms）`);
          } catch (retryError: any) {
            console.error(`[Extract Memory] 第 ${round} 轮：重试也失败:`, retryError?.message);
            throw retryError;
          }
        } else {
          throw e;
        }
      }

      const responseText = response.choices[0]?.message?.content || "";
      console.log(`[Extract Memory] 第 ${round} 轮：收到模型响应，长度 ${responseText.length} 字符`);
      
      // 解析 JSON
      console.log(`[Extract Memory] 第 ${round} 轮：开始解析 JSON...`);
      const parsed = parseJSONResponse(responseText);
      console.log(`[Extract Memory] 第 ${round} 轮：JSON 解析成功`);

      // 构建完整的 JSON 对象（按照 YAML 中定义的格式）
      const fullJsonObject = {
        analysis: parsed.analysis,
        facts: parsed.facts,
        tarot_overview: parsed.tarot_overview,
        dialogue_area: parsed.dialogue_area
      };

      // 格式化为 JSON 字符串（美化格式）
      const jsonString = JSON.stringify(fullJsonObject, null, 2);

      // 保存 JSON 输出到文件
      const jsonFileName = `round_${round}_${timestamp}.json`;
      const jsonFilePath = path.join(outputDir, jsonFileName);
      fs.writeFileSync(jsonFilePath, jsonString, "utf-8");
      console.log(`[Extract Memory] 第 ${round} 轮 JSON 已保存到: ${jsonFilePath}`);

      // 保存 Prompt 原文到文件
      const promptFileName = `round_${round}_${timestamp}_prompt.txt`;
      const promptFilePath = path.join(outputDir, promptFileName);
      fs.writeFileSync(promptFilePath, prompt, "utf-8");
      console.log(`[Extract Memory] 第 ${round} 轮 Prompt 已保存到: ${promptFilePath}`);

      // 保存结果（使用相对路径，方便前端显示）
      const relativeJsonPath = `data/extracted_memories/${jsonFileName}`;
      const relativePromptPath = `data/extracted_memories/${promptFileName}`;
      results.push({
        round,
        ...parsed,
        rawJson: jsonString,
        savedFilePath: relativeJsonPath,
        savedPromptPath: relativePromptPath, // 保存的 Prompt 文件路径
        promptText: prompt // 保存发送的 Prompt 原文
      });

      // 更新旧记忆，用于下一轮
      oldFacts = parsed.facts;
      oldTarotOverview = parsed.tarot_overview;

      const roundEndTime = Date.now();
      console.log(`[Extract Memory] 第 ${round} 轮完成（总耗时 ${roundEndTime - apiStartTime}ms）`);
      console.log(`[Extract Memory] 进度: ${round}/${dialogueSessions.length} (${Math.round(round / dialogueSessions.length * 100)}%)`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Extract Memory] ===== 处理完成 =====`);
    console.log(`[Extract Memory] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);
    console.log(`[Extract Memory] 处理了 ${results.length} 轮对话`);

    return NextResponse.json({
      ok: true,
      results,
      totalRounds: results.length,
      totalTimeMs: totalTime
    });

  } catch (e: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[Extract Memory] ===== 处理出错 =====`);
    console.error(`[Extract Memory] 错误信息:`, e?.message);
    console.error(`[Extract Memory] 错误堆栈:`, e?.stack);
    console.error(`[Extract Memory] 出错前耗时: ${totalTime}ms`);
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

