'use client';

import { useState } from 'react';

const GOOD_LUCK_ITEMS = [
  '白水晶',
  '粉水晶',
  '黑曜石',
  '黄水晶',
  '香薰蜡烛',
  '扩香石',
  '鼠尾草',
  '干花香囊',
  '捕梦网',
  '多肉植物',
  '幸运御守'
];

export default function BatchTestGoodLuckItemsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [provider, setProvider] = useState<'openai' | 'deepseek'>('deepseek');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // 解析单个文件内容
  const parseFile = async (file: File): Promise<{ monthSummary: string; areas: any[] } | null> => {
    const text = await file.text();
    
    // 提取12个月运势总结（从【十二个月运势】标题后的分隔符开始，到下一个 ====== 分隔符之前）
    const monthsMatch = text.match(/={20,}\s*【十二个月运势】\s*={20,}\s*([\s\S]*?)(?=\n={20,})/);
    const monthSummary = monthsMatch ? monthsMatch[1].trim() : null;
    
    if (!monthSummary) {
      return null;
    }
    
    // 提取六大领域信息
    const areas = [];
    const areaNames = ['感情', '事业·学业', '财富', '健康', '人际关系', '内在成长'];
    
    for (const areaName of areaNames) {
      const areaPattern = new RegExp(
        `【${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】[\\s\\S]*?一句话主命题：([^\\n]+)[\\s\\S]*?解读内容：([\\s\\S]*?)关键提醒：([^\\n]+)`,
        'i'
      );
      
      const match = text.match(areaPattern);
      if (match) {
        areas.push({
          areaName: areaName,
          hookSentece: match[1].trim(),
          content: match[2].trim(),
          summaryHighlight: match[3].trim()
        });
      } else {
        // 尝试更宽松的匹配
        const loosePattern = new RegExp(
          `【${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】[\\s\\S]*?一句话主命题[：:]([^\\n]+)[\\s\\S]*?解读内容[：:]([\\s\\S]*?)(?:关键提醒[：:]|$)`,
          'i'
        );
        const looseMatch = text.match(loosePattern);
        if (looseMatch) {
          const highlightMatch = text.match(new RegExp(`【${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】[\\s\\S]*?关键提醒[：:]([^\\n]+)`, 'i'));
          areas.push({
            areaName: areaName,
            hookSentece: looseMatch[1].trim(),
            content: looseMatch[2].trim(),
            summaryHighlight: highlightMatch ? highlightMatch[1].trim() : '（未找到）'
          });
        } else {
          areas.push({
            areaName: areaName,
            hookSentece: '（未找到）',
            content: '（未找到）',
            summaryHighlight: '（未找到）'
          });
        }
      }
    }
    
    return { monthSummary, areas };
  };

  // 调用API
  const callAPI = async (monthSummary: string, areas: any[]) => {
    const response = await fetch('/api/annual-fortune-good-luck-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        monthSummary,
        areas
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'API返回错误');
    }

    return data.result.goodLuckItem;
  };

  // 开始处理
  const handleStart = async () => {
    if (files.length === 0) {
      alert('请先选择文件');
      return;
    }

    setProcessing(true);
    setResults(null);
    setProgress({ current: 0, total: files.length });

    const fileResults: any[] = [];
    const itemCounts: Record<string, number> = {};
    let successCount = 0;
    let failCount = 0;

    // 初始化统计
    GOOD_LUCK_ITEMS.forEach(item => {
      itemCounts[item] = 0;
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      setProgress({ current: i + 1, total: files.length });

      try {
        // 解析文件
        const parsed = await parseFile(file);
        
        if (!parsed || !parsed.monthSummary || parsed.areas.length === 0) {
          fileResults.push({
            file: file.name,
            status: 'failed',
            error: '无法解析文件内容'
          });
          failCount++;
          continue;
        }
        
        // 调用API
        const item = await callAPI(parsed.monthSummary, parsed.areas);
        
        // 统计
        if (GOOD_LUCK_ITEMS.includes(item)) {
          itemCounts[item]++;
        } else {
          if (!itemCounts[item]) {
            itemCounts[item] = 0;
          }
          itemCounts[item]++;
        }
        
        successCount++;
        fileResults.push({
          file: file.name,
          status: 'success',
          item: item
        });
        
        // 延迟
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        failCount++;
        fileResults.push({
          file: file.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    // 计算概率分布
    const distribution: Record<string, { count: number; probability: number }> = {};
    GOOD_LUCK_ITEMS.forEach(item => {
      const count = itemCounts[item] || 0;
      const probability = successCount > 0 ? (count / successCount * 100) : 0;
      distribution[item] = {
        count,
        probability: parseFloat(probability.toFixed(2))
      };
    });

    // 处理列表外的物品
    Object.keys(itemCounts).forEach(item => {
      if (!GOOD_LUCK_ITEMS.includes(item)) {
        const count = itemCounts[item] || 0;
        const probability = successCount > 0 ? (count / successCount * 100) : 0;
        distribution[item] = {
          count,
          probability: parseFloat(probability.toFixed(2))
        };
      }
    });

    setResults({
      totalFiles: files.length,
      successCount,
      failCount,
      distribution,
      fileResults
    });

    setProcessing(false);
    setCurrentFile('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // 处理拖拽文件
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (processing) return;

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith('.txt')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">批量测试年运幸运物匹配</h1>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">选择文件（可多选）</label>
          
          {/* 拖拽区域 */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${processing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ minHeight: '200px' }}
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 flex-shrink-0"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-blue-600 hover:text-blue-500">
                  点击上传
                </span>
                {' 或拖拽文件到此处'}
              </div>
              <p className="text-xs text-gray-500">支持 .txt 文件，可多选</p>
            </div>
            <input
              type="file"
              multiple
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-input"
              disabled={processing}
            />
            <label
              htmlFor="file-input"
              className="mt-2 inline-block cursor-pointer"
            >
              <span className="text-sm text-blue-600 hover:text-blue-500">
                浏览文件
              </span>
            </label>
          </div>

          {/* 已选择的文件列表 */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">已选择 {files.length} 个文件</p>
                <button
                  onClick={clearFiles}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={processing}
                >
                  清空
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
                  >
                    <span className="flex-1 truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-600 hover:text-red-700"
                      disabled={processing}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">模型选择</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'openai' | 'deepseek')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={processing}
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <button
          onClick={handleStart}
          disabled={processing || files.length === 0}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {processing ? '处理中...' : '开始处理'}
        </button>
      </div>

      {processing && (
        <div className="mb-6 p-4 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            正在处理: {currentFile || '准备中...'} ({progress.current}/{progress.total})
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-semibold mb-2">统计结果</h2>
            <p>总文件数: {results.totalFiles}</p>
            <p>成功: {results.successCount}</p>
            <p>失败: {results.failCount}</p>
            <p>成功率: {((results.successCount / results.totalFiles) * 100).toFixed(2)}%</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-semibold mb-4">幸运物概率分布</h2>
            <div className="space-y-2">
              {Object.entries(results.distribution)
                .sort((a, b) => b[1].probability - a[1].probability)
                .map(([item, stats]) => (
                  <div key={item} className="flex items-center gap-4">
                    <span className="w-24 text-sm">{item}</span>
                    <span className="w-16 text-sm text-right">{stats.count}次</span>
                    <span className="w-20 text-sm text-right">{stats.probability.toFixed(2)}%</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{ width: `${stats.probability}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-semibold mb-4">详细结果</h2>
            <div className="space-y-1 text-sm max-h-96 overflow-y-auto">
              {results.fileResults.map((result: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-8 text-gray-500">{index + 1}.</span>
                  <span className="flex-1 truncate">{result.file}</span>
                  {result.status === 'success' ? (
                    <span className="text-green-600">→ {result.item}</span>
                  ) : (
                    <span className="text-red-600">✗ {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

