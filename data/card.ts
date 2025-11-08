export type Card = {
  id: string;
  name: string;
  upright: string;
  reversed: string;
  keywords: string[];
};

export const CARDS: Card[] = [
  {
    id: "fool",
    name: "The Fool",
    upright: "新的开始、自由、信任直觉、跳入未知",
    reversed: "冲动、天真、犹豫、害怕迈出第一步",
    keywords: ["开始", "冒险", "纯真"],
  },
  {
    id: "magician",
    name: "The Magician",
    upright: "意志与资源对齐、把想法落地、专注与行动",
    reversed: "资源分散、意志不稳、技巧被误用",
    keywords: ["显化", "专注", "执行"],
  }
];
