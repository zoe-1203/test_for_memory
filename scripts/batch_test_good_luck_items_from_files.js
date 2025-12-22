/**
 * 批量测试年运幸运物匹配 - 从已有年运结果文件中提取数据
 * 
 * 运行方式：
 * 1. 确保开发服务器正在运行：npm run dev
 * 2. 运行脚本：node scripts/batch_test_good_luck_items_from_files.js [文件路径或目录] [provider]
 * 
 * 示例：
 *   node scripts/batch_test_good_luck_items_from_files.js "data/年运整个结果1.0" deepseek
 *   node scripts/batch_test_good_luck_items_from_files.js "/Users/zoe/Documents/work/AI 塔罗牌/年运测试/初中单身女.txt" deepseek
 */

const fs = require('fs');
const path = require('path');

// 11个幸运物列表
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

// 解析年运结果文件，提取需要的数据
function parseAnnualFortuneFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 提取12张牌概览（从每个月的"对应牌"字段）
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const overviewLines = [];

  for (let i = 0; i < 12; i++) {
    const monthName = monthNames[i];
    // 匹配格式：对应牌：XXX牌（逆位）或 对应牌:XXX牌(正位)
    const cardPattern = new RegExp(`【${monthName}】[\\s\\S]*?对应牌[：:]([^\\n（(]+)（([^\\n）)]+)）`, 'i');
    const match = content.match(cardPattern);
    if (match) {
      const cardName = match[1].trim();
      const position = match[2].trim();
      overviewLines.push(`${monthName}抽到了${position}的${cardName}。`);
    }
  }
  const overviewText = overviewLines.join('\n');

  if (!overviewText || overviewLines.length < 12) {
    console.warn(`⚠️  警告: ${filePath} 中未找到完整的12张牌信息（找到${overviewLines.length}个月）`);
    return null;
  }

  // 提取年运总结（从"全年总结："后提取）
  const summaryMatch = content.match(/全年总结[：:]\s*([\s\S]*?)(?=\n各月评分|$)/);
  const yearSummary = summaryMatch ? summaryMatch[1].trim() : null;

  if (!yearSummary) {
    console.warn(`⚠️  警告: ${filePath} 中未找到年运总结`);
    return null;
  }
  
  // 提取六大领域信息
  const areas = [];
  const areaNames = ['感情', '事业·学业', '财富', '健康', '人际关系', '内在成长'];
  
  for (const areaName of areaNames) {
    // 匹配格式：【领域名】...一句话主命题：...解读内容：...关键提醒：...
    const areaPattern = new RegExp(
      `【${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】[\\s\\S]*?一句话主命题：([^\\n]+)[\\s\\S]*?解读内容：([\\s\\S]*?)关键提醒：([^\\n]+)`,
      'i'
    );
    
    const match = content.match(areaPattern);
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
      const looseMatch = content.match(loosePattern);
      if (looseMatch) {
        const highlightMatch = content.match(new RegExp(`【${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】[\\s\\S]*?关键提醒[：:]([^\\n]+)`, 'i'));
        areas.push({
          areaName: areaName,
          hookSentece: looseMatch[1].trim(),
          content: looseMatch[2].trim(),
          summaryHighlight: highlightMatch ? highlightMatch[1].trim() : '（未找到）'
        });
      } else {
        console.warn(`⚠️  警告: ${filePath} 中未找到领域 "${areaName}" 的信息`);
        // 即使找不到，也添加一个占位符，保持6个领域
        areas.push({
          areaName: areaName,
          hookSentece: '（未找到）',
          content: '（未找到）',
          summaryHighlight: '（未找到）'
        });
      }
    }
  }
  
  if (areas.length !== 6) {
    console.warn(`⚠️  警告: ${filePath} 中只找到 ${areas.length} 个领域，期望6个`);
  }
  
  return {
    filePath,
    overviewText,
    yearSummary,
    areas
  };
}

// 调用API的函数
async function callGoodLuckItemsAPI(overviewText, yearSummary, areas, provider = 'deepseek') {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const url = `${baseURL}/api/annual-fortune-good-luck-items`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        overviewText,
        yearSummary,
        areas
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'API返回错误');
    }

    if (!data.result || !data.result.goodLuckItem) {
      throw new Error('API返回结果格式不正确，缺少 goodLuckItem 字段');
    }

    return data.result.goodLuckItem;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`无法连接到服务器 ${baseURL}，请确保开发服务器正在运行 (npm run dev)`);
    }
    throw error;
  }
}

// 获取所有年运结果文件
function getAllFortuneFiles(inputPath) {
  const files = [];
  
  if (fs.statSync(inputPath).isFile()) {
    // 单个文件
    if (inputPath.endsWith('.txt')) {
      files.push(inputPath);
    }
  } else {
    // 目录，递归查找所有 .txt 文件
    function findTxtFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findTxtFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.txt')) {
          files.push(fullPath);
        }
      }
    }
    findTxtFiles(inputPath);
  }
  
  return files;
}

// 主测试函数
async function runBatchTests(inputPath, provider = 'deepseek') {
  console.log(`\n开始批量测试，从路径: ${inputPath}`);
  console.log(`使用模型: ${provider}\n`);
  
  // 获取所有文件
  const files = getAllFortuneFiles(inputPath);
  console.log(`找到 ${files.length} 个文件\n`);
  
  if (files.length === 0) {
    console.error('错误: 未找到任何 .txt 文件');
    process.exit(1);
  }
  
  const results = {};
  const allItems = [];
  const fileResults = [];
  let successCount = 0;
  let failCount = 0;

  // 初始化统计
  GOOD_LUCK_ITEMS.forEach(item => {
    results[item] = 0;
  });

  // 处理每个文件
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);
    
    console.log(`[${i + 1}/${files.length}] 处理文件: ${fileName}`);
    
    try {
      // 解析文件
      const parsed = parseAnnualFortuneFile(filePath);

      if (!parsed || !parsed.overviewText || !parsed.yearSummary || parsed.areas.length === 0) {
        console.log(`  ✗ 跳过: 无法解析文件内容`);
        failCount++;
        fileResults.push({
          file: fileName,
          status: 'failed',
          error: '无法解析文件内容'
        });
        continue;
      }

      // 调用API
      console.log(`  → 调用API...`);
      const item = await callGoodLuckItemsAPI(parsed.overviewText, parsed.yearSummary, parsed.areas, provider);
      
      // 检查返回的幸运物是否在列表中
      if (GOOD_LUCK_ITEMS.includes(item)) {
        results[item]++;
        allItems.push(item);
        successCount++;
        console.log(`  ✓ 返回: ${item}`);
        fileResults.push({
          file: fileName,
          status: 'success',
          item: item
        });
      } else {
        // 如果返回了不在列表中的物品，也记录下来
        if (!results[item]) {
          results[item] = 0;
        }
        results[item]++;
        allItems.push(item);
        successCount++;
        console.log(`  ⚠ 返回了列表外的物品: ${item}`);
        fileResults.push({
          file: fileName,
          status: 'success',
          item: item,
          warning: '列表外的物品'
        });
      }
      
      // 避免请求过快，添加延迟
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failCount++;
      console.log(`  ✗ 失败: ${error.message}`);
      fileResults.push({
        file: fileName,
        status: 'failed',
        error: error.message
      });
    }
  }

  // 计算概率分布
  const distribution = {};
  GOOD_LUCK_ITEMS.forEach(item => {
    const count = results[item] || 0;
    const probability = successCount > 0 ? (count / successCount * 100).toFixed(2) : 0;
    distribution[item] = {
      count,
      probability: parseFloat(probability)
    };
  });

  // 处理列表外的物品
  Object.keys(results).forEach(item => {
    if (!GOOD_LUCK_ITEMS.includes(item)) {
      const count = results[item] || 0;
      const probability = successCount > 0 ? (count / successCount * 100).toFixed(2) : 0;
      distribution[item] = {
        count,
        probability: parseFloat(probability)
      };
    }
  });

  // 输出结果
  console.log(`\n${'='.repeat(60)}`);
  console.log('批量测试结果统计');
  console.log(`${'='.repeat(60)}`);
  console.log(`总文件数: ${files.length}`);
  console.log(`成功次数: ${successCount}`);
  console.log(`失败次数: ${failCount}`);
  console.log(`成功率: ${(successCount / files.length * 100).toFixed(2)}%`);
  console.log(`\n${'='.repeat(60)}`);
  console.log('幸运物概率分布:');
  console.log(`${'='.repeat(60)}`);
  
  // 按概率排序
  const sortedDistribution = Object.entries(distribution)
    .sort((a, b) => b[1].probability - a[1].probability);
  
  sortedDistribution.forEach(([item, stats]) => {
    const bar = '█'.repeat(Math.round(stats.probability / 2));
    console.log(`${item.padEnd(8)} | ${stats.count.toString().padStart(3)}次 | ${stats.probability.toString().padStart(6)}% | ${bar}`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('详细结果:');
  console.log(`${'='.repeat(60)}`);
  fileResults.forEach((result, index) => {
    if (result.status === 'success') {
      console.log(`${(index + 1).toString().padStart(3)}. ${result.file.padEnd(40)} → ${result.item}${result.warning ? ' ⚠' : ''}`);
    } else {
      console.log(`${(index + 1).toString().padStart(3)}. ${result.file.padEnd(40)} → ✗ ${result.error}`);
    }
  });

  // 保存结果到文件
  const resultFile = path.join(__dirname, `../data/good_luck_items_batch_result_${Date.now()}.json`);
  const resultData = {
    inputPath,
    totalFiles: files.length,
    successCount,
    failCount,
    provider,
    timestamp: new Date().toISOString(),
    distribution,
    allResults: allItems,
    fileResults
  };
  
  fs.writeFileSync(resultFile, JSON.stringify(resultData, null, 2), 'utf-8');
  console.log(`\n结果已保存到: ${resultFile}`);

  return resultData;
}

// 运行测试
if (require.main === module) {
  const inputPath = process.argv[2];
  const provider = process.argv[3] || 'deepseek';
  
  if (!inputPath) {
    console.error('错误: 请提供文件路径或目录路径');
    console.error('用法: node scripts/batch_test_good_luck_items_from_files.js <文件路径或目录> [provider]');
    console.error('示例: node scripts/batch_test_good_luck_items_from_files.js "data/年运整个结果1.0" deepseek');
    process.exit(1);
  }
  
  // 验证路径
  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 路径不存在: ${inputPath}`);
    process.exit(1);
  }
  
  // 验证provider参数
  if (provider !== 'openai' && provider !== 'deepseek') {
    console.error(`错误: provider 必须是 'openai' 或 'deepseek'，当前值: ${provider}`);
    process.exit(1);
  }
  
  console.log(`\n配置信息:`);
  console.log(`  输入路径: ${inputPath}`);
  console.log(`  模型: ${provider}`);
  console.log(`  API地址: ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}`);
  console.log(`\n提示: 请确保开发服务器正在运行 (npm run dev)\n`);
  
  // 等待2秒，给用户时间阅读提示
  setTimeout(() => {
    runBatchTests(inputPath, provider)
      .then(() => {
        console.log('\n批量测试完成！');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n批量测试过程中出现错误:', error.message);
        if (error.message.includes('ECONNREFUSED') || error.message.includes('无法连接')) {
          console.error('\n请确保:');
          console.error('  1. 开发服务器正在运行: npm run dev');
          console.error('  2. 服务器地址正确（默认: http://localhost:3000）');
        }
        process.exit(1);
      });
  }, 2000);
}

module.exports = { runBatchTests, parseAnnualFortuneFile, callGoodLuckItemsAPI };

