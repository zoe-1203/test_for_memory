const fs = require('fs');
const path = require('path');

// 读取所有 prompt 文件
const promptDir = path.join(__dirname, '../data/extracted_memories');
const files = fs.readdirSync(promptDir)
  .filter(file => file.endsWith('_prompt.txt'))
  .sort();

const allQuestions = [];

// 提取所有用户提问
files.forEach(file => {
  const filePath = path.join(promptDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 匹配 "用户问：" 或 "用户说：" 后面的内容
  const questionPattern = /用户(?:问|说)："([^"]+)"/g;
  let match;
  
  while ((match = questionPattern.exec(content)) !== null) {
    const question = match[1].trim();
    if (question) {
      allQuestions.push(question);
    }
  }
});

console.log(`总共提取到 ${allQuestions.length} 条用户提问`);

// 分成 5 个文件，每个 20 条
const questionsPerFile = 20;
const outputDir = path.join(__dirname, '../data/user_questions_export');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (let i = 0; i < 5; i++) {
  const startIdx = i * questionsPerFile;
  const endIdx = Math.min(startIdx + questionsPerFile, allQuestions.length);
  const questions = allQuestions.slice(startIdx, endIdx);
  
  if (questions.length === 0) break;
  
  const outputPath = path.join(outputDir, `user_questions_batch_${i + 1}.txt`);
  const content = questions.map((q, idx) => `${startIdx + idx + 1}. ${q}`).join('\n\n');
  
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`已生成: ${outputPath} (${questions.length} 条)`);
}

console.log(`\n完成！所有文件已保存到: ${outputDir}`);

