import { type MemoryItem, type MemoryAreaId } from "@/lib/types";

/**
 * 示例 Memory 数据（30条）
 */
export const sampleMemories: MemoryItem[] = [
  {
    id: "1",
    date: "2025-08-01",
    area: "love_and_relationships" as MemoryAreaId,
    relatedPeople: ["小明"],
    content: "我们在争执后通常 2~3 天才恢复沟通，他比较被动，需要我先主动"
  },
  {
    id: "2",
    date: "2025-08-05",
    area: "love_and_relationships" as MemoryAreaId,
    relatedPeople: ["小明"],
    content: "他最近工作压力很大，经常加班到很晚，我们见面的时间变少了"
  },
  {
    id: "3",
    date: "2025-08-10",
    area: "work_and_career" as MemoryAreaId,
    relatedPeople: ["老板", "同事"],
    content: "最近项目进度很紧张，感觉压力很大，经常失眠"
  },
  {
    id: "4",
    date: "2025-08-15",
    area: "self_growth" as MemoryAreaId,
    relatedPeople: [],
    content: "开始学习冥想，每天坚持 10 分钟，感觉情绪更稳定了"
  },
  {
    id: "5",
    date: "2025-08-20",
    area: "family_and_home" as MemoryAreaId,
    relatedPeople: ["妈妈"],
    content: "和妈妈因为工作选择的问题发生了争执，她希望我回老家工作"
  },
  {
    id: "6",
    date: "2025-09-01",
    area: "health_and_wellbeing" as MemoryAreaId,
    relatedPeople: [],
    content: "最近睡眠质量不好，经常凌晨 2-3 点才睡着，白天很疲惫"
  },
  {
    id: "7",
    date: "2025-09-05",
    area: "love_and_relationships" as MemoryAreaId,
    relatedPeople: ["小明"],
    content: "一起吃了晚餐，他送了我一束花，感觉关系有回暖的迹象"
  },
  {
    id: "8",
    date: "2025-09-10",
    area: "social_and_friendship" as MemoryAreaId,
    relatedPeople: ["小红", "小绿"],
    content: "和朋友们聚会，聊了很多关于工作和感情的话题，感觉被理解了"
  },
  {
    id: "9",
    date: "2025-09-15",
    area: "finance_and_security" as MemoryAreaId,
    relatedPeople: [],
    content: "开始记账，发现每个月开销比想象中大，需要控制一下消费"
  },
  {
    id: "10",
    date: "2025-09-20",
    area: "goals_and_motivation" as MemoryAreaId,
    relatedPeople: [],
    content: "制定了今年的学习计划，想要提升专业技能，但感觉时间不够用"
  },
  {
    id: "11",
    date: "2025-10-01",
    area: "spirituality_and_meaning" as MemoryAreaId,
    relatedPeople: [],
    content: "开始接触塔罗牌，觉得很有意思，想要深入学习"
  },
  {
    id: "12",
    date: "2025-10-05",
    area: "life_events" as MemoryAreaId,
    relatedPeople: [],
    content: "考虑要不要换工作，现在的公司虽然稳定但发展空间有限"
  },
  {
    id: "13",
    date: "2025-10-10",
    area: "love_and_relationships" as MemoryAreaId,
    relatedPeople: ["小明"],
    content: "他主动约我周末一起看电影，感觉他在努力改善我们的关系"
  },
  {
    id: "14",
    date: "2025-10-15",
    area: "work_and_career" as MemoryAreaId,
    relatedPeople: ["同事小李"],
    content: "和同事小李因为工作分配的问题产生了矛盾，需要沟通解决"
  },
  {
    id: "15",
    date: "2025-10-20",
    area: "self_growth" as MemoryAreaId,
    relatedPeople: [],
    content: "读了一本关于情绪管理的书，学到了很多有用的方法"
  },
  {
    id: "16",
    date: "2025-11-01",
    area: "family_and_home" as MemoryAreaId,
    relatedPeople: ["爸爸"],
    content: "和爸爸通了电话，他支持我的决定，让我感觉很温暖"
  },
  {
    id: "17",
    date: "2025-11-05",
    area: "health_and_wellbeing" as MemoryAreaId,
    relatedPeople: [],
    content: "开始规律运动，每周至少 3 次，感觉身体状态好多了"
  },
  {
    id: "18",
    date: "2025-11-10",
    area: "social_and_friendship" as MemoryAreaId,
    relatedPeople: ["小黄"],
    content: "和小黄聊了关于未来规划的话题，她给了我很多建议"
  },
  {
    id: "19",
    date: "2025-11-15",
    area: "finance_and_security" as MemoryAreaId,
    relatedPeople: [],
    content: "开始存钱，每个月固定存一部分，想要为未来做准备"
  },
  {
    id: "20",
    date: "2025-11-20",
    area: "spirituality_and_meaning" as MemoryAreaId,
    relatedPeople: [],
    content: "参加了塔罗牌学习小组，认识了很多志同道合的朋友"
  },
  {
    id: "21",
    date: "2025-11-25",
    area: "love_and_relationships" as MemoryAreaId,
    relatedPeople: ["小明"],
    content: "我们决定一起去看心理医生，想要改善沟通方式，让关系更健康"
  },
  {
    id: "22",
    date: "2025-11-28",
    area: "work_and_career" as MemoryAreaId,
    relatedPeople: ["主管"],
    content: "收到了一个不错的工作机会，薪资和前景都比现在好，正在考虑中"
  },
  {
    id: "23",
    date: "2025-12-01",
    area: "family_and_home" as MemoryAreaId,
    relatedPeople: ["妈妈", "爸爸"],
    content: "和父母视频通话，他们终于理解了我的选择，不再强迫我回老家"
  },
  {
    id: "24",
    date: "2025-12-05",
    area: "self_growth" as MemoryAreaId,
    relatedPeople: [],
    content: "开始写日记记录每天的情绪变化，发现自己在压力大的时候容易焦虑"
  },
  {
    id: "25",
    date: "2025-12-08",
    area: "health_and_wellbeing" as MemoryAreaId,
    relatedPeople: [],
    content: "最近工作压力导致胃痛，医生建议我调整作息和饮食习惯"
  },
  {
    id: "26",
    date: "2025-12-10",
    area: "life_events" as MemoryAreaId,
    relatedPeople: [],
    content: "决定接受新工作的offer，下个月就要搬家到新城市，既兴奋又紧张"
  },
  {
    id: "27",
    date: "2025-12-12",
    area: "finance_and_security" as MemoryAreaId,
    relatedPeople: [],
    content: "新工作的薪资更高，但需要重新租房，算了一下收支，还是能存下钱的"
  },
  {
    id: "28",
    date: "2025-12-15",
    area: "goals_and_motivation" as MemoryAreaId,
    relatedPeople: [],
    content: "制定了明年的三个主要目标：提升专业技能、改善亲密关系、保持身心健康"
  },
  {
    id: "29",
    date: "2025-12-18",
    area: "social_and_friendship" as MemoryAreaId,
    relatedPeople: ["小红", "小绿", "小黄"],
    content: "朋友们为我举办了送别聚会，很感动，约定以后要经常保持联系"
  },
  {
    id: "30",
    date: "2025-12-20",
    area: "spirituality_and_meaning" as MemoryAreaId,
    relatedPeople: [],
    content: "通过塔罗牌和冥想，我越来越清楚自己想要什么，内心变得更平静了"
  }
];

