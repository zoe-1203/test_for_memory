'use client';
import { useState } from 'react';
import { tarotCardMeanings } from '@/data/tarot_card_meanings_cleanWord';

type Card = {
  id: string;
  name: string;
  cnName: string;
  reversed: boolean;
};

type MonthResult = {
  month: number;
  keyword: string;
  content: string;
  card: {
    id: string;
    name: string;
    reversed: boolean;
  };
  success: boolean;
};

type AreaId = 'love' | 'career' | 'wealth' | 'health' | 'relationship' | 'innerGrowth';

type AreaCard = Card & {
  areaId: AreaId;
  areaName: string;
};

type AreaResult = {
  areaId: AreaId;
  areaName: string;
  card: {
    id: string;
    name: string;
    cnName: string;
    reversed: boolean;
  };
  hookSentece: string;
  content: string;
  summaryHighlight: string;
  success: boolean;
};

const GOOD_LUCK_ITEMS_META: Record<
  string,
  {
    tags: string;
    blessing: string;
  }
> = {
  白水晶: {
    tags: '#纯粹 #清理思绪 #归零',
    blessing: '让它的通透，滤去你内心所有的纷乱思绪。'
  },
  粉水晶: {
    tags: '#爱自己 #柔软 #悦纳',
    blessing: '触碰它的瞬间，请记得时刻“温柔待己”。'
  },
  黑曜石: {
    tags: '#守护 #界限感 #屏蔽噪音',
    blessing: '它是沉默而坚固的盾，替你阻挡外界的喧嚣。'
  },
  黄水晶: {
    tags: '#自信 #捕捉阳光 #明亮',
    blessing: '像捕捉了一束凝固的阳光，时刻照亮你的自信。'
  },
  香薰蜡烛: {
    tags: '#微光 #愿望 #温暖时刻',
    blessing: '摇曳的微光，不仅照亮长夜，更温热你心中的愿景。'
  },
  扩香石: {
    tags: '#呼吸 #无声拥抱 #松弛感',
    blessing: '让看不见的香气，给你一个无声却安稳的拥抱。'
  },
  鼠尾草: {
    tags: '#重启 #烟雾 #轻盈',
    blessing: '当烟雾缭绕升起，沉重的情绪便随之飘散归零。'
  },
  干花香囊: {
    tags: '#自然 #随身花园 #安宁',
    blessing: '仿佛把春日花园的安宁，折叠起来随身携带。'
  },
  捕梦网: {
    tags: '#结界 #好梦 #温柔',
    blessing: '替你网住白日的纷扰，只许温柔的月光入梦。'
  },
  多肉植物: {
    tags: '#扎根 #慢节奏 #陪伴',
    blessing: '看着它慢吞吞地生长，治愈你那一刻慌张的节奏。'
  },
  幸运御守: {
    tags: '#信念 #宇宙回信 #不孤单',
    blessing: '这是宇宙寄给你的信，轻声告诉你：别怕，我在。'
  }
};

// 抽取12张牌（保证不重复）
function drawTwelveCards(): Card[] {
  const indices = new Set<number>();
  while (indices.size < 12 && indices.size < tarotCardMeanings.length) {
    indices.add(Math.floor(Math.random() * tarotCardMeanings.length));
  }

  const cards = Array.from(indices).map((idx) => {
    const reversed = Math.random() < 0.5;
    const cardData = tarotCardMeanings[idx];

    const match = cardData.cnName.match(/^(\d+)\s+(.+)$/);
    const id = match ? match[1] : String(idx);
    const name = match ? match[2] : cardData.cnName;

    return {
      id,
      name,
      cnName: cardData.cnName,
      reversed
    };
  });

  return cards;
}

export default function AnnualFortunePage() {
  const [provider, setProvider] = useState<'openai' | 'deepseek'>('openai');
  const [nickName, setNickName] = useState('');
  const [careerStatus, setCareerStatus] = useState<'middle_high_school' | 'college_above' | 'worker' | 'freelance' | ''>('');
  const [gender, setGender] = useState<'female' | 'male' | 'other' | ''>('');
  const [loveStatus, setLoveStatus] = useState<
    'single_notLooking' | 'single_looking' | 'in_relationship' | 'married_or_stable' | ''
  >('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MonthResult[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [timeStats, setTimeStats] = useState<any>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryElapsedTime, setSummaryElapsedTime] = useState<number | null>(null);
  const [summaryTimeStats, setSummaryTimeStats] = useState<any>(null);
  const [fullFlowLoading, setFullFlowLoading] = useState(false);
  const [areaCards, setAreaCards] = useState<AreaCard[]>([]);
  const [areaResults, setAreaResults] = useState<AreaResult[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaElapsedTime, setAreaElapsedTime] = useState<number | null>(null);
  const [areaTimeStats, setAreaTimeStats] = useState<any>(null);
  const [radarResult, setRadarResult] = useState<{
    analysis: string;
    love: number;
    career: number;
    wealth: number;
    health: number;
    social: number;
    innerGrowth: number;
    startingOverview?: string;
  } | null>(null);
  const [radarElapsedTime, setRadarElapsedTime] = useState<number | null>(null);
  const [radarTimeStats, setRadarTimeStats] = useState<any>(null);
  const [closingResult, setClosingResult] = useState<{
    anchorSentence: string;
    closingParagraph: string;
  } | null>(null);
  const [closingElapsedTime, setClosingElapsedTime] = useState<number | null>(null);
  const [closingTimeStats, setClosingTimeStats] = useState<any>(null);
  const [radarClosingTotalTime, setRadarClosingTotalTime] = useState<number | null>(null);
  const [radarClosingLoading, setRadarClosingLoading] = useState(false);
  const [goodLuckItemsResult, setGoodLuckItemsResult] = useState<{
    analysis: string;
    goodLuckItem: string;
  } | null>(null);
  const [goodLuckItemsElapsedTime, setGoodLuckItemsElapsedTime] = useState<number | null>(null);
  const [goodLuckItemsTimeStats, setGoodLuckItemsTimeStats] = useState<any>(null);
  const [areaOverviewResult, setAreaOverviewResult] = useState<{
    startingOverview: string;
  } | null>(null);
  const [areaOverviewElapsedTime, setAreaOverviewElapsedTime] = useState<number | null>(null);
  const [areaOverviewTimeStats, setAreaOverviewTimeStats] = useState<any>(null);

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const handleDrawCards = () => {
    const drawnCards = drawTwelveCards();
    setCards(drawnCards);
    setResults([]);
    setElapsedTime(null);
    setTimeStats(null);
    setExpandedMonths(new Set());
    setSummaryResult(null);
    setSummaryElapsedTime(null);
    setAreaCards([]);
    setAreaResults([]);
    setAreaElapsedTime(null);
    setAreaTimeStats(null);
    setRadarResult(null);
    setRadarElapsedTime(null);
    setRadarTimeStats(null);
    setClosingResult(null);
    setClosingElapsedTime(null);
    setClosingTimeStats(null);
    setRadarClosingTotalTime(null);
    setRadarClosingLoading(false);
    setGoodLuckItemsResult(null);
    setGoodLuckItemsElapsedTime(null);
    setGoodLuckItemsTimeStats(null);
    setAreaOverviewResult(null);
    setAreaOverviewElapsedTime(null);
    setAreaOverviewTimeStats(null);
  };

  const toggleMonth = (month: number) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  const handleStartFortune = async () => {
    if (cards.length !== 12) {
      alert('请先抽取12张牌');
      return;
    }

    setLoading(true);
    setResults([]);
    setElapsedTime(null);
    const startTime = Date.now();

    try {
      const careerStatusLabelMap: Record<string, string> = {
        middle_high_school: '初高中生',
        college_above: '大学及以上',
        worker: '职场人',
        freelance: '自由状态'
      };
      const genderLabelMap: Record<string, string> = {
        female: '女',
        male: '男',
        other: '其他 / 不方便说'
      };
      const loveStatusLabelMap: Record<string, string> = {
        single_notLooking: '单身 - 暂时不想谈',
        single_looking: '单身 - 想遇见合适的人',
        in_relationship: '恋爱中',
        married_or_stable: '已婚 / 稳定关系'
      };

      const careerStatusLabel = careerStatus ? (careerStatusLabelMap[careerStatus] || careerStatus) : '';
      const genderLabel = gender ? (genderLabelMap[gender] || gender) : '';
      const loveStatusLabel = loveStatus ? (loveStatusLabelMap[loveStatus] || loveStatus) : '';

      // 准备卡牌数据（包含 cardInfo）
      const cardsWithInfo = cards.map(card => {
        const cardData = tarotCardMeanings.find(tc => {
          const match = tc.cnName.match(/^(\d+)\s+(.+)$/);
          const id = match ? match[1] : '';
          const name = match ? match[2] : tc.cnName;
          return id === card.id || name === card.name;
        });
        return {
          ...card,
          cardInfo: cardData?.cardInfo || ''
        };
      });

      const res = await fetch('/api/annual-fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          cards: cardsWithInfo,
          nickName,
          careerStatus,
          gender,
          loveStatus,
          careerStatusLabel,
          genderLabel,
          loveStatusLabel
        })
      });

      const data = await res.json();
      const endTime = Date.now();

      if (!data.ok) {
        alert('服务失败：' + data.error);
        return;
      }

      setResults(data.results || []);
      setElapsedTime(data.elapsedTime || (endTime - startTime));
      setTimeStats(data.timeStats || null);
      
      // 默认展开所有月份
      setExpandedMonths(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleGetSummary = async () => {
    if (results.length !== 12) {
      alert('请先完成12个月的运势占卜');
      return;
    }

    setSummaryLoading(true);
    setSummaryResult(null);
    setSummaryElapsedTime(null);
    const startTime = Date.now();

    try {
      const careerStatusLabelMap: Record<string, string> = {
        middle_high_school: '初高中生',
        college_above: '大学及以上',
        worker: '职场人',
        freelance: '自由状态'
      };
      const genderLabelMap: Record<string, string> = {
        female: '女',
        male: '男',
        other: '其他 / 不方便说'
      };
      const loveStatusLabelMap: Record<string, string> = {
        single_notLooking: '单身 - 暂时不想谈',
        single_looking: '单身 - 想遇见合适的人',
        in_relationship: '恋爱中',
        married_or_stable: '已婚 / 稳定关系'
      };

      const careerStatusLabel = careerStatus ? (careerStatusLabelMap[careerStatus] || careerStatus) : '';
      const genderLabel = gender ? (genderLabelMap[gender] || gender) : '';
      const loveStatusLabel = loveStatus ? (loveStatusLabelMap[loveStatus] || loveStatus) : '';
      // 提取12个月的content
      const monthlyContents = results.map(r => r.content);

      const res = await fetch('/api/annual-fortune-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          monthlyContents,
          nickName,
          careerStatus,
          gender,
          loveStatus,
          careerStatusLabel,
          genderLabel,
          loveStatusLabel
        })
      });

      const data = await res.json();
      const endTime = Date.now();

      if (!data.ok) {
        alert('服务失败：' + data.error);
        return;
      }

      setSummaryResult(data.result);
      setSummaryElapsedTime(data.elapsedTime || (endTime - startTime));
      setSummaryTimeStats(data.timeStats || null);
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExportTxt = () => {
    if (results.length === 0 && !summaryResult) {
      alert('没有可导出的内容，请先完成占卜');
      return;
    }

    const lines: string[] = [];
    lines.push('年度运势占卜结果');
    lines.push(`模型提供方：${provider}`);
    if (nickName || careerStatus || gender || loveStatus) {
      lines.push('');
      lines.push('【用户画像】');
      if (nickName) lines.push(`- 昵称：${nickName}`);
      if (careerStatus) {
        const map: Record<string, string> = {
          middle_high_school: '初高中生',
          college_above: '大学及以上',
          worker: '职场人',
          freelance: '自由状态'
        };
        lines.push(`- 身份类型：${map[careerStatus] || careerStatus}`);
      }
      if (gender) {
        const map: Record<string, string> = {
          female: '女',
          male: '男',
          other: '其他'
        };
        lines.push(`- 性别：${map[gender] || gender}`);
      }
      if (loveStatus) {
        const map: Record<string, string> = {
          single_notLooking: '单身 - 暂时不想谈',
          single_looking: '单身 - 想遇见合适的人',
          in_relationship: '恋爱中',
          married_or_stable: '已婚 / 稳定关系'
        };
        lines.push(`- 感情状态：${map[loveStatus] || loveStatus}`);
      }
    }
    lines.push('');

    // 开篇段落
    if (summaryResult && summaryResult.hookStarting) {
      lines.push('==============================');
      lines.push('【开篇】');
      lines.push('==============================');
      lines.push('');
      lines.push(summaryResult.hookStarting);
      lines.push('');
    }

    // 12 个月结果
    if (results.length > 0) {
      lines.push('==============================');
      lines.push('【十二个月运势】');
      lines.push('==============================');
      results.forEach((r) => {
        const monthName = monthNames[r.month - 1] || `${r.month}月`;
        lines.push('');
        lines.push(`【${monthName}】`);
        lines.push(`关键词：${r.keyword}`);
        lines.push(`对应牌：${r.card.name}（${r.card.reversed ? '逆位' : '正位'}）`);
        lines.push('占卜结果：');
        lines.push(r.content);
      });
    }

    // 年度总览
    if (summaryResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【年度运势总览】');
      lines.push('==============================');
      lines.push('');
      lines.push('整体分析：');
      lines.push(summaryResult.analysis || '');
      lines.push('');
      lines.push('全年总结：');
      lines.push(summaryResult.summary || '');
      lines.push('');
      lines.push('各月评分：');
      const scoreLines = [
        `一月：${summaryResult.January}`,
        `二月：${summaryResult.February}`,
        `三月：${summaryResult.March}`,
        `四月：${summaryResult.April}`,
        `五月：${summaryResult.May}`,
        `六月：${summaryResult.June}`,
        `七月：${summaryResult.July}`,
        `八月：${summaryResult.August}`,
        `九月：${summaryResult.September}`,
        `十月：${summaryResult.October}`,
        `十一月：${summaryResult.November}`,
        `十二月：${summaryResult.December}`,
      ];
      lines.push(...scoreLines);
    }

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `annual_fortune_result_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出完整报告（包含 12 个月、年度总览、六大领域、雷达图评分、年度总结语）
  const handleExportFullTxt = () => {
    if (results.length === 0 && !summaryResult && areaResults.length === 0 && !radarResult && !closingResult) {
      alert('没有可导出的内容，请先完成占卜');
      return;
    }

    const lines: string[] = [];
    lines.push('年度运势占卜完整报告');
    lines.push(`模型提供方：${provider}`);
    if (nickName || careerStatus || gender || loveStatus) {
      lines.push('');
      lines.push('【用户画像】');
      if (nickName) lines.push(`- 昵称：${nickName}`);
      if (careerStatus) {
        const map: Record<string, string> = {
          middle_high_school: '初高中生',
          college_above: '大学及以上',
          worker: '职场人',
          freelance: '自由状态'
        };
        lines.push(`- 身份类型：${map[careerStatus] || careerStatus}`);
      }
      if (gender) {
        const map: Record<string, string> = {
          female: '女',
          male: '男',
          other: '其他'
        };
        lines.push(`- 性别：${map[gender] || gender}`);
      }
      if (loveStatus) {
        const map: Record<string, string> = {
          single_notLooking: '单身 - 暂时不想谈',
          single_looking: '单身 - 想遇见合适的人',
          in_relationship: '恋爱中',
          married_or_stable: '已婚 / 稳定关系'
        };
        lines.push(`- 感情状态：${map[loveStatus] || loveStatus}`);
      }
    }
    lines.push('');

    // 开篇段落
    if (summaryResult && summaryResult.hookStarting) {
      lines.push('==============================');
      lines.push('【开篇】');
      lines.push('==============================');
      lines.push('');
      lines.push(summaryResult.hookStarting);
      lines.push('');
    }

    // 12 个月结果
    if (results.length > 0) {
      lines.push('==============================');
      lines.push('【十二个月运势】');
      lines.push('==============================');
      results.forEach((r) => {
        const monthName = monthNames[r.month - 1] || `${r.month}月`;
        lines.push('');
        lines.push(`【${monthName}】`);
        lines.push(`关键词：${r.keyword}`);
        lines.push(`对应牌：${r.card.name}（${r.card.reversed ? '逆位' : '正位'}）`);
        lines.push('占卜结果：');
        lines.push(r.content);
      });
    }

    // 年度总览
    if (summaryResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【年度运势总览】');
      lines.push('==============================');
      lines.push('');
      lines.push('整体分析：');
      lines.push(summaryResult.analysis || '');
      lines.push('');
      lines.push('全年总结：');
      lines.push(summaryResult.summary || '');
      lines.push('');
      lines.push('各月评分：');
      const scoreLines = [
        `一月：${summaryResult.January}`,
        `二月：${summaryResult.February}`,
        `三月：${summaryResult.March}`,
        `四月：${summaryResult.April}`,
        `五月：${summaryResult.May}`,
        `六月：${summaryResult.June}`,
        `七月：${summaryResult.July}`,
        `八月：${summaryResult.August}`,
        `九月：${summaryResult.September}`,
        `十月：${summaryResult.October}`,
        `十一月：${summaryResult.November}`,
        `十二月：${summaryResult.December}`,
      ];
      lines.push(...scoreLines);
    }

    // 领域雷达图评分
    if (radarResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【六大领域运势评分（雷达图数据）】');
      lines.push('==============================');
      lines.push('');
      lines.push('整体分析：');
      lines.push(radarResult.analysis || '');
      lines.push('');
      lines.push('各领域评分：');
      lines.push(`- 感情（love）：${radarResult.love}`);
      lines.push(`- 事业·学业（career）：${radarResult.career}`);
      lines.push(`- 财富（wealth）：${radarResult.wealth}`);
      lines.push(`- 健康（health）：${radarResult.health}`);
      lines.push(`- 人际关系（social）：${radarResult.social}`);
      lines.push(`- 内在成长（innerGrowth）：${radarResult.innerGrowth}`);
    }

    // 六大领域总览
    if (areaOverviewResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【六大领域总览】');
      lines.push('==============================');
      lines.push('');
      lines.push(areaOverviewResult.startingOverview || '');
    }

    // 六大领域详细解读
    if (areaResults.length > 0) {
      lines.push('');
      lines.push('==============================');
      lines.push('【六大领域详细解读】');
      lines.push('==============================');
      areaResults.forEach((r) => {
        lines.push('');
        lines.push(`【${r.areaName}】`);
        lines.push(`对应牌：${r.card.cnName}（${r.card.reversed ? '逆位' : '正位'}）`);
        lines.push(`一句话主命题：${r.hookSentece || '（未提供）'}`);
        lines.push('解读内容：');
        lines.push(r.content || '（未提供）');
        lines.push('关键提醒：');
        lines.push(r.summaryHighlight || '（未提供）');
      });
    }

    // 玄学指引好物
    if (goodLuckItemsResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【玄学指引好物】');
      lines.push('==============================');
      lines.push('');
      lines.push(`推荐好物：${goodLuckItemsResult.goodLuckItem || '（未提供）'}`);
      const meta = GOOD_LUCK_ITEMS_META[goodLuckItemsResult.goodLuckItem];
      if (meta) {
        lines.push(`标签：${meta.tags}`);
        lines.push(`祝福语：${meta.blessing}`);
      }
      lines.push('');
      lines.push('解析说明：');
      lines.push(goodLuckItemsResult.analysis || '（未提供）');
    }

    // 年度总结语
    if (closingResult) {
      lines.push('');
      lines.push('==============================');
      lines.push('【年度总结语】');
      lines.push('==============================');
      lines.push('');
      lines.push('年末 anchor 一句话：');
      lines.push(closingResult.anchorSentence || '（未提供）');
      lines.push('');
      lines.push('结尾总结段落：');
      lines.push(closingResult.closingParagraph || '（未提供）');
    }

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `annual_fortune_full_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 抽取 6 张领域牌（排除前面 12 张）
  const handleDrawAreaCards = () => {
    if (cards.length !== 12) {
      alert('请先完成 12 张牌的抽取和占卜');
      return;
    }

    // 已使用的牌 id
    const usedIds = new Set(cards.map((c) => c.id));

    const remainingIndices: number[] = [];
    tarotCardMeanings.forEach((cardData, idx) => {
      const match = cardData.cnName.match(/^(\d+)\s+(.+)$/);
      const id = match ? match[1] : String(idx);
      if (!usedIds.has(id)) {
        remainingIndices.push(idx);
      }
    });

    if (remainingIndices.length < 6) {
      alert('可用的剩余牌不足 6 张');
      return;
    }

    // 打乱剩余索引并取前 6 个
    const shuffled = [...remainingIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedIndices = shuffled.slice(0, 6);

    const areas: { areaId: AreaId; areaName: string }[] = [
      { areaId: 'love', areaName: '感情' },
      { areaId: 'career', areaName: '事业·学业' },
      { areaId: 'wealth', areaName: '财富' },
      { areaId: 'health', areaName: '健康' },
      { areaId: 'relationship', areaName: '人际关系' },
      { areaId: 'innerGrowth', areaName: '内在成长' }
    ];

    const newAreaCards: AreaCard[] = selectedIndices.map((idx, i) => {
      const cardData = tarotCardMeanings[idx];
      const reversed = Math.random() < 0.5;
      const match = cardData.cnName.match(/^(\d+)\s+(.+)$/);
      const id = match ? match[1] : String(idx);
      const name = match ? match[2] : cardData.cnName;
      const area = areas[i];

      return {
        id,
        name,
        cnName: cardData.cnName,
        reversed,
        areaId: area.areaId,
        areaName: area.areaName
      };
    });

    setAreaCards(newAreaCards);
    setAreaResults([]);
    setAreaElapsedTime(null);
    setAreaTimeStats(null);
  };

  // 并发生成六大领域解读
  const handleStartAreaFortune = async () => {
    if (!summaryResult) {
      alert('请先完成 12 个月占卜和年度总览');
      return;
    }
    if (areaCards.length !== 6) {
      alert('请先抽取 6 张领域牌');
      return;
    }

    setAreaLoading(true);
    setAreaResults([]);
    setAreaElapsedTime(null);
    setAreaTimeStats(null);
    setRadarResult(null);
    setRadarElapsedTime(null);
    setRadarTimeStats(null);
    setClosingResult(null);
    setClosingElapsedTime(null);
    setClosingTimeStats(null);
    const startTime = Date.now();

    try {
      const careerStatusLabelMap: Record<string, string> = {
        middle_high_school: '初高中生',
        college_above: '大学及以上',
        worker: '职场人',
        freelance: '自由状态'
      };
      const genderLabelMap: Record<string, string> = {
        female: '女',
        male: '男',
        other: '其他 / 不方便说'
      };
      const loveStatusLabelMap: Record<string, string> = {
        single_notLooking: '单身 - 暂时不想谈',
        single_looking: '单身 - 想遇见合适的人',
        in_relationship: '恋爱中',
        married_or_stable: '已婚 / 稳定关系'
      };

      const careerStatusLabel = careerStatus ? (careerStatusLabelMap[careerStatus] || careerStatus) : '';
      const genderLabel = gender ? (genderLabelMap[gender] || gender) : '';
      const loveStatusLabel = loveStatus ? (loveStatusLabelMap[loveStatus] || loveStatus) : '';
      const res = await fetch('/api/annual-fortune-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          areaCards: areaCards.map((card) => ({
            areaId: card.areaId,
            areaName: card.areaName,
            id: card.id,
            name: card.name,
            cnName: card.cnName,
            reversed: card.reversed
          })),
          nickName,
          careerStatus,
          gender,
          loveStatus,
          careerStatusLabel,
          genderLabel,
          loveStatusLabel
        })
      });

      const data = await res.json();
      const endTime = Date.now();

      if (!data.ok) {
        alert('六大领域解读失败：' + data.error);
        return;
      }

      setAreaResults(data.results || []);
      setAreaElapsedTime(data.elapsedTime || (endTime - startTime));
      setAreaTimeStats(data.timeStats || null);
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setAreaLoading(false);
    }
  };

  // 生成六大领域雷达图评分 + 结尾总结语（并发）
  const handleGenerateRadarAndClosing = async () => {
    if (areaResults.length !== 6) {
      alert('请先完成六大领域解读');
      return;
    }
    if (!summaryResult || results.length !== 12) {
      alert('请先完成 12 个月运势和年度总览');
      return;
    }

    setRadarResult(null);
    setRadarElapsedTime(null);
    setRadarTimeStats(null);
    setClosingResult(null);
    setClosingElapsedTime(null);
    setClosingTimeStats(null);
    setGoodLuckItemsResult(null);
    setGoodLuckItemsElapsedTime(null);
    setGoodLuckItemsTimeStats(null);
    setAreaOverviewResult(null);
    setAreaOverviewElapsedTime(null);
    setAreaOverviewTimeStats(null);

    const december = results.find((r) => r.month === 12);
    const decemberContent = december?.content || '';

    const overallStart = Date.now();
    const radarStart = Date.now();
    const closingStart = Date.now();
    const goodLuckItemsStart = Date.now();

    setRadarClosingLoading(true);

    try {
      const careerStatusLabelMap: Record<string, string> = {
        middle_high_school: '初高中生',
        college_above: '大学及以上',
        worker: '职场人',
        freelance: '自由状态'
      };
      const genderLabelMap: Record<string, string> = {
        female: '女',
        male: '男',
        other: '其他 / 不方便说'
      };
      const loveStatusLabelMap: Record<string, string> = {
        single_notLooking: '单身 - 暂时不想谈',
        single_looking: '单身 - 想遇见合适的人',
        in_relationship: '恋爱中',
        married_or_stable: '已婚 / 稳定关系'
      };

      const careerStatusLabel = careerStatus ? (careerStatusLabelMap[careerStatus] || careerStatus) : '';
      const genderLabel = gender ? (genderLabelMap[gender] || gender) : '';
      const loveStatusLabel = loveStatus ? (loveStatusLabelMap[loveStatus] || loveStatus) : '';
      const radarPromise = fetch('/api/annual-fortune-areas-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          areas: areaResults.map((r) => ({
            areaId: r.areaId,
            areaName: r.areaName,
            hookSentece: r.hookSentece,
            content: r.content,
            summaryHighlight: r.summaryHighlight
          })),
          nickName,
          careerStatus,
          gender,
          loveStatus,
          careerStatusLabel,
          genderLabel,
          loveStatusLabel
        })
      });

      const closingPromise = fetch('/api/annual-fortune-areas-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          decemberContent,
          areas: areaResults.map((r) => ({
            areaName: r.areaName,
            hookSentece: r.hookSentece,
            content: r.content,
            summaryHighlight: r.summaryHighlight
          }))
        })
      });

      const goodLuckItemsPromise = fetch('/api/annual-fortune-good-luck-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          decemberContent,
          areas: areaResults.map((r) => ({
            areaName: r.areaName,
            hookSentece: r.hookSentece,
            content: r.content,
            summaryHighlight: r.summaryHighlight
          }))
        })
      });

      const [radarRes, closingRes, goodLuckItemsRes] = await Promise.all([
        radarPromise,
        closingPromise,
        goodLuckItemsPromise
      ]);
      const radarData = await radarRes.json();
      const closingData = await closingRes.json();
      const goodLuckItemsData = await goodLuckItemsRes.json();
      const radarEnd = Date.now();
      const closingEnd = Date.now();
      const goodLuckItemsEnd = Date.now();

      if (!radarData.ok) {
        alert('领域雷达图评分失败：' + radarData.error);
      } else {
        setRadarResult(radarData.result || null);
        setRadarElapsedTime(radarData.elapsedTime || (radarEnd - radarStart));
        setRadarTimeStats(radarData.timeStats || null);
        // 从 radar API 返回结果中提取 startingOverview
        if (radarData.result?.startingOverview) {
          setAreaOverviewResult({ startingOverview: radarData.result.startingOverview });
          setAreaOverviewElapsedTime(radarData.elapsedTime || (radarEnd - radarStart));
          setAreaOverviewTimeStats(radarData.timeStats || null);
        }
      }

      if (!closingData.ok) {
        alert('年度总结语生成失败：' + closingData.error);
      } else {
        setClosingResult(closingData.result || null);
        setClosingElapsedTime(closingData.elapsedTime || (closingEnd - closingStart));
        setClosingTimeStats(closingData.timeStats || null);
      }

      if (!goodLuckItemsData.ok) {
        alert('玄学指引好物生成失败：' + goodLuckItemsData.error);
      } else {
        setGoodLuckItemsResult(goodLuckItemsData.result || null);
        setGoodLuckItemsElapsedTime(goodLuckItemsData.elapsedTime || (goodLuckItemsEnd - goodLuckItemsStart));
        setGoodLuckItemsTimeStats(goodLuckItemsData.timeStats || null);
      }
      setRadarClosingTotalTime(Date.now() - overallStart);
    } catch (err: any) {
      alert('生成雷达图 / 总结语失败：' + (err?.message || 'unknown'));
    } finally {
      setRadarClosingLoading(false);
    }
  };

  // 总流程占卜：先运行12个月占卜，然后自动生成总览
  const handleFullFlow = async () => {
    if (cards.length !== 12) {
      alert('请先抽取12张牌');
      return;
    }

    setFullFlowLoading(true);
    setResults([]);
    setElapsedTime(null);
    setTimeStats(null);
    setSummaryResult(null);
    setSummaryElapsedTime(null);
    setExpandedMonths(new Set());

    try {
      // 第一步：运行12个月占卜
      const cardsWithInfo = cards.map(card => {
        const cardData = tarotCardMeanings.find(tc => {
          const match = tc.cnName.match(/^(\d+)\s+(.+)$/);
          const id = match ? match[1] : '';
          const name = match ? match[2] : tc.cnName;
          return id === card.id || name === card.name;
        });
        return {
          ...card,
          cardInfo: cardData?.cardInfo || ''
        };
      });

      const res1 = await fetch('/api/annual-fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          cards: cardsWithInfo,
          nickName,
          careerStatus,
          gender,
          loveStatus
        })
      });

      const data1 = await res1.json();

      if (!data1.ok) {
        alert('12个月占卜失败：' + data1.error);
        return;
      }

      setResults(data1.results || []);
      setElapsedTime(data1.elapsedTime || 0);
      setTimeStats(data1.timeStats || null);
      setExpandedMonths(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));

      // 第二步：自动生成年度运势总览
      const monthlyContents = (data1.results || []).map((r: MonthResult) => r.content);
      
      const res2 = await fetch('/api/annual-fortune-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          monthlyContents,
          nickName,
          careerStatus,
          gender,
          loveStatus
        })
      });

      const data2 = await res2.json();

      if (!data2.ok) {
        alert('生成总览失败：' + data2.error);
        return;
      }

      setSummaryResult(data2.result);
      setSummaryElapsedTime(data2.elapsedTime || 0);
      setSummaryTimeStats(data2.timeStats || null);
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setFullFlowLoading(false);
    }
  };

  // 绘制折线图的辅助函数
  const renderLineChart = (scores: number[]) => {
    if (!scores || scores.length !== 12) return null;

    const maxScore = Math.max(...scores, 100);
    const minScore = Math.min(...scores, 0);
    const range = maxScore - minScore || 100;
    const chartHeight = 200;
    const chartWidth = 800;
    const padding = 40;
    const pointRadius = 4;

    // 计算每个点的坐标
    const points = scores.map((score, index) => {
      const x = padding + (index * (chartWidth - 2 * padding)) / 11;
      const y = padding + chartHeight - ((score - minScore) / range) * (chartHeight - 2 * padding);
      return { x, y, score };
    });

    // 生成路径
    const pathData = points.map((p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');

    return (
      <svg width={chartWidth} height={chartHeight + 60} style={{ maxWidth: '100%', height: 'auto' }}>
        {/* 背景网格 */}
        {[0, 25, 50, 75, 100].map(score => {
          const y = padding + chartHeight - ((score - minScore) / range) * (chartHeight - 2 * padding);
          return (
            <g key={score}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#e0e0e0"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={padding - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#666"
              >
                {score}
              </text>
            </g>
          );
        })}

        {/* 折线 */}
        <path
          d={pathData}
          fill="none"
          stroke="#4a148c"
          strokeWidth="2"
        />

        {/* 数据点 */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill="#4a148c"
            />
            <text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#333"
              fontWeight="600"
            >
              {point.score}
            </text>
            {/* 月份标签 */}
            <text
              x={point.x}
              y={chartHeight + 30}
              textAnchor="middle"
              fontSize="11"
              fill="#666"
            >
              {index + 1}月
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // 简单雷达图（6 维）渲染
  const renderRadarChart = (scores: {
    love: number;
    career: number;
    wealth: number;
    health: number;
    social: number;
    innerGrowth: number;
  } | null) => {
    if (!scores) return null;

    const labels = ['感情', '事业·学业', '财富', '健康', '人际', '内在成长'];
    const values = [
      scores.love ?? 0,
      scores.career ?? 0,
      scores.wealth ?? 0,
      scores.health ?? 0,
      scores.social ?? 0,
      scores.innerGrowth ?? 0
    ];

    const maxVal = 100;
    const size = 260;
    const center = size / 2;
    const radius = size * 0.35;

    const points = values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2; // 从正上方开始
      const r = (v / maxVal) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y, v, angle };
    });

    const pathData = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ') + ' Z';

    return (
      <svg width={size} height={size} style={{ maxWidth: '100%', height: 'auto' }}>
        {/* 同心多边形网格 */}
        {[0.25, 0.5, 0.75, 1].map((rRatio, idx) => {
          const r = radius * rRatio;
          const ringPoints = labels.map((_, i) => {
            const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return { x, y };
          });
          const d =
            ringPoints
              .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
              .join(' ') + ' Z';
          return (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke="#e0e0e0"
              strokeWidth={1}
            />
          );
        })}

        {/* 轴线 */}
        {labels.map((_, i) => {
          const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#bdbdbd"
              strokeWidth={1}
            />
          );
        })}

        {/* 数据多边形 */}
        <path
          d={pathData}
          fill="rgba(76, 175, 80, 0.2)"
          stroke="#2e7d32"
          strokeWidth={2}
        />

        {/* 顶点圆点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2e7d32" />
        ))}

        {/* 标签 */}
        {labels.map((label, i) => {
          const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
          const labelR = radius + 16;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={11}
              fill="#004d40"
            >
              {label}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>年度运势占卜</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>
        抽取12张牌，分别代表12个月的运势
      </p>

      {/* 基本信息 + Provider 选择 */}
      <section style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600 }}>模型提供方：</label>
          <select 
            value={provider} 
            onChange={(e) => setProvider(e.target.value as 'openai' | 'deepseek')}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}
          >
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            alignItems: 'center'
          }}
        >
          {/* 昵称 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>昵称</label>
            <input
              value={nickName}
              onChange={(e) => setNickName(e.target.value)}
              placeholder="可以填小名或你习惯的称呼"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14
              }}
            />
          </div>

          {/* 身份类型 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>身份类型</label>
            <select
              value={careerStatus}
              onChange={(e) => setCareerStatus(e.target.value as any)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14
              }}
            >
              <option value="">请选择</option>
              <option value="middle_high_school">初高中生</option>
              <option value="college_above">大学及以上</option>
              <option value="worker">职场人</option>
              <option value="freelance">自由状态</option>
            </select>
          </div>

          {/* 性别 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>性别</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14
              }}
            >
              <option value="">请选择</option>
              <option value="female">女</option>
              <option value="male">男</option>
              <option value="other">其他 / 不方便说</option>
            </select>
          </div>

          {/* 感情状态 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>感情状态</label>
            <select
              value={loveStatus}
              onChange={(e) => setLoveStatus(e.target.value as any)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14
              }}
            >
              <option value="">请选择</option>
              <option value="single_notLooking">单身 - 暂时不想谈</option>
              <option value="single_looking">单身 - 想遇见合适的人</option>
              <option value="in_relationship">恋爱中</option>
              <option value="married_or_stable">已婚 / 稳定关系</option>
            </select>
          </div>
        </div>
      </section>

      {/* 抽牌按钮 */}
      <section style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
        <button
          onClick={handleDrawCards}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 10,
            border: '1px solid #111',
            background: loading ? '#999' : '#111',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          🃏 抽取12张牌
        </button>
        {cards.length > 0 && (
          <button
            onClick={handleDrawCards}
            disabled={loading}
            style={{
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 10,
              border: '1px solid #666',
              background: loading ? '#ccc' : '#fff',
              color: '#666',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 重新抽牌
          </button>
        )}
      </section>

      {/* 展示抽到的牌 */}
      {cards.length > 0 && (
        <section style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>抽到的12张牌</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {cards.map((card, index) => (
              <div
                key={`${card.id}-${index}`}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: '#fff'
                }}
              >
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  {monthNames[index]}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {card.cnName}
                </div>
                <div style={{ fontSize: 12, color: card.reversed ? '#d32f2f' : '#1976d2' }}>
                  {card.reversed ? '逆位' : '正位'}
                </div>
              </div>
            ))}
          </div>

          {/* 开始占卜按钮 */}
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleStartFortune}
              disabled={loading || fullFlowLoading}
              style={{
                padding: '12px 20px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #4a148c',
                background: loading || fullFlowLoading ? '#b39ddb' : '#4a148c',
                color: '#fff',
                cursor: loading || fullFlowLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '占卜中…' : '🔮 开始占卜'}
            </button>
            <button
              onClick={handleFullFlow}
              disabled={loading || fullFlowLoading || summaryLoading}
              style={{
                padding: '12px 20px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #f57c00',
                background: loading || fullFlowLoading || summaryLoading ? '#ffb74d' : '#f57c00',
                color: '#fff',
                cursor: loading || fullFlowLoading || summaryLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {fullFlowLoading ? '总流程进行中…' : '✨ 总流程占卜'}
            </button>
            {results.length === 12 && !fullFlowLoading && (
              <button
                onClick={handleGetSummary}
                disabled={summaryLoading || loading}
                style={{
                  padding: '12px 20px',
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #1976d2',
                  background: summaryLoading || loading ? '#90caf9' : '#1976d2',
                  color: '#fff',
                  cursor: summaryLoading || loading ? 'not-allowed' : 'pointer'
                }}
              >
                {summaryLoading ? '生成中…' : '📊 生成年度运势总览'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 时间统计 */}
      {elapsedTime !== null && (
        <section style={{ marginBottom: 24, padding: 16, borderRadius: 8, background: '#e3f2fd', border: '1px solid #90caf9' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1565c0', marginBottom: 12 }}>
            ⏱️ 十二个月并发生成解读时间统计
          </div>
          <div style={{ fontSize: 14, color: '#1565c0', lineHeight: 1.8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>总耗时：{(elapsedTime / 1000).toFixed(2)} 秒</div>
            {timeStats && (
              <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 6, fontSize: 13 }}>
                <div style={{ marginBottom: 8, fontWeight: 600, color: '#333' }}>详细拆分：</div>
                <div style={{ marginBottom: 4 }}>• 准备阶段（抽牌、格式化）：<strong>{(timeStats.preparation / 1000).toFixed(2)} 秒</strong></div>
                <div style={{ marginBottom: 4 }}>• 网络请求（并发，12次）：<strong style={{ color: '#d32f2f' }}>{(timeStats.totalNetworkTime / 1000).toFixed(2)} 秒</strong></div>
                <div style={{ marginBottom: 4 }}>• JSON解析：<strong>{(timeStats.parsing / 1000).toFixed(2)} 秒</strong></div>
                <div style={{ marginBottom: 4 }}>• 其他处理：<strong>{(timeStats.other / 1000).toFixed(2)} 秒</strong></div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#333' }}>各月份网络请求耗时（真实网络时间）：</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {timeStats.networkRequests.map((req: any) => (
                      <div key={req.month} style={{ fontSize: 12, color: '#555', padding: 4 }}>
                        第{req.month}月：<strong>{(req.duration / 1000).toFixed(2)}s</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                    注：由于是并发请求，总网络时间 = 最慢的请求耗时（{(timeStats.totalNetworkTime / 1000).toFixed(2)}秒）
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 年度运势总览 */}
      {summaryResult && (
        <section style={{ marginBottom: 32, padding: 20, borderRadius: 12, border: '1px solid #1976d2', background: '#e3f2fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, margin: 0, color: '#1565c0' }}>📊 年度运势总览</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleExportTxt}
                style={{
                  padding: '8px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid #1565c0',
                  background: '#1565c0',
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                💾 导出 12 个月运势
              </button>
              <button
                onClick={handleExportFullTxt}
                style={{
                  padding: '8px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid #0d47a1',
                  background: '#0d47a1',
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                📄 导出完整报告
              </button>
            </div>
          </div>
          
          {summaryElapsedTime !== null && (
            <div style={{ marginBottom: 16, fontSize: 14, color: '#1565c0' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                ⏱️ 总耗时：{(summaryElapsedTime / 1000).toFixed(2)} 秒
              </div>
              {summaryTimeStats && (
                <div style={{ padding: 12, background: '#fff', borderRadius: 6, fontSize: 13 }}>
                  <div style={{ marginBottom: 8, fontWeight: 600, color: '#333' }}>详细拆分：</div>
                  <div style={{ marginBottom: 4 }}>
                    • 请求解析：<strong>{(summaryTimeStats.requestParsing / 1000).toFixed(2)} 秒</strong>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    • Prompt 生成：<strong>{(summaryTimeStats.promptGeneration / 1000).toFixed(2)} 秒</strong>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    • AI API 调用（精确）：<strong style={{ color: '#d32f2f' }}>{(summaryTimeStats.aiApiCall / 1000).toFixed(2)} 秒</strong>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    • 响应解析：<strong>{(summaryTimeStats.responseParsing / 1000).toFixed(2)} 秒</strong>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    • 其他处理：<strong>{(summaryTimeStats.other / 1000).toFixed(2)} 秒</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 折线图 */}
          <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16, fontWeight: 600 }}>月度运势趋势图</h3>
            <div style={{ overflowX: 'auto' }}>
              {renderLineChart([
                summaryResult.January,
                summaryResult.February,
                summaryResult.March,
                summaryResult.April,
                summaryResult.May,
                summaryResult.June,
                summaryResult.July,
                summaryResult.August,
                summaryResult.September,
                summaryResult.October,
                summaryResult.November,
                summaryResult.December
              ])}
            </div>
          </div>

          {/* 分析 */}
          <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, fontWeight: 600 }}>整体分析</h3>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333' }}>
              {summaryResult.analysis}
            </div>
          </div>

          {/* 开头引导语 */}
          {summaryResult.hookStarting && (
            <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12, fontWeight: 600 }}>✨ 开篇</h3>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333', fontSize: 15 }}>
                {summaryResult.hookStarting}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 结果展示：12 个月运势结果 */}
      {results.length > 0 && (
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>12个月运势结果</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map((result) => {
              const isExpanded = expandedMonths.has(result.month);
              return (
                <div
                  key={result.month}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#fff'
                  }}
                >
                  {/* 月份标题（可点击折叠） */}
                  <div
                    onClick={() => toggleMonth(result.month)}
                    style={{
                      padding: '16px 20px',
                      background: isExpanded ? '#f5f5f5' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: isExpanded ? '1px solid #ddd' : 'none',
                      transition: 'background 0.2s'
                    }}
                  >
                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                      {monthNames[result.month - 1]}运势
                    </h3>
                    <span style={{ fontSize: 20, color: '#666' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* 折叠内容 */}
                  {isExpanded && (
                    <div style={{ padding: '20px' }}>
                      {/* 关键词 */}
                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#4a148c' }}>
                          关键词
                        </h4>
                        <div style={{ fontSize: 18, color: '#333', fontWeight: 500 }}>
                          {result.keyword}
                        </div>
                      </div>

                      {/* 占卜结果 */}
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#4a148c' }}>
                          占卜结果
                        </h4>
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            color: '#555',
                            fontSize: 15
                          }}
                        >
                          {result.content}
                        </div>
                      </div>

                      {/* 对应的牌 */}
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          对应牌：{result.card.name}（{result.card.reversed ? '逆位' : '正位'}）
                        </div>
                      </div>

                      {/* 错误提示 */}
                      {!result.success && (
                        <div style={{ marginTop: 12, padding: 8, borderRadius: 4, background: '#ffebee', color: '#c62828', fontSize: 13 }}>
                          ⚠️ 此月份请求失败
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 全年总结 - 放在12个月运势之后 */}
      {summaryResult && summaryResult.summary && (
        <section style={{ marginBottom: 32, padding: 20, borderRadius: 12, border: '1px solid #9c27b0', background: '#f3e5f5' }}>
          <h2 style={{ fontSize: 20, marginBottom: 12, color: '#6a1b9a' }}>💫 全年总结</h2>
          <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333', fontSize: 15 }}>
              {summaryResult.summary}
            </div>
          </div>
        </section>
      )}

      {/* 第二阶段：六大领域解读 */}
      {summaryResult && (
        <section style={{ marginBottom: 32, padding: 20, borderRadius: 12, border: '1px solid #4caf50', background: '#e8f5e9' }}>
          <h2 style={{ fontSize: 20, marginBottom: 12, color: '#2e7d32' }}>🌟 六大领域年度解读</h2>
          <p style={{ fontSize: 14, color: '#2e7d32', marginBottom: 12 }}>
            在完成 12 个月运势和年度总览之后，你可以额外抽取 6 张牌，用来解读感情、事业·学业、财富、健康、人际关系、内在成长六个领域。
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              onClick={handleDrawAreaCards}
              disabled={areaLoading}
              style={{
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #2e7d32',
                background: areaLoading ? '#a5d6a7' : '#2e7d32',
                color: '#fff',
                cursor: areaLoading ? 'not-allowed' : 'pointer'
              }}
            >
              🎴 抽取 6 张领域牌
            </button>
            {areaCards.length === 6 && (
              <button
                onClick={handleStartAreaFortune}
                disabled={areaLoading}
                style={{
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #43a047',
                  background: areaLoading ? '#c8e6c9' : '#43a047',
                  color: '#fff',
                  cursor: areaLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {areaLoading ? '解读生成中…' : '✨ 开始 6 大领域解读'}
              </button>
            )}
            {areaResults.length === 6 && (
              <button
                onClick={handleGenerateRadarAndClosing}
                disabled={areaLoading || radarClosingLoading}
                style={{
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #00897b',
                  background: areaLoading || radarClosingLoading ? '#80cbc4' : '#00897b',
                  color: '#fff',
                  cursor: areaLoading || radarClosingLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {radarClosingLoading ? '生成中…' : '📊 生成领域雷达图与总结语'}
              </button>
            )}
          </div>

          {/* 展示抽到的 6 张领域牌 */}
          {areaCards.length === 6 && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid #c8e6c9', background: '#fff' }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: '#2e7d32' }}>抽到的 6 张领域牌</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {areaCards.map((card) => (
                  <div
                    key={`${card.areaId}-${card.id}`}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #ddd',
                      background: '#fafafa'
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 4 }}>{card.areaName}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{card.cnName}</div>
                    <div style={{ fontSize: 12, color: card.reversed ? '#d32f2f' : '#1976d2' }}>
                      {card.reversed ? '逆位' : '正位'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 领域雷达图（含评分） */}
          {radarResult && (
            <div style={{ marginTop: 20, marginBottom: 16, padding: 16, borderRadius: 8, border: '1px solid #80cbc4', background: '#e0f2f1' }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: '#00695c' }}>📈 六大领域运势评分（0~100）</h3>
              <div style={{ fontSize: 14, color: '#004d40', marginBottom: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {radarResult.analysis}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ minWidth: 220 }}>
                  {renderRadarChart(radarResult)}
                </div>
                <ul style={{ fontSize: 14, color: '#004d40', paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
                  <li>感情（love）：{radarResult.love}</li>
                  <li>事业·学业（career）：{radarResult.career}</li>
                  <li>财富（wealth）：{radarResult.wealth}</li>
                  <li>健康（health）：{radarResult.health}</li>
                  <li>人际关系（social）：{radarResult.social}</li>
                  <li>内在成长（innerGrowth）：{radarResult.innerGrowth}</li>
                </ul>
              </div>
              {radarElapsedTime !== null && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#00695c' }}>
                  ⏱️ 雷达图评分耗时：{(radarElapsedTime / 1000).toFixed(2)} 秒
                </div>
              )}
            </div>
          )}

          {/* 六大领域总览 */}
          {areaOverviewResult && (
            <div style={{ marginTop: 20, marginBottom: 16, padding: 16, borderRadius: 8, border: '1px solid #ff9800', background: '#fff3e0' }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: '#e65100' }}>📋 六大领域总览</h3>
              <div style={{ fontSize: 14, color: '#bf360c', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {areaOverviewResult.startingOverview}
              </div>
              {areaOverviewElapsedTime !== null && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#e65100' }}>
                  ⏱️ 领域总览生成耗时：{(areaOverviewElapsedTime / 1000).toFixed(2)} 秒
                </div>
              )}
            </div>
          )}

          {/* 六大领域解读结果 */}
          {areaResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {areaResults.map((r) => (
                <div
                  key={r.areaId}
                  style={{
                    border: '1px solid #c8e6c9',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fff'
                  }}
                >
                  <h3 style={{ fontSize: 16, marginBottom: 8, color: '#2e7d32' }}>
                    {r.areaName}（{r.card.cnName} / {r.card.reversed ? '逆位' : '正位'}）
                  </h3>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                    ⚡&quot;{r.hookSentece || '（未提供）'}&quot;
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#555',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                      marginBottom: 8
                    }}
                  >
                    {r.content}
                  </div>
                  <div style={{ fontSize: 13, color: '#1b5e20', fontWeight: 600 }}>
                    📌 这一年的关键提醒：{r.summaryHighlight || '（未提供）'}
                  </div>
                  {!r.success && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 6,
                        borderRadius: 4,
                        background: '#ffebee',
                        color: '#c62828',
                        fontSize: 12
                      }}
                    >
                      ⚠️ 此领域请求失败
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 玄学指引好物（放在年度总结语之前） */}
          {goodLuckItemsResult && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 8, border: '1px solid #ab47bc', background: '#f3e5f5' }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: '#6a1b9a' }}>🔮 玄学指引好物</h3>
              <div
                style={{
                  fontSize: 15,
                  color: '#4a148c',
                  marginBottom: 8,
                  whiteSpace: 'pre-wrap',
                  fontWeight: 600
                }}
              >
                {goodLuckItemsResult.goodLuckItem}
              </div>
              {(() => {
                const meta = GOOD_LUCK_ITEMS_META[goodLuckItemsResult.goodLuckItem];
                return meta ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#6a1b9a', marginBottom: 4 }}>{meta.tags}</div>
                    <div style={{ fontSize: 13, color: '#4a148c', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {meta.blessing}
                    </div>
                  </div>
                ) : null;
              })()}
              <div style={{ fontSize: 14, color: '#4a148c', marginBottom: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontWeight: 600 }}>
                {goodLuckItemsResult.analysis}
              </div>
              {goodLuckItemsElapsedTime !== null && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6a1b9a' }}>
                  ⏱️ 玄学指引好物生成耗时：{(goodLuckItemsElapsedTime / 1000).toFixed(2)} 秒
                </div>
              )}
            </div>
          )}

          {/* 年度总结语结果 */}
          {closingResult && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 8, border: '1px solid #ce93d8', background: '#f3e5f5' }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: '#6a1b9a' }}>📝 年度总结语</h3>
              <div
                style={{
                  fontSize: 15,
                  color: '#4a148c',
                  marginBottom: 8,
                  whiteSpace: 'pre-wrap',
                  fontWeight: 600
                }}
              >
                {closingResult.anchorSentence}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: '#4a148c',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6
                }}
              >
                {closingResult.closingParagraph}
              </div>
              {closingElapsedTime !== null && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6a1b9a' }}>
                  ⏱️ 总结语生成耗时：{(closingElapsedTime / 1000).toFixed(2)} 秒
                </div>
              )}
              {radarClosingTotalTime !== null && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#6a1b9a' }}>
                  ⏱️ 雷达图 + 总结语总耗时：{(radarClosingTotalTime / 1000).toFixed(2)} 秒
                </div>
              )}
            </div>
          )}

          {/* 时间统计 */}
          {areaElapsedTime !== null && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#c8e6c9', border: '1px solid #81c784' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1b5e20', marginBottom: 8 }}>
                ⏱️ 六大领域并发生成解读时间统计
              </div>
              <div style={{ fontSize: 13, color: '#1b5e20' }}>
                <div style={{ marginBottom: 4 }}>总耗时：{(areaElapsedTime / 1000).toFixed(2)} 秒</div>
                {areaTimeStats && (
                  <>
                    <div style={{ marginBottom: 4 }}>• 准备阶段：{(areaTimeStats.preparation / 1000).toFixed(2)} 秒</div>
                    <div style={{ marginBottom: 4 }}>
                      • 网络请求（并发，6 次）：<strong>{(areaTimeStats.totalNetworkTime / 1000).toFixed(2)} 秒</strong>
                    </div>
                    <div style={{ marginBottom: 4 }}>• JSON 解析：{(areaTimeStats.parsing / 1000).toFixed(2)} 秒</div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 空状态提示 */}
      {cards.length === 0 && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
          <p>点击上方按钮抽取12张牌开始占卜</p>
        </div>
      )}
    </main>
  );
}

