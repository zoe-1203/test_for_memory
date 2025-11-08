import { MEMORY_AREAS, type MemoryItem } from "./types";

/**
 * 格式化 Memory 为字符串（用于 tools 中展示）
 */
function formatMemoryForTools(memory: MemoryItem): string {
  const date = new Date(memory.date);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const areaInfo = MEMORY_AREAS[memory.area];
  const relatedPeople = memory.relatedPeople || [];
  const peopleText = relatedPeople.length > 0 ? `（涉及：${relatedPeople.join('、')}）` : '';
  return `${year}年${month}月${day}日 ${areaInfo.emoji} ${areaInfo.name}${peopleText}：${memory.content}`;
}

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "select_relevant_area",
      description:
        "本工具用于根据用户的问题和额外信息，从10个预定义的领域（area）中选择最相关的1~3个领域。这是第一步，调用本工具后，再调用 get_memories_by_area 获取该领域下的记忆。",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "用户的问题" },
          additionalInfo: { type: "string", description: "用户输入的附加信息" },
          availableAreas: {
            type: "array",
            description: "可用的领域列表",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "领域ID" },
                name: { type: "string", description: "领域名称" },
                description: { type: "string", description: "领域描述" }
              }
            }
          },
          areaIds: { 
            type: "array",
            description: "选中的领域ID列表（必须从 availableAreas 中选择1~3个 id 值）",
            items: {
              type: "string",
              enum: ["love_and_relationships", "family_and_home", "work_and_career", "self_growth", "health_and_wellbeing", "life_events", "finance_and_security", "goals_and_motivation", "social_and_friendship", "spirituality_and_meaning"]
            },
            minItems: 1,
            maxItems: 3
          }
        },
        required: ["question", "availableAreas", "areaIds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_memories_by_area",
      description:
        "从指定领域（Area）下的记忆列表中，基于用户问题、额外信息，挑选最相关的若干条记忆（返回索引列表，从0开始）。",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "用户的问题" },
          additionalInfo: { type: "string", description: "用户输入的附加信息" },
          areaId: { type: "string", description: "选中的领域ID" },
          memories: {
            type: "array",
            description: "该领域下的候选 memory 列表（格式：几年几月几日....（内容）），这是一个字符串数组，每个元素代表一条记忆",
            items: { type: "string" }
          },
          limit: { type: "integer", description: "最多返回的条数（返回的是索引列表，从0开始）", default: 3 }
        },
        required: ["question", "areaId", "memories"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_latest_memory",
      description:
        "从传入的 memory 列表中，按时间新旧（存入日期）选出最近的若干条（返回 id 列表）。",
      parameters: {
        type: "object",
        properties: {
          memories: {
            type: "array",
            description: "候选 memory 列表（格式：几年几月几日....（内容））",
            items: { type: "string" }
          },
          limit: { type: "integer", description: "最多返回的条数", default: 2 }
        },
        required: ["memories"]
      }
    }
  }
] as const;

/**
 * 将 Memory 列表格式化为 tools 中需要的格式
 */
export function formatMemoriesForTools(memories: MemoryItem[]): string[] {
  return memories.map(formatMemoryForTools);
}

/**
 * 根据 areaId 过滤 Memory
 */
export function filterMemoriesByArea(memories: MemoryItem[], areaId: string): MemoryItem[] {
  return memories.filter(m => m.area === areaId);
}
