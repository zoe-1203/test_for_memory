import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 计算相对时间标签
function getRelativeTimeLabel(memoryDate: Date, today: Date): string {
  const memoryDay = new Date(memoryDate.getFullYear(), memoryDate.getMonth(), memoryDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffDays = Math.floor((todayDay.getTime() - memoryDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';

  const todayDayOfWeek = todayDay.getDay() === 0 ? 7 : todayDay.getDay();
  const thisWeekStart = new Date(todayDay);
  thisWeekStart.setDate(todayDay.getDate() - todayDayOfWeek + 1);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  if (memoryDay >= thisWeekStart) return '这周早一点';
  if (memoryDay >= lastWeekStart && memoryDay <= lastWeekEnd) return '上周';

  const thisMonthStart = new Date(todayDay.getFullYear(), todayDay.getMonth(), 1);
  if (memoryDay >= thisMonthStart) return '这个月早些时候';

  return '更早';
}

// 清理 XML 格式的 facts
function cleanFactsXml(facts: string): string {
  const factsMatch = facts.match(/<facts>([\s\S]*?)<\/facts>/i);
  if (!factsMatch) return facts.trim();

  const factsContent = factsMatch[1];
  const parts: string[] = [];

  const personMatch = factsContent.match(/<personRelatedContent>([\s\S]*?)<\/personRelatedContent>/i);
  if (personMatch && personMatch[1].trim()) {
    parts.push(personMatch[1].trim());
  }

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
function readStage1Memories(format: "markdown" | "xml" = "xml"): Array<{ round: number; content: string; filePath: string }> {
  const dirName = format === "xml"
    ? "extracted_memories_stage1_only_xml"
    : "extracted_memories_stage1_only";
  const stage1Dir = path.join(process.cwd(), "data", dirName);

  if (!fs.existsSync(stage1Dir)) {
    return [];
  }

  const files = fs.readdirSync(stage1Dir)
    .filter(file => file.endsWith('_stage1.md'))
    .sort((a, b) => {
      const roundA = parseInt(a.match(/round_(\d+)_/)?.[1] || '0');
      const roundB = parseInt(b.match(/round_(\d+)_/)?.[1] || '0');
      return roundA - roundB;
    });

  if (files.length === 0) {
    return [];
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'xml') as "markdown" | "xml";

    const memories = readStage1Memories(format);

    if (memories.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `没有找到 Stage 1 记忆文件，请先运行「仅提取 Stage 1 (XML)」`,
        count: 0
      });
    }

    const today = new Date();

    const formattedMemories = memories.map((item, idx) => {
      // 从最新记录开始计算：每4条记忆对应1天
      const reversedIdx = memories.length - 1 - idx; // 反转索引，最新的在前
      const daysAgo = Math.floor(reversedIdx / 4);   // 每4条为1天
      const memoryDate = new Date(today);
      memoryDate.setDate(today.getDate() - daysAgo);

      const timeLabel = getRelativeTimeLabel(memoryDate, today);
      const cleanedFacts = cleanFactsXml(item.content);

      if (!cleanedFacts) return null;
      return `### ${timeLabel}\n${cleanedFacts}`;
    }).filter(Boolean).join('\n\n');

    return NextResponse.json({
      ok: true,
      content: formattedMemories,
      count: memories.length
    });
  } catch (error: any) {
    console.error('[read-stage1-for-copy] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || '读取失败'
    }, { status: 500 });
  }
}
