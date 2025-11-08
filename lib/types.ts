/**
 * Memory 领域（Area）定义
 */
export const MEMORY_AREAS = {
  love_and_relationships: {
    id: 'love_and_relationships',
    emoji: '❤️',
    name: '爱情关系',
    description: '含恋爱、暧昧、情感表达、分手复合等'
  },
  family_and_home: {
    id: 'family_and_home',
    emoji: '🏡',
    name: '家庭关系',
    description: '含父母、伴侣、孩子、原生家庭冲突等'
  },
  work_and_career: {
    id: 'work_and_career',
    emoji: '💼',
    name: '工作与事业',
    description: '含工作压力、职场关系、自我价值感等'
  },
  self_growth: {
    id: 'self_growth',
    emoji: '🌱',
    name: '个人成长',
    description: '含自我觉察、疗愈、情绪调节、自信、自律等'
  },
  health_and_wellbeing: {
    id: 'health_and_wellbeing',
    emoji: '🧘‍♀️',
    name: '健康与身心状态',
    description: '含焦虑、睡眠、情绪稳定性、身体状态等'
  },
  life_events: {
    id: 'life_events',
    emoji: '🧩',
    name: '生活事件 / 环境变化',
    description: '含搬家、求学、旅行、迁移、重要决定等'
  },
  finance_and_security: {
    id: 'finance_and_security',
    emoji: '💰',
    name: '金钱与物质',
    description: '含经济压力、安全感、消费观、独立性等'
  },
  goals_and_motivation: {
    id: 'goals_and_motivation',
    emoji: '🎯',
    name: '目标与动机',
    description: '含人生方向、计划、理想、自我驱动等'
  },
  social_and_friendship: {
    id: 'social_and_friendship',
    emoji: '🫶',
    name: '人际关系（非爱情）',
    description: '含朋友、同事、社交焦虑、人际边界等'
  },
  spirituality_and_meaning: {
    id: 'spirituality_and_meaning',
    emoji: '🔮',
    name: '精神探索 / 意义感',
    description: '含信仰、意义感、塔罗、冥想、自我连接等'
  }
} as const;

export type MemoryAreaId = keyof typeof MEMORY_AREAS;

/**
 * Memory 数据结构
 */
export type MemoryItem = {
  id: string;
  date: string; // 存入日期，格式：YYYY-MM-DD
  area: MemoryAreaId; // 所属领域
  relatedPeople: string[]; // 和这个 memory 有关系的人物
  content: string; // 存入的具体内容
};

