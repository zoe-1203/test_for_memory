// Test script for cleanFacts function

function cleanFacts(facts) {
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

// Test case 1: 包含未提及的用户自身内容
const testInput1 = `## 用户涉及某个具体人物的内容
用户想知道是否还可以继续偶遇每天和"她"联系。

## 用户自身内容
未提及与具体人物无关的自身情况，此部分为空。`;

console.log("Test 1: 包含未提及的用户自身内容");
console.log("Input:");
console.log(testInput1);
console.log("\nOutput:");
const result1 = cleanFacts(testInput1);
console.log(result1);
console.log("\n" + "=".repeat(50) + "\n");

// Test case 2: 两个段落都有内容
const testInput2 = `## 用户涉及某个具体人物的内容
用户想知道是否还可以继续偶遇每天和"她"联系。用户还询问，看到有趣的东西是否还可以给"她"分享。

## 用户自身内容
用户目前感到很困惑，不知道该如何处理与她的关系。`;

console.log("Test 2: 两个段落都有内容");
console.log("Input:");
console.log(testInput2);
console.log("\nOutput:");
const result2 = cleanFacts(testInput2);
console.log(result2);
console.log("\n" + "=".repeat(50) + "\n");

// Test case 3: 用户涉及具体人物的内容包含"未提及"（应该保留）
const testInput3 = `## 用户涉及某个具体人物的内容
未提及具体人物相关内容。

## 用户自身内容
用户正在考虑换工作。`;

console.log("Test 3: 用户涉及具体人物的内容包含未提及（应该保留）");
console.log("Input:");
console.log(testInput3);
console.log("\nOutput:");
const result3 = cleanFacts(testInput3);
console.log(result3);
console.log("\n" + "=".repeat(50) + "\n");

// Test case 4: 只有用户自身内容，且为空
const testInput4 = `## 用户自身内容
未提及与具体人物无关的自身情况，此部分为空。`;

console.log("Test 4: 只有用户自身内容且为空");
console.log("Input:");
console.log(testInput4);
console.log("\nOutput:");
const result4 = cleanFacts(testInput4);
console.log(result4 || "(empty string)");
console.log("\n" + "=".repeat(50) + "\n");

// Test case 5: 包含 "# facts" 标题行（真实的 Stage1 输出格式）
const testInput5 = `# facts
## 用户涉及某个具体人物的内容
用户想知道是否还可以继续偶遇每天和"她"联系。

## 用户自身内容
未提及与具体人物无关的自身情况，此部分为空。`;

console.log("Test 5: 包含 # facts 标题行");
console.log("Input:");
console.log(testInput5);
console.log("\nOutput:");
const result5 = cleanFacts(testInput5);
console.log(result5);
console.log("\n" + "=".repeat(50) + "\n");

// Test case 6: 完整的 Stage1 输出格式（包含多个标题）
const testInput6 = `# facts
## 用户涉及某个具体人物的内容
用户询问关于某人的事情。

## 用户自身内容
用户正在寻找新的工作机会。

# topic area
感情

# topic summary
关于感情问题的咨询`;

console.log("Test 6: 完整的 Stage1 输出（只提取 facts 部分）");
console.log("Input:");
console.log(testInput6);
console.log("\nOutput:");
const result6 = cleanFacts(testInput6);
console.log(result6);
console.log("\n" + "=".repeat(50) + "\n");
