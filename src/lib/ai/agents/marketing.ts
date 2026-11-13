import { db } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { getPrompt } from "@/lib/ai/prompts";
import { logAgentRun } from "@/lib/audit";
import { getWhatsAppMode, submitTemplateForApproval, syncTemplateStatus } from "@/lib/adapters/whatsapp";
import { enqueue } from "@/lib/jobs/queue";
import type { CampaignSegment } from "@/lib/types";
import { daysAgo } from "@/lib/utils";

export type Occasion = {
  key: string;
  name: string;
  why: string;
  goal: string;
  segment: CampaignSegment;
};

const FESTIVALS: Record<number, { name: string; why: string }> = {
  0: { name: "Republic Day wishes", why: "National holiday, high WhatsApp open rates" },
  2: { name: "Holi colour-safety check-in", why: "Seasonal relevance for clinics and salons" },
  7: { name: "Independence Day offer", why: "Holiday footfall and family visits" },
  9: { name: "Diwali festive package", why: "Biggest local spending month of the year" },
  10: { name: "Diwali / New Year package", why: "Festive gifting and family bookings" },
  11: { name: "New Year wellness reset", why: "New-year intent peaks for health and beauty" },
};

export function suggestOccasions(business: { name: string }, now = new Date()): Occasion[] {
  const month = now.getMonth();
  const festival = FESTIVALS[month] ?? FESTIVALS[(month + 1) % 12];
  return [
    {
      key: "festival",
      name: festival.name,
      why: festival.why,
      goal: "festival",
      segment: { all: true },
    },
    {
      key: "win_back_60",
      name: "We miss you (60 days)",
      why: "Customers who haven't visited in 2 months respond best to a personal nudge",
      goal: "win_back",
      segment: { inactiveDays: 60 },
    },
    {
      key: "birthday",
      name: "Birthday month treat",
      why: "Birthday messages get 2–3× the reply rate of generic offers",
      goal: "birthday",
      segment: { birthdayMonth: true },
    },
    {
      key: "reactivation",
      name: "Quiet enquiry follow-up",
      why: "Leads who asked but never booked are your cheapest bookings",
      goal: "reactivation",
      segment: { tags: ["price-enquiry"] },
    },
  ];
}

export async function resolveAudience(tenantId: string, segment: CampaignSegment) {
  const database = db(tenantId);
  const where: Record<string, unknown> = { optIn: true };

  if (segment.tags?.length) where.tags = { hasSome: segment.tags };
  if (segment.inactiveDays) {
    where.OR = [{ lastSeenAt: { lte: daysAgo(segment.inactiveDays) } }, { lastSeenAt: null }];
  }
  const contacts = await database.contact.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });

  if (segment.birthdayMonth) {
    const month = new Date().getMonth();
    return contacts.filter((contact) => contact.birthday && contact.birthday.getMonth() === month);
  }
  return contacts;
}

function fallbackCopy(goal: string, businessName: string, serviceName: string | null, city: string) {
  const service = serviceName ?? "appointment";
  switch (goal) {
    case "birthday":
      return `Happy birthday, {{name}}! 🎉 The team at ${businessName} would love to treat you this month. Reply BOOK for a ${service.toLowerCase()} and we'll keep a slot for you. Reply STOP to unsubscribe.`;
    case "win_back":
    case "reactivation":
      return `Hi {{name}}, we've missed you at ${businessName}! It's been a while — reply BOOK and we'll find a ${service.toLowerCase()} time that suits you. Reply STOP to unsubscribe.`;
    case "festival":
      return `Hi {{name}}! Festive wishes from ${businessName} in ${city}. Book a ${service.toLowerCase()} this festive season — reply BOOK and we'll share open slots. Reply STOP to unsubscribe.`;
    default:
      return `Hi {{name}}, a quick note from ${businessName}. Reply BOOK to see open ${service.toLowerCase()} slots. Reply STOP to unsubscribe.`;
  }
}

export async function draftCampaign(input: {
  tenantId: string;
  goal?: string;
  name?: string;
  brief?: string;
  segment?: CampaignSegment;
}) {
  const database = db(input.tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");
  const services = Array.isArray(business.services) ? (business.services as Array<{ name: string }>) : [];
  const goal = input.goal ?? "win_back";
  const segment = input.segment ?? { all: true };
  const audience = await resolveAudience(input.tenantId, segment);

  const fallbackBody = fallbackCopy(goal, business.name, services[0]?.name ?? null, business.city);
  const prompt = getPrompt("marketing-agent");
  const generation = await generateJson<{
    name: string;
    body: string;
    templateCategory: string;
    suggestedImagePrompt: string;
  }>({
    system: prompt.campaignSystem,
    prompt: JSON.stringify({
      business: {
        name: business.name,
        category: business.category,
        city: business.city,
        tone: business.brandTone,
        services,
        language: business.languages[0] ?? "en",
      },
      goal,
      brief: input.brief ?? "",
      audienceSize: audience.length,
    }),
    fallback: {
      name: input.name ?? `${goal.replace("_", " ")} campaign`,
      body: fallbackBody,
      templateCategory: "MARKETING",
      suggestedImagePrompt: `Warm, friendly photo for ${business.name}, ${business.category} in ${business.city}`,
    },
  });

  const body = generation.data.body.includes("STOP")
    ? generation.data.body
    : `${generation.data.body}\n\nReply STOP to unsubscribe.`;

  const template = await database.template.create({
    data: {
      tenantId: input.tenantId,
      name: `tpl_${goal}_${Date.now()}`,
      category: generation.data.templateCategory || "MARKETING",
      language: business.languages[0] ?? "en",
      body,
      variables: ["name"],
      metaStatus: "draft",
    },
  });

  const campaign = await database.campaign.create({
    data: {
      tenantId: input.tenantId,
      name: input.name ?? generation.data.name,
      goal,
      segment: segment as object,
      templateId: template.id,
      messageBody: body,
      imagePrompt: generation.data.suggestedImagePrompt,
      status: "pending_approval",
      stats: { audience: audience.length, delivered: 0, read: 0, replied: 0, failed: 0 } as object,
    },
  });

  await logAgentRun({
    tenantId: input.tenantId,
    agent: "marketing",
    action: "campaign.drafted",
    input: { goal, segment, brief: input.brief },
    output: { campaignId: campaign.id, audience: audience.length },
    requiresApproval: true,
    model: generation.model,
    tokens: generation.tokens,
  });

  return { campaign, audience: audience.length, template };
}

export async function submitCampaignTemplate(tenantId: string, campaignId: string) {
  const database = db(tenantId);
  const campaign = await database.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign?.templateId) throw new Error("Campaign has no template");
  const template = await database.template.findFirst({ where: { id: campaign.templateId } });
  if (!template) throw new Error("Template not found");
  if ((await getWhatsAppMode(tenantId)) === "mock") {
    return database.template.update({
      where: { id: template.id },
      data: {
        metaStatus: "approved",
        metaTemplateId: template.metaTemplateId ?? `mock_tpl_${Date.now()}`,
        rejectionReason: null,
      },
    });
  }
  if (template.metaStatus === "approved") return template;

  // A submitted template cannot be submitted twice (Meta rejects duplicate names);
  // refresh its approval state instead.
  if (template.metaTemplateId && template.metaStatus !== "rejected") {
    return syncTemplateStatus(tenantId, template.id);
  }

  const result = await submitTemplateForApproval({
    tenantId,
    name: template.name,
    category: template.category,
    language: template.language,
    body: template.body,
    variables: template.variables,
  });
  return database.template.update({
    where: { id: template.id },
    data: {
      metaStatus: result.status,
      metaTemplateId: result.externalId,
      rejectionReason: null,
    },
  });
}

export async function refreshCampaignTemplate(tenantId: string, campaignId: string) {
  const database = db(tenantId);
  const campaign = await database.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign?.templateId) throw new Error("Campaign has no template");
  return syncTemplateStatus(tenantId, campaign.templateId);
}

/** Owner approves: build the recipient list from the live segment, then send or schedule. */
export async function approveCampaign(
  tenantId: string,
  campaignId: string,
  options: { scheduledAt?: Date | null } = {}
) {
  const database = db(tenantId);
  const campaign = await database.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (!["draft", "pending_approval", "scheduled"].includes(campaign.status)) {
    throw new Error("This campaign is already sending or sent");
  }
  const audience = await resolveAudience(tenantId, (campaign.segment ?? {}) as CampaignSegment);
  for (const contact of audience) {
    await database.campaignRecipient.upsert({
      where: { campaignId_contactId: { campaignId, contactId: contact.id } },
      create: { tenantId, campaignId, contactId: contact.id },
      update: {},
    });
  }
  const scheduledAt = options.scheduledAt ?? null;
  const updated = await database.campaign.update({
    where: { id: campaign.id },
    data: {
      status: scheduledAt ? "scheduled" : "sending",
      scheduledAt,
      stats: { ...(campaign.stats as object), audience: audience.length } as object,
    },
  });
  await enqueue({
    type: "campaign_send",
    tenantId,
    payload: { campaignId: campaign.id },
    runAt: scheduledAt ?? new Date(),
    idempotencyKey: `campaign:${campaign.id}`,
  });
  return { campaign: updated, audience: audience.length };
}
