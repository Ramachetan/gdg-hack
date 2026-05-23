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

export type BoundingBox = {
  label: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

export type BoxesMessage = ChatMessageBase & {
  kind: "boxes";
  boxes: BoundingBox[];
  focusPart?: string;
  instruction?: string;
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
  | BoxesMessage
  | GuideMessage
  | SystemMessage;

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
