import { db, unscoped } from "@/lib/db";

export type UsageType = "ai_message" | "gbp_post" | "campaign_message" | "assistant_message";

export type AgentKey = "gbp" | "chat" | "marketing";

export const PLANS: Array<{
  id: string;
  agent: AgentKey;
  name: string;
  pricePaise: number;
  tagline: string;
  limits: Record<string, number>;
  features: string[];
}> = [
  {
    id: "gbp-growth",
    agent: "gbp",
    name: "Google Presence",
    pricePaise: 99900,
    tagline: "Get found and get reviewed",
    limits: { gbp_post: 60 },
    features: ["Profile audit", "Local SEO & Maps", "AI posts (2/day)", "Review replies & requests", "Call & direction analytics"],
  },
  {
    id: "chat-pro",
    agent: "chat",
    name: "WhatsApp Chat Agent",
    pricePaise: 149900,
    tagline: "Never miss an enquiry",
    limits: { ai_message: 2000 },
    features: ["24×7 grounded replies", "Bookings & reminders", "Lead scoring", "Shared inbox + handoff"],
  },
  {
    id: "marketing-pro",
    agent: "marketing",
    name: "WhatsApp Marketing",
    pricePaise: 129900,
    tagline: "Bring customers back",
    limits: { campaign_message: 4000 },
    features: ["Segments & imports", "AI campaign builder", "Template approvals", "Automations & analytics"],
  },
];

export const AGENT_LIMIT_TYPE: Record<AgentKey, UsageType> = {
  gbp: "gbp_post",
  chat: "ai_message",
  marketing: "campaign_message",
};

export function planForAgent(agent: AgentKey) {
  return PLANS.find((p) => p.agent === agent)!;
}

export async function usageThisMonth(tenantId: string, type: UsageType) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const result = await db(tenantId).usageEvent.aggregate({
    where: { type, createdAt: { gte: start } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/** Returns the limit for the tenant's active plan; null means no active subscription. */
export async function limitFor(tenantId: string, type: UsageType) {
  const agent = (Object.keys(AGENT_LIMIT_TYPE) as AgentKey[]).find(
    (key) => AGENT_LIMIT_TYPE[key] === type
  );
  if (!agent) return null;
  const sub = await unscoped.subscription.findFirst({ where: { tenantId, agent, status: "active" } });
  if (!sub) return 0;
  const limit = planForAgent(agent).limits[type];
  return limit ?? 0;
}

export async function checkUsage(tenantId: string, type: UsageType, quantity = 1) {
  const limit = await limitFor(tenantId, type);
  if (limit === null) return { allowed: true, used: 0, limit: null };
  if (limit === 0) return { allowed: false, used: 0, limit, reason: "no_plan" as const };
  const used = await usageThisMonth(tenantId, type);
  return {
    allowed: used + quantity <= limit,
    used,
    limit,
    reason: used + quantity <= limit ? undefined : ("limit_reached" as const),
  };
}

export async function recordUsage(
  tenantId: string,
  type: UsageType,
  quantity = 1,
  meta: Record<string, unknown> = {}
) {
  await db(tenantId).usageEvent.create({ data: { tenantId, type, quantity, meta: meta as object } });
}
