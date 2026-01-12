'use client';
import React, { useState, useEffect } from 'react';

interface ExtractResult {
  round: number;
  facts: string;
  tarot_overview: string;
  analysis: string;
  dialogue_area: string;
  rawJson?: string; // 原始 JSON 字符串
  savedFilePath?: string; // 保存的 JSON 文件路径
  savedPromptPath?: string; // 保存的 Prompt 文件路径
  promptText?: string; // 发送给模型的 Prompt 原文
}

interface MarkdownResult {
  round: number;
  facts: string;
  tarotOverview: string;
  rawOutput: string;
  savedFilePath?: string;
  savedPromptPath?: string;
  promptText?: string;
}

interface StageResult {
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
}

interface Stage1OnlyResult {
  round: number;
  stage1Summary: string; // stage1 的摘要
  stage1RawOutput: string; // stage1 的原始输出
  stage1PromptText?: string; // stage1 的 prompt
  savedStage1Path?: string; // stage1 保存的文件路径
  savedStage1PromptPath?: string; // stage1 prompt 保存的文件路径
}

interface Stage1WithNameAnalysisResult {
  round: number;
  stage1Summary: string;
  stage1RawOutput: string;
  nameAnalysis: string;
  ifHasOtherName: boolean | null;
  thisSessionRaw: string;
  savedPath?: string;
}

interface BatchMergeResult {
  batch: number;
  date: string; // 模拟日期
  memoryCount: number; // 这一批包含的记忆数量
  globalMemory: string; // 合并后的全局记忆
  stage2RawOutput: string; // stage2 的原始输出
  stage2PromptText?: string; // stage2 的 prompt
  savedStage2Path?: string; // stage2 保存的文件路径
  savedStage2PromptPath?: string; // stage2 prompt 保存的文件路径
}

interface ThreeCardsResult {
  cards: Array<{ id: string; name: string; reversed: boolean }>;
  interpretation: string;
}

// 辅助函数：计算相对时间标签
function getRelativeTimeLabel(memoryDate: Date, today: Date): string {
  // 重置时间部分，只比较日期
  const memoryDay = new Date(memoryDate.getFullYear(), memoryDate.getMonth(), memoryDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffDays = Math.floor((todayDay.getTime() - memoryDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';

  // 计算周边界（周一为一周开始）
  const todayDayOfWeek = todayDay.getDay() === 0 ? 7 : todayDay.getDay();
  const thisWeekStart = new Date(todayDay);
  thisWeekStart.setDate(todayDay.getDate() - todayDayOfWeek + 1);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  if (memoryDay >= thisWeekStart) return '这周早一点';
  if (memoryDay >= lastWeekStart && memoryDay <= lastWeekEnd) return '上周';

  // 本月
  const thisMonthStart = new Date(todayDay.getFullYear(), todayDay.getMonth(), 1);
  if (memoryDay >= thisMonthStart) return '这个月早些时候';

  return '更早';
}

// 辅助函数：清理 XML 格式的 facts（前端版本）
function cleanFactsXmlForCopy(facts: string): string {
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

// 根据 ifHasOtherName 过滤 XML 格式的 facts
function cleanFactsXmlWithNameFilter(facts: string, ifHasOtherName: boolean | null): string {
  const factsMatch = facts.match(/<facts>([\s\S]*?)<\/facts>/i);
  if (!factsMatch) return facts.trim();

  const factsContent = factsMatch[1];
  const parts: string[] = [];

  // 只有 ifHasOtherName 为 true 时才包含 personRelatedContent
  if (ifHasOtherName === true) {
    const personMatch = factsContent.match(/<personRelatedContent>([\s\S]*?)<\/personRelatedContent>/i);
    if (personMatch && personMatch[1].trim()) {
      parts.push(personMatch[1].trim());
    }
  }

  // userSelfContent 始终包含
  const selfMatch = factsContent.match(/<userSelfContent>([\s\S]*?)<\/userSelfContent>/i);
  if (selfMatch && selfMatch[1].trim()) {
    const selfContent = selfMatch[1].trim();
    if (!selfContent.includes('未提及') || !selfContent.includes('此部分为空')) {
      parts.push(selfContent);
    }
  }

  return parts.join('\n\n').trim();
}

export default function MemoryExtractPage() {
  const [loading, setLoading] = useState(false);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [loadingStage, setLoadingStage] = useState(false);
  const [loadingStage1Only, setLoadingStage1Only] = useState(false);
  const [loadingStage1OnlyXml, setLoadingStage1OnlyXml] = useState(false);
  const [loadingStage1WithNameAnalysis, setLoadingStage1WithNameAnalysis] = useState(false);
  const [loadingBatchMerge, setLoadingBatchMerge] = useState(false);
  const [loadingThreeCards, setLoadingThreeCards] = useState(false);
  const [results, setResults] = useState<ExtractResult[]>([]);
  const [markdownResults, setMarkdownResults] = useState<MarkdownResult[]>([]);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [stage1OnlyResults, setStage1OnlyResults] = useState<Stage1OnlyResult[]>([]);
  const [stage1OnlyXmlResults, setStage1OnlyXmlResults] = useState<Stage1OnlyResult[]>([]);
  const [stage1WithNameAnalysisResults, setStage1WithNameAnalysisResults] = useState<Stage1WithNameAnalysisResult[]>([]);
  const [batchMergeResults, setBatchMergeResults] = useState<BatchMergeResult[]>([]);
  const [threeCardsResult, setThreeCardsResult] = useState<ThreeCardsResult | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMarkdownRound, setCurrentMarkdownRound] = useState(0);
  const [currentStageRound, setCurrentStageRound] = useState(0);
  const [currentStage1OnlyRound, setCurrentStage1OnlyRound] = useState(0);
  const [currentStage1OnlyXmlRound, setCurrentStage1OnlyXmlRound] = useState(0);
  const [currentStage1WithNameAnalysisRound, setCurrentStage1WithNameAnalysisRound] = useState(0);
  const [currentBatchMergeRound, setCurrentBatchMergeRound] = useState(0);
  const [provider, setProvider] = useState<'openai' | 'deepseek'>('deepseek');
  const [uploadedText, setUploadedText] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [roundLimit, setRoundLimit] = useState(20);
  const [stage1AbortController, setStage1AbortController] = useState<AbortController | null>(null);
  const [stage1XmlAbortController, setStage1XmlAbortController] = useState<AbortController | null>(null);
  const [stage1WithNameAnalysisAbortController, setStage1WithNameAnalysisAbortController] = useState<AbortController | null>(null);
  const [batchAbortController, setBatchAbortController] = useState<AbortController | null>(null);
  const [extractAbortController, setExtractAbortController] = useState<AbortController | null>(null);
  const [markdownAbortController, setMarkdownAbortController] = useState<AbortController | null>(null);
  const [stageAbortController, setStageAbortController] = useState<AbortController | null>(null);
  const [batchMergeAbortController, setBatchMergeAbortController] = useState<AbortController | null>(null);
  const [stage1Status, setStage1Status] = useState('');
  const [stage1XmlStatus, setStage1XmlStatus] = useState('');
  const [stage1WithNameAnalysisStatus, setStage1WithNameAnalysisStatus] = useState('');
  const [batchStatus, setBatchStatus] = useState('');

  // 月度压缩相关状态
  const [loadingMonthlyCompress, setLoadingMonthlyCompress] = useState(false);
  const [monthlyCompressResult, setMonthlyCompressResult] = useState('');
  const [monthlyCompressAbortController, setMonthlyCompressAbortController] = useState<AbortController | null>(null);

  // 本月压缩相关状态
  const [loadingCurrentMonthCompress, setLoadingCurrentMonthCompress] = useState(false);
  const [currentMonthCompressResult, setCurrentMonthCompressResult] = useState('');
  const [currentMonthCompressAbortController, setCurrentMonthCompressAbortController] = useState<AbortController | null>(null);

  // 三张牌解读相关状态
  const [questionThreeCards, setQuestionThreeCards] = useState('');
  const [questionDateThreeCards, setQuestionDateThreeCards] = useState<string>('');
  const [additionalInfoThreeCards, setAdditionalInfoThreeCards] = useState('');
  const [memoryTextThreeCards, setMemoryTextThreeCards] = useState('');

  // 对话文件选择
  const [dialogueFiles, setDialogueFiles] = useState<string[]>([]);
  const [selectedDialogueFile, setSelectedDialogueFile] = useState('');

  // 页面加载时获取对话文件列表
  useEffect(() => {
    fetch('/api/list-dialogue-files')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.files) {
          setDialogueFiles(data.files);
          if (data.files.length > 0) {
            const defaultFile = data.files.find((f: string) => f.includes('timeOrder')) || data.files[0];
            setSelectedDialogueFile(defaultFile);
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleExtract = async () => {
    const controller = new AbortController();
    setExtractAbortController(controller);
    setLoading(true);
    setResults([]);
    setCurrentRound(0);
    
    try {
      const res = await fetch('/api/extract-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setResults(data.results || []);
      setCurrentRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoading(false);
      setExtractAbortController(null);
    }
  };

  const handleExtractMarkdown = async () => {
    const controller = new AbortController();
    setMarkdownAbortController(controller);
    setLoadingMarkdown(true);
    setMarkdownResults([]);
    setCurrentMarkdownRound(0);
    
    try {
      const res = await fetch('/api/extract-memory-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setMarkdownResults(data.results || []);
      setCurrentMarkdownRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingMarkdown(false);
      setMarkdownAbortController(null);
    }
  };

  const handleExtractStage = async () => {
    const controller = new AbortController();
    setStageAbortController(controller);
    setLoadingStage(true);
    setStageResults([]);
    setCurrentStageRound(0);
    
    try {
      const res = await fetch('/api/extract-memory-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setStageResults(data.results || []);
      setCurrentStageRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingStage(false);
      setStageAbortController(null);
    }
  };

  const handleExtractStage1Only = async () => {
    const controller = new AbortController();
    setStage1AbortController(controller);
    setLoadingStage1Only(true);
    setStage1OnlyResults([]);
    setCurrentStage1OnlyRound(0);

    try {
      const res = await fetch('/api/extract-memory-stage1-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, selectedFile: selectedDialogueFile }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setStage1OnlyResults(data.results || []);
      setCurrentStage1OnlyRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingStage1Only(false);
      setStage1AbortController(null);
    }
  };

  const handleExtractStage1OnlyXml = async () => {
    const controller = new AbortController();
    setStage1XmlAbortController(controller);
    setLoadingStage1OnlyXml(true);
    setStage1OnlyXmlResults([]);
    setCurrentStage1OnlyXmlRound(0);

    try {
      const res = await fetch('/api/extract-memory-stage1-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, format: 'xml', selectedFile: selectedDialogueFile }),
        signal: controller.signal
      });

      const data = await res.json();

      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setStage1OnlyXmlResults(data.results || []);
      setCurrentStage1OnlyXmlRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingStage1OnlyXml(false);
      setStage1XmlAbortController(null);
    }
  };

  const handleBatchMerge = async () => {
    const controller = new AbortController();
    setBatchMergeAbortController(controller);
    setLoadingBatchMerge(true);
    setBatchMergeResults([]);
    setCurrentBatchMergeRound(0);

    try {
      const res = await fetch('/api/extract-memory-batch-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setBatchMergeResults(data.results || []);
      setCurrentBatchMergeRound(data.results?.length || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingBatchMerge(false);
      setBatchMergeAbortController(null);
    }
  };

  const handleThreeCards = async () => {
    if (!questionThreeCards.trim()) {
      alert('请先输入问题～');
      return;
    }
    if (!memoryTextThreeCards.trim()) {
      alert('请先输入 Memory 文本～');
      return;
    }
    
    setLoadingThreeCards(true);
    setThreeCardsResult(null);
    
    try {
      const res = await fetch('/api/chat-three-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          question: questionThreeCards,
          questionDate: questionDateThreeCards,
          additionalInfo: additionalInfoThreeCards,
          memoryText: memoryTextThreeCards
        })
      });

      const data = await res.json();
      
      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setThreeCardsResult({
        cards: data.cards || [],
        interpretation: data.interpretation || ''
      });
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    } finally {
      setLoadingThreeCards(false);
    }
  };

  const readFileText = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleUploadFile = async (file: File) => {
    try {
      const text = await readFileText(file);
      setUploadedText(text);
      setUploadFileName(file.name);
      setStage1OnlyResults([]);
      setBatchMergeResults([]);
      setStage1Status(`已载入文件：${file.name}，${text.length} 字符`);
      setBatchStatus('');
    } catch (err: any) {
      alert('读取文件失败：' + (err?.message || 'unknown'));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUploadFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleStage1FromUpload = async () => {
    if (!uploadedText.trim()) {
      alert('请先选择或拖入 txt 文件');
      return;
    }

    const sessions = uploadedText
      .split(/^===\s*$/m)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sessions.length === 0) {
      alert('文件内容为空或格式不正确（需要使用 === 分隔）');
      return;
    }

    const totalRounds = Math.min(roundLimit || sessions.length, sessions.length);
    const chunkSize = 1; // 每次调用 1 轮以便即时显示

    const controller = new AbortController();
    setStage1AbortController(controller);
    setLoadingStage1Only(true);
    setStage1OnlyResults([]);
    setCurrentStage1OnlyRound(0);
    setStage1Status(`准备处理 ${totalRounds} 轮...`);

    let processed = 0;
    try {
      while (processed < totalRounds) {
        const remaining = totalRounds - processed;
        const thisRoundLimit = Math.min(chunkSize, remaining);

        const res = await fetch('/api/extract-memory-stage1-only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            fileContent: uploadedText,
            roundLimit: thisRoundLimit,
            startFrom: processed,
            saveToFile: false
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setStage1Status('处理失败');
          break;
        }

        const newResults = data.results || [];
        processed += newResults.length;
        setStage1OnlyResults((prev) => [...prev, ...newResults]);
        setCurrentStage1OnlyRound(processed);
        setStage1Status(`已完成 ${processed}/${totalRounds} 轮`);
      }

      if (processed === totalRounds) {
        setStage1Status(`完成 ${processed} 轮`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStage1Status('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setStage1Status('处理失败');
      }
    } finally {
      setLoadingStage1Only(false);
      setStage1AbortController(null);
    }
  };

  const stopStage1 = () => {
    if (stage1AbortController) {
      stage1AbortController.abort();
    }
  };

  // XML 格式的 Stage 1 提取
  const handleStage1XmlFromUpload = async () => {
    if (!uploadedText.trim()) {
      alert('请先选择或拖入 txt 文件');
      return;
    }

    const sessions = uploadedText
      .split(/^===\s*$/m)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sessions.length === 0) {
      alert('文件内容为空或格式不正确（需要使用 === 分隔）');
      return;
    }

    const totalRounds = Math.min(roundLimit || sessions.length, sessions.length);
    const chunkSize = 1;

    const controller = new AbortController();
    setStage1XmlAbortController(controller);
    setLoadingStage1OnlyXml(true);
    setStage1OnlyXmlResults([]);
    setCurrentStage1OnlyXmlRound(0);
    setStage1XmlStatus(`准备处理 ${totalRounds} 轮 (XML格式)...`);

    let processed = 0;
    try {
      while (processed < totalRounds) {
        const remaining = totalRounds - processed;
        const thisRoundLimit = Math.min(chunkSize, remaining);

        const res = await fetch('/api/extract-memory-stage1-only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            fileContent: uploadedText,
            roundLimit: thisRoundLimit,
            startFrom: processed,
            saveToFile: false,
            format: 'xml'
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setStage1XmlStatus('处理失败');
          break;
        }

        const newResults = data.results || [];
        processed += newResults.length;
        setStage1OnlyXmlResults((prev) => [...prev, ...newResults]);
        setCurrentStage1OnlyXmlRound(processed);
        setStage1XmlStatus(`已完成 ${processed}/${totalRounds} 轮 (XML格式)`);
      }

      if (processed === totalRounds) {
        setStage1XmlStatus(`完成 ${processed} 轮 (XML格式)`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStage1XmlStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setStage1XmlStatus('处理失败');
      }
    } finally {
      setLoadingStage1OnlyXml(false);
      setStage1XmlAbortController(null);
    }
  };

  const stopStage1Xml = () => {
    if (stage1XmlAbortController) {
      stage1XmlAbortController.abort();
    }
  };

  // Stage1 + 称呼分析（从上传文件）
  const handleStage1WithNameAnalysisFromUpload = async () => {
    if (!uploadedText.trim()) {
      alert('请先选择或拖入 txt 文件');
      return;
    }

    const sessions = uploadedText
      .split(/^===\s*$/m)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sessions.length === 0) {
      alert('文件内容为空或格式不正确（需要使用 === 分隔）');
      return;
    }

    const totalRounds = Math.min(roundLimit || sessions.length, sessions.length);
    const chunkSize = 1;

    const controller = new AbortController();
    setStage1WithNameAnalysisAbortController(controller);
    setLoadingStage1WithNameAnalysis(true);
    setStage1WithNameAnalysisResults([]);
    setCurrentStage1WithNameAnalysisRound(0);
    setStage1WithNameAnalysisStatus(`准备处理 ${totalRounds} 轮 (Stage1 + 称呼分析)...`);

    let processed = 0;
    try {
      while (processed < totalRounds) {
        const remaining = totalRounds - processed;
        const thisRoundLimit = Math.min(chunkSize, remaining);

        const res = await fetch('/api/extract-memory-stage1-with-name-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            fileContent: uploadedText,
            roundLimit: thisRoundLimit,
            startFrom: processed,
            saveToFile: false
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setStage1WithNameAnalysisStatus('处理失败');
          break;
        }

        const newResults = data.results || [];
        processed += newResults.length;
        setStage1WithNameAnalysisResults((prev) => [...prev, ...newResults]);
        setCurrentStage1WithNameAnalysisRound(processed);
        setStage1WithNameAnalysisStatus(`已完成 ${processed}/${totalRounds} 轮 (Stage1 + 称呼分析)`);
      }

      if (processed === totalRounds) {
        setStage1WithNameAnalysisStatus(`完成 ${processed} 轮 (Stage1 + 称呼分析)`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStage1WithNameAnalysisStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setStage1WithNameAnalysisStatus('处理失败');
      }
    } finally {
      setLoadingStage1WithNameAnalysis(false);
      setStage1WithNameAnalysisAbortController(null);
    }
  };

  // Stage1 + 称呼分析（从本地文件夹）
  const handleStage1WithNameAnalysisFromLocal = async () => {
    if (!selectedDialogueFile) {
      alert('请先选择对话文件');
      return;
    }

    const controller = new AbortController();
    setStage1WithNameAnalysisAbortController(controller);
    setLoadingStage1WithNameAnalysis(true);
    setStage1WithNameAnalysisResults([]);
    setCurrentStage1WithNameAnalysisRound(0);
    setStage1WithNameAnalysisStatus('准备处理 (Stage1 + 称呼分析)...');

    let processed = 0;
    try {
      // 逐轮处理
      while (true) {
        const res = await fetch('/api/extract-memory-stage1-with-name-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            selectedFile: selectedDialogueFile,
            roundLimit: 1,
            startFrom: processed,
            saveToFile: true
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setStage1WithNameAnalysisStatus('处理失败');
          break;
        }

        const newResults = data.results || [];
        if (newResults.length === 0) {
          // 没有更多数据了
          setStage1WithNameAnalysisStatus(`完成 ${processed} 轮 (Stage1 + 称呼分析)`);
          break;
        }

        processed += newResults.length;
        setStage1WithNameAnalysisResults((prev) => [...prev, ...newResults]);
        setCurrentStage1WithNameAnalysisRound(processed);
        setStage1WithNameAnalysisStatus(`已完成 ${processed} 轮 (Stage1 + 称呼分析)`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStage1WithNameAnalysisStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setStage1WithNameAnalysisStatus('处理失败');
      }
    } finally {
      setLoadingStage1WithNameAnalysis(false);
      setStage1WithNameAnalysisAbortController(null);
    }
  };

  const stopStage1WithNameAnalysis = () => {
    if (stage1WithNameAnalysisAbortController) {
      stage1WithNameAnalysisAbortController.abort();
    }
  };

  // 统一的中止函数，可以中止所有正在进行的操作
  const stopAllOperations = () => {
    if (extractAbortController) {
      extractAbortController.abort();
    }
    if (markdownAbortController) {
      markdownAbortController.abort();
    }
    if (stageAbortController) {
      stageAbortController.abort();
    }
    if (stage1AbortController) {
      stage1AbortController.abort();
    }
    if (stage1XmlAbortController) {
      stage1XmlAbortController.abort();
    }
    if (stage1WithNameAnalysisAbortController) {
      stage1WithNameAnalysisAbortController.abort();
    }
    if (batchMergeAbortController) {
      batchMergeAbortController.abort();
    }
    if (batchAbortController) {
      batchAbortController.abort();
    }
    if (monthlyCompressAbortController) {
      monthlyCompressAbortController.abort();
    }
    if (currentMonthCompressAbortController) {
      currentMonthCompressAbortController.abort();
    }
  };

  // 检查是否有任何操作正在进行
  const isAnyOperationRunning = loading || loadingMarkdown || loadingStage || loadingStage1Only || loadingStage1OnlyXml || loadingStage1WithNameAnalysis || loadingBatchMerge || loadingMonthlyCompress || loadingCurrentMonthCompress;

  const handleBatchMergeFromStage1 = async () => {
    if (stage1OnlyResults.length === 0) {
      alert('请先完成 Stage 1 提取');
      return;
    }

    const BATCH_SIZE = 5;
    const controller = new AbortController();
    setBatchAbortController(controller);
    setLoadingBatchMerge(true);
    setBatchMergeResults([]);
    setCurrentBatchMergeRound(0);
    setBatchStatus('处理中...');

    let processed = 0;
    let lastGlobalMemory = '';

    try {
      while (processed < stage1OnlyResults.length) {
        const batch = stage1OnlyResults.slice(processed, processed + BATCH_SIZE);
        const stage1Summaries = batch.map((item) => ({
          round: item.round,
          summary: item.stage1Summary
        }));

        const res = await fetch('/api/extract-memory-batch-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            stage1Summaries,
            saveToFile: false,
            oldGlobalMemory: lastGlobalMemory
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setBatchStatus('处理失败');
          break;
        }

        const newResults = data.results || [];
        setBatchMergeResults((prev) => [...prev, ...newResults]);
        processed += batch.length;
        setCurrentBatchMergeRound(newResults.length);
        setBatchStatus(`已合并 ${processed}/${stage1OnlyResults.length} 条记忆`);

        if (newResults.length > 0) {
          lastGlobalMemory = newResults[newResults.length - 1].globalMemory || lastGlobalMemory;
        }
      }

      if (processed >= stage1OnlyResults.length) {
        setBatchStatus(`完成 ${Math.ceil(stage1OnlyResults.length / BATCH_SIZE)} 批`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setBatchStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setBatchStatus('处理失败');
      }
    } finally {
      setLoadingBatchMerge(false);
      setBatchAbortController(null);
    }
  };

  const stopBatch = () => {
    if (batchAbortController) {
      batchAbortController.abort();
    }
  };

  // 使用 XML 格式的 Stage 1 结果进行批量合并（从文件夹读取）
  const handleBatchMergeFromStage1Xml = async () => {
    const controller = new AbortController();
    setBatchAbortController(controller);
    setLoadingBatchMerge(true);
    setBatchMergeResults([]);
    setCurrentBatchMergeRound(0);
    setBatchStatus('从 XML 文件夹读取并合并...');

    try {
      // 直接调用 API，不传 stage1Summaries，让 API 从 XML 文件夹读取
      const res = await fetch('/api/extract-memory-batch-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          saveToFile: true,
          format: 'xml'
          // 不传 stage1Summaries，API 会自动从文件夹读取
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!data.ok) {
        alert('处理失败：' + data.error);
        setBatchStatus('处理失败');
        return;
      }

      const newResults = data.results || [];
      setBatchMergeResults(newResults);
      setCurrentBatchMergeRound(newResults.length);
      setBatchStatus(`完成 ${newResults.length} 批 (XML)`);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setBatchStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setBatchStatus('处理失败');
      }
    } finally {
      setLoadingBatchMerge(false);
      setBatchAbortController(null);
    }
  };

  // 从上传文件的 XML Stage1 结果进行批量合并
  const handleBatchMergeFromUploadXml = async () => {
    if (stage1OnlyXmlResults.length === 0) {
      alert('请先完成 XML 格式的 Stage 1 提取');
      return;
    }

    const BATCH_SIZE = 5;
    const controller = new AbortController();
    setBatchAbortController(controller);
    setLoadingBatchMerge(true);
    setBatchMergeResults([]);
    setCurrentBatchMergeRound(0);
    setBatchStatus('从上传文件的 XML 结果合并中...');

    let processed = 0;
    let lastGlobalMemory = '';

    try {
      while (processed < stage1OnlyXmlResults.length) {
        const batch = stage1OnlyXmlResults.slice(processed, processed + BATCH_SIZE);
        const stage1Summaries = batch.map((item) => ({
          round: item.round,
          summary: item.stage1Summary
        }));

        const res = await fetch('/api/extract-memory-batch-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            stage1Summaries,
            saveToFile: false,
            oldGlobalMemory: lastGlobalMemory,
            format: 'xml'
          }),
          signal: controller.signal
        });

        const data = await res.json();
        if (!data.ok) {
          alert('处理失败：' + data.error);
          setBatchStatus('处理失败');
          break;
        }

        const newResults = data.results || [];
        setBatchMergeResults((prev) => [...prev, ...newResults]);
        processed += batch.length;
        setCurrentBatchMergeRound(newResults.length);
        setBatchStatus(`已合并 ${processed}/${stage1OnlyXmlResults.length} 条记忆 (XML)`);

        if (newResults.length > 0) {
          lastGlobalMemory = newResults[newResults.length - 1].globalMemory || lastGlobalMemory;
        }
      }

      if (processed >= stage1OnlyXmlResults.length) {
        setBatchStatus(`完成 ${Math.ceil(stage1OnlyXmlResults.length / BATCH_SIZE)} 批 (XML)`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setBatchStatus('已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
        setBatchStatus('处理失败');
      }
    } finally {
      setLoadingBatchMerge(false);
      setBatchAbortController(null);
    }
  };

  // 复制 Stage1 记忆为 Stage2 格式
  const handleCopyStage1ForStage2 = (
    results: Stage1OnlyResult[],
    isXml: boolean = true,
    withNameAnalysisResults?: Stage1WithNameAnalysisResult[]
  ) => {
    if (results.length === 0) {
      alert('没有可复制的 Stage 1 结果');
      return;
    }

    const today = new Date();

    const formattedMemories = results.map((item, idx) => {
      // 从最新记录开始计算：每4条记忆对应1天
      const reversedIdx = results.length - 1 - idx; // 反转索引，最新的在前
      const daysAgo = Math.floor(reversedIdx / 4);   // 每4条为1天
      const memoryDate = new Date(today);
      memoryDate.setDate(today.getDate() - daysAgo);

      const timeLabel = getRelativeTimeLabel(memoryDate, today);

      // 根据格式选择清理方式
      let cleanedFacts: string;
      if (isXml) {
        // 如果有称呼分析结果，根据 ifHasOtherName 过滤
        const nameAnalysisItem = withNameAnalysisResults?.find(r => r.round === item.round);
        if (nameAnalysisItem && nameAnalysisItem.ifHasOtherName !== null) {
          cleanedFacts = cleanFactsXmlWithNameFilter(
            item.stage1RawOutput || item.stage1Summary,
            nameAnalysisItem.ifHasOtherName
          );
        } else {
          cleanedFacts = cleanFactsXmlForCopy(item.stage1RawOutput || item.stage1Summary);
        }
      } else {
        // Markdown 格式直接使用 summary
        cleanedFacts = item.stage1Summary;
      }

      if (!cleanedFacts) return null;
      return `### ${timeLabel}\n${cleanedFacts}`;
    }).filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(formattedMemories).then(() => {
      alert(`已复制 ${results.length} 条记忆到剪贴板！`);
    }).catch(err => {
      alert('复制失败：' + err.message);
    });
  };

  // 从本地文件夹读取 Stage1 并复制为 Stage2 格式
  const handleCopyStage1FromLocal = async () => {
    try {
      const res = await fetch('/api/read-stage1-for-copy?format=xml');
      const data = await res.json();

      if (!data.ok) {
        alert(data.error || '读取失败');
        return;
      }

      navigator.clipboard.writeText(data.content).then(() => {
        alert(`已复制 ${data.count} 条记忆到剪贴板！`);
      }).catch(err => {
        alert('复制失败：' + err.message);
      });
    } catch (err: any) {
      alert('请求失败：' + (err?.message || 'unknown'));
    }
  };

  // 上月压缩记忆
  const handleMonthlyCompress = async () => {
    const controller = new AbortController();
    setMonthlyCompressAbortController(controller);
    setLoadingMonthlyCompress(true);
    setMonthlyCompressResult('');

    try {
      const res = await fetch('/api/compress-monthly-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          limit: 90,
          mode: 'last-month'
        }),
        signal: controller.signal
      });

      const data = await res.json();

      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setMonthlyCompressResult(data.compressedResult || '');
      alert(`上个月记忆压缩完成！已处理 ${data.originalEventsCount} 条记忆\n月份: ${data.monthStr}\n文件已保存到: ${data.savedResultPath}`);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingMonthlyCompress(false);
      setMonthlyCompressAbortController(null);
    }
  };

  // 本月压缩记忆
  const handleCurrentMonthCompress = async () => {
    const controller = new AbortController();
    setCurrentMonthCompressAbortController(controller);
    setLoadingCurrentMonthCompress(true);
    setCurrentMonthCompressResult('');

    try {
      const res = await fetch('/api/compress-monthly-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          limit: 90,
          mode: 'this-month'
        }),
        signal: controller.signal
      });

      const data = await res.json();

      if (!data.ok) {
        alert('处理失败：' + data.error);
        return;
      }

      setCurrentMonthCompressResult(data.compressedResult || '');
      alert(`本月记忆压缩完成！已处理 ${data.originalEventsCount} 条记忆\n月份: ${data.monthStr}\n文件已保存到: ${data.savedResultPath}`);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        alert('操作已中止');
      } else {
        alert('请求失败：' + (err?.message || 'unknown'));
      }
    } finally {
      setLoadingCurrentMonthCompress(false);
      setCurrentMonthCompressAbortController(null);
    }
  };

  const handleDownloadResults = () => {
    if (stage1OnlyResults.length === 0 && batchMergeResults.length === 0) {
      alert('暂无可下载的结果');
      return;
    }

    const parts: string[] = [];
    if (stage1OnlyResults.length > 0) {
      parts.push(`【Stage 1 提取】共 ${stage1OnlyResults.length} 轮`);
      stage1OnlyResults.forEach((item) => {
        parts.push(`--- 第 ${item.round} 轮 ---\n${item.stage1Summary || ''}`);
      });
    }

    if (batchMergeResults.length > 0) {
      parts.push(`\n【批量合并记忆】共 ${batchMergeResults.length} 批`);
      batchMergeResults.forEach((item) => {
        parts.push(`--- 第 ${item.batch} 批（${item.date}，${item.memoryCount} 条） ---\n${item.globalMemory || ''}`);
      });
    }

    const blob = new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memory_extract_results.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>记忆提取流程</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>
        从对话文件中提取并更新事实性记忆和占卜概览
      </p>

      {/* 分区一：上传文件模式 */}
      <section style={{ marginBottom: 20, padding: 16, border: '2px solid #ce93d8', borderRadius: 12, background: '#f3e5f5' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>📤 上传文件模式</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>从您的电脑上传 .txt 文件进行处理</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>选择或拖入 txt 文件：</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{
                border: '2px dashed #bbb',
                borderRadius: 10,
                padding: 14,
                background: '#fff',
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('txt-file-input')?.click()}
            >
              <input
                id="txt-file-input"
                type="file"
                accept=".txt"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
              <div style={{ color: '#666', fontSize: 14 }}>
                {uploadFileName
                  ? `已选择：${uploadFileName}（${uploadedText.length} 字符）`
                  : '拖入或点击选择 .txt 文件'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontWeight: 600 }}>调用轮数（默认 20）：</label>
            <input
              type="number"
              min={1}
              value={roundLimit}
              onChange={(e) => setRoundLimit(Number(e.target.value) || 1)}
              style={{ width: '120px', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                onClick={handleStage1FromUpload}
                disabled={loadingStage1Only}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #9c27b0',
                  background: loadingStage1Only ? '#ce93d8' : '#9c27b0',
                  color: '#fff',
                  cursor: loadingStage1Only ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingStage1Only ? '处理中…' : '🚀 开始仅提取 Stage 1'}
              </button>
              <button
                onClick={handleStage1XmlFromUpload}
                disabled={loadingStage1OnlyXml}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #2196f3',
                  background: loadingStage1OnlyXml ? '#90caf9' : '#2196f3',
                  color: '#fff',
                  cursor: loadingStage1OnlyXml ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingStage1OnlyXml ? '处理中…' : '🚀 仅提取 Stage 1 (XML)'}
              </button>
              <button
                onClick={handleBatchMergeFromUploadXml}
                disabled={loadingBatchMerge || stage1OnlyXmlResults.length === 0}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #ff9800',
                  background: (loadingBatchMerge || stage1OnlyXmlResults.length === 0) ? '#ffcc80' : '#ff9800',
                  color: '#fff',
                  cursor: (loadingBatchMerge || stage1OnlyXmlResults.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingBatchMerge ? '处理中…' : '🔀 批量合并记忆 (XML)'}
              </button>
              <button
                onClick={() => {
                  const results = stage1WithNameAnalysisResults.length > 0
                    ? stage1WithNameAnalysisResults
                    : stage1OnlyXmlResults;
                  handleCopyStage1ForStage2(
                    results as Stage1OnlyResult[],
                    true,
                    stage1WithNameAnalysisResults.length > 0 ? stage1WithNameAnalysisResults : undefined
                  );
                }}
                disabled={stage1OnlyXmlResults.length === 0 && stage1WithNameAnalysisResults.length === 0}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #4caf50',
                  background: (stage1OnlyXmlResults.length === 0 && stage1WithNameAnalysisResults.length === 0) ? '#a5d6a7' : '#4caf50',
                  color: '#fff',
                  cursor: (stage1OnlyXmlResults.length === 0 && stage1WithNameAnalysisResults.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                📋 复制为 Stage2 格式
              </button>
              <button
                onClick={handleStage1WithNameAnalysisFromUpload}
                disabled={loadingStage1WithNameAnalysis}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #9c27b0',
                  background: loadingStage1WithNameAnalysis ? '#ce93d8' : '#9c27b0',
                  color: '#fff',
                  cursor: loadingStage1WithNameAnalysis ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingStage1WithNameAnalysis ? '处理中…' : '🔍 Stage1 + 称呼分析'}
              </button>
              <button
                onClick={() => { stopStage1(); stopStage1Xml(); stopStage1WithNameAnalysis(); }}
                disabled={!loadingStage1Only && !loadingStage1OnlyXml && !loadingStage1WithNameAnalysis}
                style={{
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid #b71c1c',
                  background: (loadingStage1Only || loadingStage1OnlyXml || loadingStage1WithNameAnalysis) ? '#e57373' : '#f5f5f5',
                  color: (loadingStage1Only || loadingStage1OnlyXml || loadingStage1WithNameAnalysis) ? '#fff' : '#b71c1c',
                  cursor: (loadingStage1Only || loadingStage1OnlyXml || loadingStage1WithNameAnalysis) ? 'pointer' : 'not-allowed'
                }}
              >
                ⏹ 中止
              </button>
            </div>
            <div style={{ color: '#555', fontSize: 13 }}>
              {stage1Status || stage1XmlStatus || stage1WithNameAnalysisStatus || '准备就绪'}
            </div>
          </div>
        </div>

        {(stage1OnlyResults.length > 0 || stage1Status === '已中止') && (
          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleBatchMergeFromStage1}
              disabled={loadingBatchMerge}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #ff9800',
                background: loadingBatchMerge ? '#ffb74d' : '#ff9800',
                color: '#fff',
                cursor: loadingBatchMerge ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingBatchMerge ? '处理中…' : '➡️ 下一步：批量合并记忆'}
            </button>
            <button
              onClick={stopBatch}
              disabled={!loadingBatchMerge}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #b71c1c',
                background: loadingBatchMerge ? '#e57373' : '#f5f5f5',
                color: loadingBatchMerge ? '#fff' : '#b71c1c',
                cursor: loadingBatchMerge ? 'pointer' : 'not-allowed'
              }}
            >
              ⏹ 中止合并
            </button>
            <span style={{ color: '#555', fontSize: 13 }}>{batchStatus}</span>
          </div>
        )}

        {(stage1OnlyResults.length > 0 || batchMergeResults.length > 0) && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleDownloadResults}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: '#333',
                color: '#fff',
                fontWeight: 600
              }}
            >
              💾 下载当前结果
            </button>
          </div>
        )}
      </section>

      {/* 分区二：本地文件模式 */}
      <section style={{ marginBottom: 16, padding: 16, border: '1px solid #ddd', borderRadius: 12, background: '#fafafa' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>📁 本地文件模式</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>从服务器 data/raw_dialogue 文件夹读取文件</p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label>模型提供方：</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'deepseek')}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label>对话文件：</label>
            <select
              value={selectedDialogueFile}
              onChange={(e) => setSelectedDialogueFile(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', minWidth: 320 }}
            >
              {dialogueFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleExtract}
              disabled={loading}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #111',
                background: loading ? '#999' : '#111',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '处理中…' : '🧠 JSON 提取'}
            </button>
            <button
              onClick={handleExtractMarkdown}
              disabled={loadingMarkdown}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #444',
                background: loadingMarkdown ? '#bbb' : '#444',
                color: '#fff',
                cursor: loadingMarkdown ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingMarkdown ? '处理中…' : '✍️ Markdown 提取'}
            </button>
            <button
              onClick={handleExtractStage}
              disabled={loadingStage}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #0066cc',
                background: loadingStage ? '#80b3ff' : '#0066cc',
                color: '#fff',
                cursor: loadingStage ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingStage ? '处理中…' : '🔄 分阶段提取'}
            </button>
            <button
              onClick={handleExtractStage1Only}
              disabled={loadingStage1Only}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #9c27b0',
                background: loadingStage1Only ? '#ce93d8' : '#9c27b0',
                color: '#fff',
                cursor: loadingStage1Only ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingStage1Only ? '处理中…' : '📝 仅提取 Stage 1'}
            </button>
            <button
              onClick={handleExtractStage1OnlyXml}
              disabled={loadingStage1OnlyXml}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #2196f3',
                background: loadingStage1OnlyXml ? '#90caf9' : '#2196f3',
                color: '#fff',
                cursor: loadingStage1OnlyXml ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingStage1OnlyXml ? '处理中…' : '📝 仅提取 Stage 1 (XML)'}
            </button>
            <button
              onClick={handleBatchMerge}
              disabled={loadingBatchMerge}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #ff9800',
                background: loadingBatchMerge ? '#ffb74d' : '#ff9800',
                color: '#fff',
                cursor: loadingBatchMerge ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingBatchMerge ? '处理中…' : '🔀 批量合并记忆'}
            </button>
            <button
              onClick={handleBatchMergeFromStage1Xml}
              disabled={loadingBatchMerge}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #9c27b0',
                background: loadingBatchMerge ? '#ce93d8' : '#9c27b0',
                color: '#fff',
                cursor: loadingBatchMerge ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingBatchMerge ? '处理中…' : '🔀 批量合并记忆 (XML)'}
            </button>
            <button
              onClick={handleCopyStage1FromLocal}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #4caf50',
                background: '#4caf50',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              📋 复制本地 Stage1 为 Stage2 格式
            </button>
            <button
              onClick={handleStage1WithNameAnalysisFromLocal}
              disabled={loadingStage1WithNameAnalysis}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #9c27b0',
                background: loadingStage1WithNameAnalysis ? '#ce93d8' : '#9c27b0',
                color: '#fff',
                cursor: loadingStage1WithNameAnalysis ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingStage1WithNameAnalysis ? '处理中…' : '🔍 Stage1 + 称呼分析'}
            </button>
            <button
              onClick={handleMonthlyCompress}
              disabled={loadingMonthlyCompress}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #4caf50',
                background: loadingMonthlyCompress ? '#81c784' : '#4caf50',
                color: '#fff',
                cursor: loadingMonthlyCompress ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingMonthlyCompress ? '处理中…' : '📦 上月记忆压缩'}
            </button>
            <button
              onClick={handleCurrentMonthCompress}
              disabled={loadingCurrentMonthCompress}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #2196f3',
                background: loadingCurrentMonthCompress ? '#64b5f6' : '#2196f3',
                color: '#fff',
                cursor: loadingCurrentMonthCompress ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingCurrentMonthCompress ? '处理中…' : '📦 本月记忆压缩'}
            </button>
          </div>
          <button
            onClick={stopAllOperations}
            disabled={!isAnyOperationRunning}
            style={{
              padding: '10px 16px',
              fontWeight: 600,
              borderRadius: 10,
              border: '1px solid #d32f2f',
              background: isAnyOperationRunning ? '#f44336' : '#ccc',
              color: '#fff',
              cursor: isAnyOperationRunning ? 'pointer' : 'not-allowed'
            }}
          >
            ⏹ 中止所有操作
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.length > 0 && (
            <span style={{ color: '#555' }}>JSON 模式：已完成 {results.length} 轮</span>
          )}
          {markdownResults.length > 0 && (
            <span style={{ color: '#555' }}>Markdown 模式：已完成 {markdownResults.length} 轮</span>
          )}
          {stageResults.length > 0 && (
            <span style={{ color: '#555' }}>分阶段模式：已完成 {stageResults.length} 轮</span>
          )}
          {stage1OnlyResults.length > 0 && (
            <span style={{ color: '#555' }}>Stage 1 仅提取：已完成 {stage1OnlyResults.length} 轮</span>
          )}
          {batchMergeResults.length > 0 && (
            <span style={{ color: '#555' }}>批量合并：已完成 {batchMergeResults.length} 批</span>
          )}
        </div>
      </section>

      {/* 结果显示 */}
      {results.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>提取结果</h2>
          
          {results.map((result, index) => (
            <div 
              key={index}
              style={{
                border: '1px solid #eee',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === results.length - 1 ? '#f9f9f9' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮
              </h3>

              {/* Prompt 原文展示 */}
              {result.promptText && (
                <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 发送给模型的 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedPromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedPromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.promptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 400,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.promptText}
                  </pre>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  对话领域 (dialogue_area)
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14
                }}>
                  {result.dialogue_area}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  分析 (analysis)
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14
                }}>
                  {result.analysis}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  事实性记忆 (facts)
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#f0f7ff', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  maxHeight: 400,
                  overflow: 'auto'
                }}>
                  {result.facts}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  占卜概览 (tarot_overview)
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#fff7e6', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14
                }}>
                  {result.tarot_overview}
                </div>
              </div>

              {/* 原始 JSON 展示 */}
              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                    📄 模型输出的原始 JSON
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {result.savedFilePath && (
                      <span style={{ fontSize: 12, color: '#888' }}>
                        💾 已保存: {result.savedFilePath.split(/[/\\]/).pop()}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const jsonText = result.rawJson || JSON.stringify({
                          analysis: result.analysis,
                          facts: result.facts,
                          tarot_overview: result.tarot_overview,
                          dialogue_area: result.dialogue_area
                        }, null, 2);
                        const textarea = document.createElement('textarea');
                        textarea.value = jsonText;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        alert('JSON 已复制到剪贴板');
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #ddd',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      复制 JSON
                    </button>
                  </div>
                </div>
                <pre style={{ 
                  padding: 12, 
                  background: '#f8f8f8', 
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 500,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.rawJson || JSON.stringify({
                    analysis: result.analysis,
                    facts: result.facts,
                    tarot_overview: result.tarot_overview,
                    dialogue_area: result.dialogue_area
                  }, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Markdown 结果显示 */}
      {markdownResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Markdown 提取结果</h2>
          
          {markdownResults.map((result, index) => (
            <div 
              key={`md-${index}`}
              style={{
                border: '1px solid #ddd',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === markdownResults.length - 1 ? '#fdfdf9' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮（Markdown）
              </h3>

              {/* Prompt 原文展示 */}
              {result.promptText && (
                <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 发送给模型的 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedPromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedPromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.promptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 400,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.promptText}
                  </pre>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  facts
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#eef7ff', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14
                }}>
                  {result.facts || '（无）'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  tarot overview
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#fff4e6', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14
                }}>
                  {result.tarotOverview || '（无）'}
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                    📄 原始输出
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {result.savedFilePath && (
                      <span style={{ fontSize: 12, color: '#888' }}>
                        💾 已保存: {result.savedFilePath.split(/[/\\]/).pop()}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const textarea = document.createElement('textarea');
                        textarea.value = result.rawOutput || '';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        alert('输出已复制到剪贴板');
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #ddd',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      复制输出
                    </button>
                  </div>
                </div>
                <pre style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 500,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.rawOutput}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>正在处理对话文件，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于对话轮次数量
          </p>
        </div>
      )}
      {loadingMarkdown && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>Markdown 模式处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于对话轮次数量
          </p>
        </div>
      )}

      {/* Stage 结果显示 */}
      {stageResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>分阶段提取结果</h2>
          
          {stageResults.map((result, index) => (
            <div 
              key={`stage-${index}`}
              style={{
                border: '1px solid #0066cc',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === stageResults.length - 1 ? '#f0f7ff' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮（分阶段提取）
              </h3>

              {/* Stage 1 Prompt 原文展示 */}
              {result.stage1PromptText && (
                <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 Stage 1 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedStage1PromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedStage1PromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.stage1PromptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Stage 1 Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 300,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.stage1PromptText}
                  </pre>
                </div>
              )}

              {/* Stage 1 摘要 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  Stage 1 摘要（本轮对话提取的事实）
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#e8f4fd', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  maxHeight: 300,
                  overflow: 'auto'
                }}>
                  {result.stage1Summary || '（无）'}
                </div>
                {result.savedStage1Path && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    💾 Stage 1 输出已保存: {result.savedStage1Path.split(/[/\\]/).pop()}
                  </div>
                )}
              </div>

              {/* Stage 2 Prompt 原文展示（第2轮开始才有） */}
              {result.stage2PromptText && (
                <div style={{ marginBottom: 20, borderTop: '1px solid #eee', paddingTop: 16, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 Stage 2 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedStage2PromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedStage2PromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.stage2PromptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Stage 2 Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 300,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.stage2PromptText}
                  </pre>
                </div>
              )}

              {/* Stage 2 全局记忆 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  Stage 2 全局记忆（合并后的完整记忆）
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#fff4e6', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  maxHeight: 400,
                  overflow: 'auto'
                }}>
                  {result.stage2GlobalMemory || '（无）'}
                </div>
                {result.savedStage2Path && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    💾 Stage 2 输出已保存: {result.savedStage2Path.split(/[/\\]/).pop()}
                  </div>
                )}
              </div>

              {/* 原始输出 */}
              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                    📄 原始输出
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <h5 style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#888' }}>Stage 1 原始输出</h5>
                    <pre style={{ 
                      padding: 12, 
                      background: '#f5f5f5', 
                      borderRadius: 8,
                      fontSize: 11,
                      overflow: 'auto',
                      maxHeight: 300,
                      border: '1px solid #e0e0e0',
                      fontFamily: 'Monaco, "Courier New", monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {result.stage1RawOutput}
                    </pre>
                  </div>
                  <div>
                    <h5 style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#888' }}>Stage 2 原始输出</h5>
                    <pre style={{ 
                      padding: 12, 
                      background: '#f5f5f5', 
                      borderRadius: 8,
                      fontSize: 11,
                      overflow: 'auto',
                      maxHeight: 300,
                      border: '1px solid #e0e0e0',
                      fontFamily: 'Monaco, "Courier New", monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {result.stage2RawOutput}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {loadingStage && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>分阶段模式处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于对话轮次数量
          </p>
        </div>
      )}

      {/* Stage 1 Only 结果显示 */}
      {stage1OnlyResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Stage 1 仅提取结果</h2>
          
          {stage1OnlyResults.map((result, index) => (
            <div 
              key={`stage1only-${index}`}
              style={{
                border: '1px solid #9c27b0',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === stage1OnlyResults.length - 1 ? '#f3e5f5' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮（仅 Stage 1）
              </h3>

              {/* Stage 1 Prompt 原文展示 */}
              {result.stage1PromptText && (
                <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 Stage 1 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedStage1PromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedStage1PromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.stage1PromptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Stage 1 Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 300,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.stage1PromptText}
                  </pre>
                </div>
              )}

              {/* Stage 1 摘要 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  Stage 1 摘要（本轮对话提取的事实）
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#e8f4fd', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  maxHeight: 300,
                  overflow: 'auto'
                }}>
                  {result.stage1Summary || '（无）'}
                </div>
                {result.savedStage1Path && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    💾 Stage 1 输出已保存: {result.savedStage1Path.split(/[/\\]/).pop()}
                  </div>
                )}
              </div>

              {/* 原始输出 */}
              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  📄 Stage 1 原始输出
                </h4>
                <pre style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 8,
                  fontSize: 11,
                  overflow: 'auto',
                  maxHeight: 300,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.stage1RawOutput}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {loadingStage1Only && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>Stage 1 仅提取模式处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于对话轮次数量
          </p>
        </div>
      )}

      {/* Stage 1 Only XML 结果显示 */}
      {stage1OnlyXmlResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Stage 1 仅提取结果 (XML格式)</h2>

          {stage1OnlyXmlResults.map((result, index) => (
            <div
              key={`stage1only-xml-${index}`}
              style={{
                border: '1px solid #2196f3',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === stage1OnlyXmlResults.length - 1 ? '#e3f2fd' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮（仅 Stage 1 - XML格式）
              </h3>

              {/* Stage 1 输出展示 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                    📄 Stage 1 输出 (XML)
                  </h4>
                  <button
                    onClick={() => {
                      const textarea = document.createElement('textarea');
                      textarea.value = result.stage1RawOutput || '';
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      alert('Stage 1 输出已复制到剪贴板');
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      borderRadius: 4,
                      border: '1px solid #ddd',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    复制
                  </button>
                </div>
                <pre style={{
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 400,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.stage1RawOutput}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {loadingStage1OnlyXml && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>Stage 1 XML格式提取处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于对话轮次数量
          </p>
        </div>
      )}

      {/* Stage1 + 称呼分析 结果显示 */}
      {stage1WithNameAnalysisResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Stage 1 + 称呼分析结果</h2>

          {stage1WithNameAnalysisResults.map((result, index) => (
            <div
              key={`stage1-name-analysis-${index}`}
              style={{
                border: '1px solid #9c27b0',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === stage1WithNameAnalysisResults.length - 1 ? '#f3e5f5' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.round} 轮
                <span style={{
                  marginLeft: 12,
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: result.ifHasOtherName === true ? '#4caf50' : result.ifHasOtherName === false ? '#f44336' : '#9e9e9e',
                  color: '#fff'
                }}>
                  {result.ifHasOtherName === true ? '有明确称呼' : result.ifHasOtherName === false ? '无明确称呼' : '未知'}
                </span>
              </h3>

              {/* 原始对话内容 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                  💬 原始对话内容
                </h4>
                <pre style={{
                  padding: 12,
                  background: '#e3f2fd',
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 300,
                  border: '1px solid #90caf9',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.thisSessionRaw}
                </pre>
              </div>

              {/* Stage 1 Facts 输出 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                  📄 Facts 输出
                </h4>
                <pre style={{
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 300,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.stage1RawOutput}
                </pre>
              </div>

              {/* 称呼分析输出 */}
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                  🔍 称呼分析
                </h4>
                <pre style={{
                  padding: 12,
                  background: '#fce4ec',
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 200,
                  border: '1px solid #f8bbd9',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.nameAnalysis}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {loadingStage1WithNameAnalysis && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>Stage 1 + 称呼分析处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            每轮需要两次 API 调用，可能需要较长时间
          </p>
        </div>
      )}

      {/* 批量合并结果显示 */}
      {batchMergeResults.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>批量合并记忆结果</h2>
          
          {batchMergeResults.map((result, index) => (
            <div 
              key={`batch-${index}`}
              style={{
                border: '1px solid #ff9800',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                background: index === batchMergeResults.length - 1 ? '#fff3e0' : '#fff'
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
                第 {result.batch} 批（{result.date}，包含 {result.memoryCount} 个记忆）
              </h3>

              {/* Stage 2 Prompt 原文展示 */}
              {result.stage2PromptText && (
                <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                      📝 Stage 2 Prompt 原文
                    </h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {result.savedStage2PromptPath && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          💾 已保存: {result.savedStage2PromptPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = result.stage2PromptText || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Stage 2 Prompt 已复制到剪贴板');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        复制
                      </button>
                    </div>
                  </div>
                  <pre style={{ 
                    padding: 12, 
                    background: '#fafafa', 
                    borderRadius: 8,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 300,
                    border: '1px solid #e0e0e0',
                    fontFamily: 'Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {result.stage2PromptText}
                  </pre>
                </div>
              )}

              {/* 全局记忆 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  全局记忆（合并后的完整记忆）
                </h4>
                <div style={{ 
                  padding: 12, 
                  background: '#fff4e6', 
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  maxHeight: 400,
                  overflow: 'auto'
                }}>
                  {result.globalMemory || '（无）'}
                </div>
                {result.savedStage2Path && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    💾 Stage 2 输出已保存: {result.savedStage2Path.split(/[/\\]/).pop()}
                  </div>
                )}
              </div>

              {/* 原始输出 */}
              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                  📄 Stage 2 原始输出
                </h4>
                <pre style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 8,
                  fontSize: 11,
                  overflow: 'auto',
                  maxHeight: 300,
                  border: '1px solid #e0e0e0',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {result.stage2RawOutput}
                </pre>
              </div>
            </div>
          ))}
        </section>
      )}

      {loadingBatchMerge && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>批量合并模式处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于记忆文件数量
          </p>
        </div>
      )}

      {/* 上月压缩结果显示 */}
      {monthlyCompressResult && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>上月记忆压缩结果</h2>
          <div style={{
            border: '1px solid #4caf50',
            borderRadius: 12,
            padding: 20,
            background: '#f1f8e9'
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
              压缩后的记忆内容
            </h3>
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: 12,
              background: '#fff',
              borderRadius: 8,
              fontSize: 14,
              maxHeight: 600,
              overflow: 'auto',
              border: '1px solid #c5e1a5'
            }}>
              {monthlyCompressResult}
            </div>
          </div>
        </section>
      )}

      {loadingMonthlyCompress && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>上月记忆压缩处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于记忆数量
          </p>
        </div>
      )}

      {/* 本月压缩结果显示 */}
      {currentMonthCompressResult && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>本月记忆压缩结果</h2>
          <div style={{
            border: '1px solid #2196f3',
            borderRadius: 12,
            padding: 20,
            background: '#e3f2fd'
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 12, color: '#333' }}>
              压缩后的记忆内容
            </h3>
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: 12,
              background: '#fff',
              borderRadius: 8,
              fontSize: 14,
              maxHeight: 600,
              overflow: 'auto',
              border: '1px solid #90caf9'
            }}>
              {currentMonthCompressResult}
            </div>
          </div>
        </section>
      )}

      {loadingCurrentMonthCompress && (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          <p>本月记忆压缩处理中，请稍候...</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            这可能需要一些时间，取决于记忆数量
          </p>
        </div>
      )}

      {/* 三张牌解读区域 */}
      <section style={{ marginTop: 48, borderTop: '2px solid #ddd', paddingTop: 32 }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>🔮 三张牌解读（手动输入 Memory）</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>
          手动输入问题和 Memory 文本，进行三张牌解读
        </p>

        {/* 输入区域 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>问题 / 主题：</label>
            <textarea
              value={questionThreeCards}
              onChange={(e) => setQuestionThreeCards(e.target.value)}
              placeholder="例如：我该如何推进目前的感情关系？"
              rows={3}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>提问日期：</label>
              <input
                type="date"
                value={questionDateThreeCards}
                onChange={(e) => setQuestionDateThreeCards(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>附加信息（可选）：</label>
              <textarea
                value={additionalInfoThreeCards}
                onChange={(e) => setAdditionalInfoThreeCards(e.target.value)}
                placeholder="例如：我们上周为小事争执；我想提升沟通质量..."
                rows={3}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Memory 文本（必填）：</label>
            <textarea
              value={memoryTextThreeCards}
              onChange={(e) => setMemoryTextThreeCards(e.target.value)}
              placeholder="手动输入要参考的记忆文本，例如：&#10;- 2025年11月1日 💕 恋爱关系（涉及：小明）：我们上周为小事争执，我想提升沟通质量。&#10;- 2025年11月2日 💕 恋爱关系（涉及：小明）：今天一起吃了晚饭，感觉关系有所改善。"
              rows={6}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>

          <button
            onClick={handleThreeCards}
            disabled={loadingThreeCards}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              borderRadius: 10,
              border: '1px solid #9c27b0',
              background: loadingThreeCards ? '#ce93d8' : '#9c27b0',
              color: '#fff',
              cursor: loadingThreeCards ? 'not-allowed' : 'pointer',
              fontSize: 16
            }}
          >
            {loadingThreeCards ? '处理中…' : '🔮 抽三张牌并解读'}
          </button>
        </div>

        {/* 结果显示 */}
        {threeCardsResult && (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 20, marginBottom: 16 }}>抽到的三张牌</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              {threeCardsResult.cards.map((card, index) => (
                <div
                  key={index}
                  style={{
                    flex: '1 1 200px',
                    padding: 16,
                    border: '2px solid #9c27b0',
                    borderRadius: 12,
                    background: '#f3e5f5'
                  }}
                >
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                    第 {index + 1} 张
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: 14, color: card.reversed ? '#f44336' : '#4caf50' }}>
                    {card.reversed ? '逆位' : '正位'}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 20, marginBottom: 16 }}>解读结果</h3>
            <div style={{
              whiteSpace: 'pre-wrap',
              border: '1px solid #9c27b0',
              borderRadius: 12,
              padding: 20,
              background: '#fafafa',
              lineHeight: 1.8,
              fontSize: 15
            }}>
              {threeCardsResult.interpretation}
            </div>
          </div>
        )}

        {loadingThreeCards && (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <p>正在生成三张牌解读，请稍候...</p>
          </div>
        )}
      </section>
    </main>
  );
}

