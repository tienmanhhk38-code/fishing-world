export const APPEARANCES = {
  sailor: {
    name: "Thủy thủ",
    shirt: "#f4f8ff",
    shorts: "#315d92",
    hat: "#e9bd76",
    hair: "#523024",
    accent: "#35bbee",
  },
  sunny: {
    name: "Nắng hè",
    shirt: "#ffcf48",
    shorts: "#3269a2",
    hat: "#efd39a",
    hair: "#593021",
    accent: "#fff4c5",
  },
  coral: {
    name: "San hô",
    shirt: "#ff83b2",
    shorts: "#b24475",
    hat: "#fff1ea",
    hair: "#42292b",
    accent: "#ffcf65",
  },
  ocean: {
    name: "Biển ngọc",
    shirt: "#40d1bb",
    shorts: "#175b7b",
    hat: "#d9c18f",
    hair: "#283e49",
    accent: "#fff4d2",
  },
} as const;
export type AppearanceId = keyof typeof APPEARANCES;
export const EMOTES = {
  wave: { emoji: "👋", name: "Vẫy tay" },
  happy: { emoji: "😊", name: "Vui vẻ" },
  heart: { emoji: "❤️", name: "Thả tim" },
  clap: { emoji: "👏", name: "Vỗ tay" },
  cry: { emoji: "😭", name: "Khóc ròng" },
} as const;
export type EmoteId = keyof typeof EMOTES;
export const REPORT_REASONS = {
  spam: "Spam hoặc quảng cáo",
  abuse: "Xúc phạm hoặc quấy rối",
  other: "Lý do khác",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export interface ChatMessage {
  channel?: "world" | "nearby";
  playerId?: string;
  expiresAt?: number;
  id: string;
  senderId: string;
  name: string;
  appearanceId: AppearanceId | "system";
  text: string;
  createdAt: string;
}
export interface RoomMember {
  id: string;
  publicId: string;
  name: string;
  appearanceId: AppearanceId;
  level: number;
  connected: boolean;
}
export interface MutedPlayer {
  id: string;
  name: string;
}
export interface SocialState {
  members: RoomMember[];
  messages: ChatMessage[];
  muted: MutedPlayer[];
  chatMutedUntil: string | null;
}
export interface SocialAck {
  requestId: string;
  ok: boolean;
  message: string;
  retryable?: boolean;
}
export function cleanChat(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
export function validName(input: string) {
  const name = cleanChat(input);
  return Array.from(name).length >= 2 && Array.from(name).length <= 20
    ? name
    : null;
}
