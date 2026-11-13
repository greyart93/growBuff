export type BusinessHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  { open: string; close: string; closed?: boolean }
>;

export type Service = { name: string; pricePaise: number; durationMin: number };

export type Faq = { q: string; a: string };

export type CampaignSegment = {
  tags?: string[];
  inactiveDays?: number;
  birthdayMonth?: boolean;
  source?: string;
  all?: boolean;
};

export type CampaignStats = {
  audience?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  failed?: number;
};

export type ConversationState = {
  pendingSlots?: string[];
  pendingService?: string;
  offeredAt?: string;
};

export const DEFAULT_HOURS: BusinessHours = {
  mon: { open: "10:00", close: "19:00" },
  tue: { open: "10:00", close: "19:00" },
  wed: { open: "10:00", close: "19:00" },
  thu: { open: "10:00", close: "19:00" },
  fri: { open: "10:00", close: "19:00" },
  sat: { open: "10:00", close: "16:00" },
  sun: { open: "10:00", close: "13:00", closed: true },
};

export function asHours(value: unknown): BusinessHours {
  if (!value || typeof value !== "object") return DEFAULT_HOURS;
  return { ...DEFAULT_HOURS, ...(value as BusinessHours) };
}

export function asServices(value: unknown): Service[] {
  return Array.isArray(value) ? (value as Service[]) : [];
}

export function asFaqs(value: unknown): Faq[] {
  return Array.isArray(value) ? (value as Faq[]) : [];
}
