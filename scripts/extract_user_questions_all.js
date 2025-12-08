const fs = require('fs');
const path = require('path');

// 所有可能包含 prompt 文件的目录
const searchDirs = [
  'data/extracted_memories',
  'data/extracted_memories 2',
  'data/extracted_memories 3',
  'data/extracted_memories_markdown',
  'data/extracted_memories_stage1_only'
];

const allQuestions = [];

// 递归查找所有 prompt 文件
function findPromptFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findPromptFiles(fullPath));
    } else if (item.endsWith('_prompt.txt')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 提取所有用户提问
const allPromptFiles = [];
for (const dir of searchDirs) {
  const dirPath = path.join(__dirname, '..', dir);
  allPromptFiles.push(...findPromptFiles(dirPath));
}

console.log(`找到 ${allPromptFiles.length} 个 prompt 文件`);

allPromptFiles.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 匹配 "用户问：" 或 "用户说：" 后面的内容
    const questionPattern = /用户(?:问|说)："([^"]+)"/g;
    let match;
    
    while ((match = questionPattern.exec(content)) !== null) {
      const question = match[1].trim();
      if (question && question.length > 0) {
        allQuestions.push(question);
      }
    }
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
  }
});

// 去重（保留第一次出现的）
const uniqueQuestions = [];
const seen = new Set();
for (const q of allQuestions) {
  if (!seen.has(q)) {
    seen.add(q);
    uniqueQuestions.push(q);
  }
}

console.log(`总共提取到 ${uniqueQuestions.length} 条用户提问（去重后）`);

// 分成 5 个文件，每个 20 条
const questionsPerFile = 20;
const outputDir = path.join(__dirname, '../data/user_questions_export');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 清空旧文件
const oldFiles = fs.readdirSync(outputDir).filter(f => f.startsWith('user_questions_batch_'));
oldFiles.forEach(f => fs.unlinkSync(path.join(outputDir, f)));

for (let i = 0; i < 5; i++) {
  const startIdx = i * questionsPerFile;
  const endIdx = Math.min(startIdx + questionsPerFile, uniqueQuestions.length);
  const questions = uniqueQuestions.slice(startIdx, endIdx);
  
  if (questions.length === 0) break;
  
  const outputPath = path.join(outputDir, `user_questions_batch_${i + 1}.txt`);
  const content = questions.map((q, idx) => `${startIdx + idx + 1}. ${q}`).join('\n\n');
  
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`已生成: ${path.basename(outputPath)} (${questions.length} 条)`);
}

console.log(`\n完成！所有文件已保存到: ${outputDir}`);

