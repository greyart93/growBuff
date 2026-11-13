import { db } from "@/lib/db";
import { getWhatsAppMode, sendWhatsAppMessage } from "@/lib/adapters/whatsapp";
import { checkUsage, recordUsage } from "@/lib/usage";
import { WEEK_DAYS } from "@/lib/marketing/constants";

function templateParam(variable: string, contact: { name: string | null; phone: string }) {
  if (/name/i.test(variable)) return contact.name || "there";
  if (/phone/i.test(variable)) return contact.phone;
  return "";
}

export async function sendCampaign(tenantId: string, campaignId: string) {
  const database = db(tenantId);
  const campaign = await database.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sent") return { skipped: true };

  const template = campaign.templateId
    ? await database.template.findFirst({ where: { id: campaign.templateId } })
    : null;
  const whatsappLive = (await getWhatsAppMode(tenantId)) === "live";
  if (whatsappLive && template?.metaStatus !== "approved") {
    await database.campaign.update({
      where: { id: campaign.id },
      data: { status: "failed", stats: { ...(campaign.stats as object), error: "Template not approved" } as object },
    });
    throw new Error("Outbound marketing requires a Meta-approved template");
  }

  const recipients = await database.campaignRecipient.findMany({
    where: { campaignId, status: "queued" },
    include: { contact: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const interval = whatsappLive ? Math.max(0, Number(process.env.WHATSAPP_SEND_INTERVAL_MS ?? 100)) : 4;

  for (const recipient of recipients) {
    // Re-check opt-in at send time: a STOP may arrive while the campaign is running.
    const contact = await database.contact.findFirst({
      where: { id: recipient.contactId, optIn: true },
    });
    if (!contact) {
      await database.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "skipped", error: "No opt-in" },
      });
      skipped++;
      continue;
    }

    const usage = await checkUsage(tenantId, "campaign_message");
    if (!usage.allowed) {
      await database.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "skipped", error: "Plan limit reached" },
      });
      skipped++;
      continue;
    }

    try {
      let conversation = await database.conversation.findFirst({
        where: { contactId: recipient.contactId },
      });
      if (!conversation) {
        conversation = await database.conversation.create({
          data: {
            tenantId,
            contactId: recipient.contactId,
            lastMessagePreview: campaign.messageBody.slice(0, 120),
          },
        });
      }
      const personalised = campaign.messageBody.replace(/\{\{\s*name\s*\}\}/gi, contact.name || "there");
      const message = await sendWhatsAppMessage({
        tenantId,
        conversationId: conversation.id,
        contactPhone: contact.phone,
        body: personalised,
        role: "system",
        templateName: whatsappLive ? template?.name : undefined,
        templateLanguage: template?.language,
        templateParams: template?.variables.map((variable) => templateParam(variable, contact)),
        clientRef: `campaign:${campaign.id}:recipient:${recipient.id}`,
      });
      await database.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "sent", sentAt: new Date(), waMessageId: message.waMessageId, error: null },
      });
      await recordUsage(tenantId, "campaign_message", 1, { campaignId });
      sent++;
    } catch (error) {
      failed++;
      await database.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "failed", error: (error as Error).message.slice(0, 300) },
      });
    }
    if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
  }

  // Sandbox keeps a realistic read/reply split for the demo. Live stats come
  // only from delivery callbacks, so they start at zero after dispatch.
  const read = whatsappLive ? 0 : Math.round(sent * 0.62);
  const replied = whatsappLive ? 0 : Math.round(sent * 0.11);
  const stats = {
    audience: recipients.length,
    sent,
    delivered: whatsappLive ? 0 : sent,
    skipped,
    failed,
    read,
    replied,
    revenueAttributed: 0,
  };

  return database.campaign.update({
    where: { id: campaign.id },
    data: {
      status: sent === 0 && failed > 0 ? "failed" : "sent",
      sentAt: new Date(),
      stats: stats as object,
    },
  });
}

export const WEEK_DAYS_LABEL = WEEK_DAYS;
