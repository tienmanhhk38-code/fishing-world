export interface QuestDefinition {
  id: string;
  kind: "intro" | "daily";
  title: string;
  goal: number;
  metric: "moveJump" | "caught" | "fresh" | "sold" | "bamboo";
  coins: number;
  xp: number;
  worms?: number;
}
export interface QuestState extends QuestDefinition {
  progress: number;
  claimed: boolean;
  available: boolean;
  period: string;
}
export const QUESTS: QuestDefinition[] = [
  {
    id: "intro-move",
    kind: "intro",
    title: "Di chuyển và nhảy một lần",
    goal: 1,
    metric: "moveJump",
    coins: 30,
    xp: 10,
  },
  {
    id: "intro-catch",
    kind: "intro",
    title: "Bắt 3 cá",
    goal: 3,
    metric: "caught",
    coins: 60,
    xp: 25,
  },
  {
    id: "intro-pond",
    kind: "intro",
    title: "Bắt một cá nước ngọt",
    goal: 1,
    metric: "fresh",
    coins: 80,
    xp: 35,
    worms: 3,
  },
  {
    id: "intro-sell",
    kind: "intro",
    title: "Bán cá được 100 Xu",
    goal: 100,
    metric: "sold",
    coins: 80,
    xp: 35,
  },
  {
    id: "intro-rod",
    kind: "intro",
    title: "Sở hữu và trang bị cần tre",
    goal: 1,
    metric: "bamboo",
    coins: 100,
    xp: 50,
  },
  {
    id: "daily-catch",
    kind: "daily",
    title: "Bắt 6 cá",
    goal: 6,
    metric: "caught",
    coins: 60,
    xp: 25,
  },
  {
    id: "daily-pond",
    kind: "daily",
    title: "Bắt 2 cá nước ngọt",
    goal: 2,
    metric: "fresh",
    coins: 50,
    xp: 20,
    worms: 3,
  },
  {
    id: "daily-sell",
    kind: "daily",
    title: "Bán cá được 150 Xu",
    goal: 150,
    metric: "sold",
    coins: 80,
    xp: 25,
  },
];
export function questDay(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function questResetAt(now = new Date()) {
  const day = questDay(now);
  return new Date(Date.parse(day + "T00:00:00+07:00") + 86400000).toISOString();
}
