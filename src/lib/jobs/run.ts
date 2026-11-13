import { unscoped, db } from "@/lib/db";
import { publishGbpPost } from "@/lib/adapters/google";
import { getSessionWindow, getWhatsAppMode, reviewRequestLink } from "@/lib/adapters/whatsapp";
import { sendCampaign } from "@/lib/marketing/send";
import { sendDirectMessage } from "@/lib/marketing/direct";
import { recordUsage } from "@/lib/usage";
import { enqueue } from "@/lib/jobs/queue";
import { logAudit } from "@/lib/audit";
import { addMinutes, formatDate } from "@/lib/utils";
import type { Job } from "@prisma/client";

export async function runDueJobs(limit = 20) {
  const due = await unscoped.job.findMany({
    where: { status: "queued", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of due) {
    const claimed = await unscoped.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      await execute(job);
      await unscoped.job.update({ where: { id: job.id }, data: { status: "done", lastError: null } });
      results.push({ id: job.id, status: "done" });
    } catch (error) {
      const attempts = job.attempts + 1;
      const message = (error as Error).message?.slice(0, 500) ?? "Unknown error";
      const dead = attempts >= job.maxAttempts;
      await unscoped.job.update({
        where: { id: job.id },
        data: {
          status: dead ? "dead" : "queued",
          lastError: message,
          runAt: dead ? job.runAt : addMinutes(new Date(), Math.min(2 ** attempts, 30)),
        },
      });
      await logAudit({
        tenantId: job.tenantId,
        actorType: "system",
        action: dead ? "job.dead_letter" : "job.retry",
        target: job.id,
        meta: { type: job.type, error: message, attempts },
      });
      results.push({ id: job.id, status: dead ? "dead" : "retry", error: message });
    }
  }

  return { processed: results.length, results };
}

async function execute(job: Job) {
  const payload = (job.payload ?? {}) as Record<string, string>;
  const tenantId = job.tenantId;
  if (!tenantId) throw new Error("Job is missing a tenant");
  const database = db(tenantId);
  const whatsappLive = (await getWhatsAppMode(tenantId)) === "live";

  switch (job.type) {
    case "gbp_publish": {
      const post = await database.gbpPost.findFirst({ where: { id: payload.postId } });
      if (!post || post.status === "published") return;
      const published = await publishGbpPost(tenantId, {
        title: post.title,
        body: post.body,
        imageUrl: post.imageUrl,
      });
      await database.gbpPost.update({
        where: { id: post.id },
        data: { status: "published", publishedAt: new Date(), externalId: published.externalId },
      });
      await recordUsage(tenantId, "gbp_post");
      return;
    }

    case "campaign_send":
      await sendCampaign(tenantId, payload.campaignId);
      return;

    case "appointment_reminder": {
      const booking = await database.booking.findFirst({ where: { id: payload.bookingId } });
      if (!booking?.contactId || booking.reminderSentAt) return;
      const business = await database.business.findFirst();
      const when = formatDate(booking.startsAt);
      const sent = await sendDirectMessage({
        tenantId,
        contactId: booking.contactId,
        body: `Reminder: your ${booking.serviceName} at ${business?.name ?? "us"} is on ${when}. Reply RESCHEDULE if you need another time.`,
        templateName: whatsappLive ? "appointment_reminder" : undefined,
      });
      if (!sent.skipped) {
        await database.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
        await recordUsage(tenantId, "campaign_message");
      }
      return;
    }

    case "review_request": {
      const booking = await database.booking.findFirst({ where: { id: payload.bookingId } });
      if (!booking?.contactId) return;
      const business = await database.business.findFirst();
      const contact = await database.contact.findFirst({ where: { id: booking.contactId } });
      if (!contact?.optIn || !business?.phone) return;
      const link = reviewRequestLink(business.phone, business.name);
      await sendDirectMessage({
        tenantId,
        contactId: booking.contactId,
        body: `Thank you for visiting ${business.name}! If you have a minute, a Google review helps other people in ${business.city} find us: ${link}`,
        templateName: whatsappLive ? "review_request" : undefined,
      });
      await recordUsage(tenantId, "campaign_message");
      return;
    }

    case "birthday_offer": {
      const business = await database.business.findFirst();
      const contacts = await database.contact.findMany({ where: { optIn: true, birthday: { not: null } } });
      const month = new Date().getMonth();
      for (const contact of contacts) {
        if (!contact.birthday || contact.birthday.getMonth() !== month) continue;
        await sendDirectMessage({
          tenantId,
          contactId: contact.id,
          body: `Happy birthday month, ${contact.name ?? "friend"}! The team at ${business?.name ?? "us"} would love to see you. Reply BOOK for a slot. Reply STOP to unsubscribe.`,
          templateName: whatsappLive ? "birthday_offer" : undefined,
        });
        await recordUsage(tenantId, "campaign_message");
      }
      return;
    }

    case "win_back": {
      const business = await database.business.findFirst();
      const cutoff = new Date(Date.now() - 60 * 86400_000);
      const contacts = await database.contact.findMany({
        where: { optIn: true, OR: [{ lastSeenAt: { lte: cutoff } }, { lastSeenAt: null }] },
      });
      for (const contact of contacts.slice(0, 200)) {
        await sendDirectMessage({
          tenantId,
          contactId: contact.id,
          body: `Hi ${contact.name ?? "there"}, we've missed you at ${business?.name ?? "us"}! Reply BOOK to see open slots this week. Reply STOP to unsubscribe.`,
          templateName: whatsappLive ? "win_back" : undefined,
        });
        await recordUsage(tenantId, "campaign_message");
      }
      return;
    }

    case "chat_followup": {
      const conversation = await database.conversation.findFirst({
        where: { id: payload.conversationId },
        include: { contact: true },
      });
      if (!conversation || conversation.aiPaused || !conversation.contact.optIn) return;
      const attempt = Number(payload.attempt ?? 1);
      if (attempt > 2) return;
      const lastInbound = await database.message.findFirst({
        where: { conversationId: conversation.id, direction: "in" },
        orderBy: { createdAt: "desc" },
      });
      const lastMessage = await database.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
      });
      if (!lastMessage || lastMessage.direction === "in") return;
      if (lastInbound && lastMessage.createdAt.getTime() - lastInbound.createdAt.getTime() < 3 * 3600_000) return;

      const window = await getSessionWindow(tenantId, conversation.id);
      if (!window.open) {
        await logAudit({
          tenantId,
          actorType: "system",
          action: "chat.followup_skipped",
          target: conversation.id,
          meta: { reason: "outside_24h_window", lastInboundAt: window.lastInboundAt?.toISOString() ?? null },
        });
        return;
      }

      await sendDirectMessage({
        tenantId,
        contactId: conversation.contactId,
        body:
          attempt === 1
            ? `Hi ${conversation.contact.name ?? "there"}, just checking — would you like me to hold a slot for you?`
            : `No pressure at all. Whenever you're ready, message us here and we'll book you in.`,
        role: "ai",
      });
      await enqueue({
        type: "chat_followup",
        tenantId,
        payload: { conversationId: conversation.id, attempt: attempt + 1 },
        runAt: addMinutes(new Date(), attempt === 1 ? 24 * 60 : 72 * 60),
        idempotencyKey: `followup:${conversation.id}:${lastMessage.id}:${attempt + 1}`,
      });
      return;
    }

    case "automation_sweep": {
      const automations = await database.automation.findMany({ where: { enabled: true } });
      for (const automation of automations) {
        if (automation.type === "appointment_reminder") {
          const soon = await database.booking.findMany({
            where: {
              status: "confirmed",
              reminderSentAt: null,
              startsAt: { gte: new Date(), lte: addMinutes(new Date(), 24 * 60) },
            },
          });
          for (const booking of soon) {
            await enqueue({
              type: "appointment_reminder",
              tenantId,
              payload: { bookingId: booking.id },
              idempotencyKey: `reminder:${booking.id}`,
            });
          }
        }
        if (automation.type === "review_request") {
          const completed = await database.booking.findMany({
            where: { status: "completed", reminderSentAt: null, startsAt: { lte: new Date() } },
            take: 50,
          });
          for (const booking of completed) {
            await enqueue({
              type: "review_request",
              tenantId,
              payload: { bookingId: booking.id },
              idempotencyKey: `review:${booking.id}`,
            });
            await database.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
          }
        }
        if (automation.type === "birthday_offer") {
          const day = new Date().toISOString().slice(0, 10);
          await enqueue({
            type: "birthday_offer",
            tenantId,
            idempotencyKey: `birthday:${day}`,
          });
        }
        if (automation.type === "win_back") {
          const last = new Date().toISOString().slice(0, 10);
          await enqueue({
            type: "win_back",
            tenantId,
            idempotencyKey: `winback:${last}`,
          });
        }
      }
      await database.automation.updateMany({ data: { lastRunAt: new Date() } });
      return;
    }

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
