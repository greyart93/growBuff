import { db } from "@/lib/db";

export function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getWeekSummary(tenantId: string) {
  const database = db(tenantId);
  const since = weekStart();
  const [metrics, leads, bookings, messages, reviews, campaigns, previousMetrics] = await Promise.all([
    database.gbpMetricSnapshot.findMany({ where: { date: { gte: since } } }),
    database.lead.count({ where: { createdAt: { gte: since } } }),
    database.booking.count({ where: { createdAt: { gte: since } } }),
    database.message.count({ where: { createdAt: { gte: since }, direction: "out", role: "ai" } }),
    database.gbpReview.count({ where: { reviewedAt: { gte: since } } }),
    database.campaign.findMany({ where: { sentAt: { gte: since } }, select: { stats: true } }),
    database.gbpMetricSnapshot.findMany({
      where: {
        date: {
          gte: new Date(since.getTime() - 7 * 86400_000),
          lt: since,
        },
      },
    }),
  ]);

  const sum = (rows: Array<{ calls: number; directions: number; websiteClicks: number; searchViews: number; mapViews: number }>, key: keyof (typeof rows)[number]) =>
    rows.reduce((total, row) => total + row[key], 0);

  const responses = campaigns.reduce((total, campaign) => {
    const stats = campaign.stats as { replied?: number };
    return total + (stats?.replied ?? 0);
  }, 0);

  return {
    calls: sum(metrics, "calls"),
    directions: sum(metrics, "directions"),
    websiteClicks: sum(metrics, "websiteClicks"),
    searchViews: sum(metrics, "searchViews"),
    mapViews: sum(metrics, "mapViews"),
    callsPrev: sum(previousMetrics, "calls"),
    leads,
    bookings,
    aiMessages: messages,
    reviews,
    responses,
  };
}

export async function getTasks(tenantId: string) {
  const database = db(tenantId);
  const [pendingPosts, pendingCampaigns, negativeReviews, hotLeads, handoffs] = await Promise.all([
    database.gbpPost.findMany({ where: { status: "pending_approval" }, orderBy: { createdAt: "desc" }, take: 3 }),
    database.campaign.findMany({ where: { status: "pending_approval" }, orderBy: { createdAt: "desc" }, take: 3 }),
    database.gbpReview.findMany({ where: { status: "needs_approval" }, orderBy: { reviewedAt: "desc" }, take: 3 }),
    database.lead.findMany({ where: { score: { gte: 60 }, status: "new" }, orderBy: { score: "desc" }, take: 3 }),
    database.conversation.findMany({ where: { aiPaused: true, status: "open" }, take: 3 }),
  ]);

  return [
    ...pendingPosts.map((post) => ({
      id: post.id,
      kind: "post" as const,
      title: "Approve Google post",
      detail: post.title,
      href: "/gbp",
    })),
    ...pendingCampaigns.map((campaign) => ({
      id: campaign.id,
      kind: "campaign" as const,
      title: "Approve campaign",
      detail: campaign.name,
      href: `/campaigns/${campaign.id}`,
    })),
    ...negativeReviews.map((review) => ({
      id: review.id,
      kind: "review" as const,
      title: `Reply to ${review.rating}★ review`,
      detail: `${review.author}: ${review.text.slice(0, 70)}`,
      href: "/gbp",
    })),
    ...hotLeads.map((lead) => ({
      id: lead.id,
      kind: "lead" as const,
      title: "Hot lead waiting",
      detail: `${lead.name ?? lead.phone ?? "Customer"} · ${lead.intent}`,
      href: "/inbox",
    })),
    ...handoffs.map((conversation) => ({
      id: conversation.id,
      kind: "handoff" as const,
      title: "Chat needs you",
      detail: conversation.handoffReason ?? "Customer asked for a human",
      href: `/inbox/${conversation.id}`,
    })),
  ];
}
