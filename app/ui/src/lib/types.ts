export type Role = "user" | "agent" | "system";

export type ChatMessageBase = {
  id: string;
  role: Role;
  partial?: boolean;
  interrupted?: boolean;
  ts: number;
};

export type TextMessage = ChatMessageBase & {
  kind: "text";
  text: string;
};

export type ImageMessage = ChatMessageBase & {
  kind: "image";
  url: string;
  caption?: string;
  focusPart?: string;
};

export type ShopMessage = ChatMessageBase & {
  kind: "shop";
  topPick: ShopInfo;
  alternates: ShopInfo[];
};

export type BookingMessage = ChatMessageBase & {
  kind: "booking";
  shopName: string;
  time: string;
  etaMinutes: number;
  confirmationNumber: string;
};

export type GuideMessage = ChatMessageBase & {
  kind: "guide";
  title: string;
  url?: string;
  difficulty?: string;
  timeRequired?: string;
  summary?: string;
  stepsText?: string[];
  html?: string;
};

export type SystemMessage = ChatMessageBase & {
  kind: "system";
  text: string;
};

export type ChatMessage =
  | TextMessage
  | ImageMessage
  | ShopMessage
  | BookingMessage
  | GuideMessage
  | SystemMessage;

export type ShopInfo = {
  shop_id: string;
  name: string;
  distance_miles: number;
  eta_minutes: number;
  rating?: number;
  hours?: string;
  specialties?: string[];
};

export type ConsoleEntry = {
  id: string;
  ts: number;
  direction: "outgoing" | "incoming" | "error";
  emoji?: string;
  author?: string;
  summary: string;
  data?: unknown;
  isAudio?: boolean;
};

export type ConnectionState = "connecting" | "connected" | "disconnected";
