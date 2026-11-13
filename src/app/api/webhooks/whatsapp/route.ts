import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, unscoped } from "@/lib/db";
import { decrypt, verifySha256Signature } from "@/lib/crypto";
import { handleInboundMessage } from "@/lib/ai/agents/chat";
import { normalizePhone } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const MOCK = process.env.MOCK_INTEGRATIONS !== "false";

type StatusError = { code?: number; title?: string; message?: string; error_data?: { details?: string } };
type DeliveryStatus = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
  biz_opaque_callback_data?: string;
  errors?: StatusError[];
};

type TemplateStatusValue = {
  event?: string;
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
};

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string } };
        }>;
        statuses?: DeliveryStatus[];
        event?: string;
        message_template_id?: string;
        message_template_name?: string;
        message_template_language?: string;
        reason?: string;
      };
    }>;
  }>;
};

function sameToken(left: string | null, right: string) {
  if (!left) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function getWebhookAuth() {
  const secrets = new Set<string>();
  const tokens = new Set<string>();
  if (process.env.WHATSAPP_APP_SECRET) secrets.add(process.env.WHATSAPP_APP_SECRET);
  if (process.env.WHATSAPP_VERIFY_TOKEN) tokens.add(process.env.WHATSAPP_VERIFY_TOKEN);

  const connections = await unscoped.connection.findMany({
    where: { provider: "whatsapp" },
    select: { appSecretEnc: true, verifyTokenEnc: true },
  });
  for (const connection of connections) {
    const secret = decrypt(connection.appSecretEnc);
    const token = decrypt(connection.verifyTokenEnc);
    if (secret) secrets.add(secret);
    if (token) tokens.add(token);
  }
  return { secrets: [...secrets], tokens: [...tokens] };
}

/** Meta webhook verification handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const auth = await getWebhookAuth();
  const expectedTokens = auth.tokens.length ? auth.tokens : MOCK ? ["growbuff-verify"] : [];
  if (mode === "subscribe" && expectedTokens.some((expected) => sameToken(token, expected))) {
    return new NextResponse(challenge ?? "ok", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Resolve the tenant that owns the receiving business number. */
async function resolveConnection(phoneNumberId?: string) {
  const connections = await unscoped.connection.findMany({
    where: { provider: "whatsapp", status: "connected" },
    orderBy: { createdAt: "asc" },
  });
  if (phoneNumberId) {
    const exact = connections.find((connection) => {
      const meta = (connection.meta ?? {}) as { phoneNumberId?: string };
      return meta.phoneNumberId === phoneNumberId;
    });
    if (exact) return exact;
    // Single-tenant deployments may only configure the number in env.
    if (process.env.WHATSAPP_PHONE_NUMBER_ID === phoneNumberId && connections.length === 1) {
      return connections[0];
    }
    return null;
  }
  if (MOCK) {
    return (
      connections.find((connection) => ((connection.meta ?? {}) as { mode?: string }).mode === "mock") ??
      connections[0] ??
      null
    );
  }
  return null;
}

function statusRank(status: string) {
  return ({ queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as Record<string, number>)[status] ?? -1;
}

function statusError(errors: StatusError[] = []) {
  return errors
    .map((error) => {
      const details = error.error_data?.details;
      const text = error.title ?? error.message ?? details ?? "";
      return [error.code, text].filter(Boolean).join(": ");
    })
    .join("; ")
    .slice(0, 500);
}

async function refreshCampaignStats(tenantId: string, campaignId: string) {
  const groups = await unscoped.campaignRecipient.groupBy({
    by: ["status"],
    where: { tenantId, campaignId },
    _count: { _all: true },
  });
  const count = (status: string) => groups.find((group) => group.status === status)?._count._all ?? 0;
  const campaign = await unscoped.campaign.findFirst({ where: { id: campaignId, tenantId } });
  if (!campaign) return;
  const previous = (campaign.stats ?? {}) as Record<string, unknown>;
  const delivered = count("delivered") + count("read") + count("replied");
  const stats = {
    ...previous,
    sent: count("sent") + delivered,
    delivered,
    read: count("read") + count("replied"),
    replied: count("replied"),
    failed: count("failed"),
    skipped: count("skipped"),
  };
  await unscoped.campaign.update({ where: { id: campaign.id }, data: { stats: stats as object } });
}

async function applyDeliveryStatus(status: DeliveryStatus) {
  const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
  const error = status.errors?.length ? statusError(status.errors) : null;
  const nextRank = statusRank(status.status);
  if (nextRank < 0) return;

  const message = await unscoped.message.findFirst({ where: { waMessageId: status.id } });
  if (message) {
    const currentRank = statusRank(message.status);
    if (nextRank > currentRank || status.status === "failed") {
      await unscoped.message.updateMany({
        where: { id: message.id },
        data: {
          status: status.status,
          statusAt: timestamp,
          ...(error ? { error } : {}),
        },
      });
    }
  }

  let recipient = await unscoped.campaignRecipient.findFirst({ where: { waMessageId: status.id } });
  let linkLateCallback = false;
  if (!recipient && status.biz_opaque_callback_data) {
    const match = /^campaign:([^:]+):recipient:([^:]+)$/.exec(status.biz_opaque_callback_data);
    if (match) {
      recipient = await unscoped.campaignRecipient.findFirst({
        where: { id: match[2], campaignId: match[1] },
      });
      linkLateCallback = Boolean(recipient);
    }
  }
  if (!recipient) return;
  const currentRank = statusRank(recipient.status);
  if (linkLateCallback || nextRank > currentRank || status.status === "failed") {
    await unscoped.campaignRecipient.updateMany({
      where: { id: recipient.id },
      data: {
        ...(linkLateCallback ? { waMessageId: status.id } : {}),
        status: status.status,
        ...(status.status === "delivered" ? { deliveredAt: timestamp } : {}),
        ...(status.status === "read" ? { deliveredAt: recipient.deliveredAt ?? timestamp, readAt: timestamp } : {}),
        ...(error ? { error } : {}),
      },
    });
  }
  await refreshCampaignStats(recipient.tenantId, recipient.campaignId);
}

function mapTemplateEvent(event: string | undefined) {
  const value = (event ?? "").toUpperCase();
  if (value === "APPROVED") return "approved";
  if (value === "REJECTED") return "rejected";
  if (value === "PENDING" || value === "IN_APPEAL") return "submitted";
  return value ? value.toLowerCase() : "draft";
}

async function applyTemplateStatus(value: TemplateStatusValue) {
  const name = value.message_template_name;
  const metaId = value.message_template_id;
  if (!name && !metaId) return;

  let template = metaId
    ? await unscoped.template.findFirst({ where: { metaTemplateId: metaId } })
    : null;
  if (!template && name) {
    const candidates = await unscoped.template.findMany({ where: { name } });
    const language = value.message_template_language?.split("_")[0];
    template =
      candidates.find((candidate) => !language || candidate.language.split("_")[0] === language) ??
      candidates[0] ??
      null;
  }
  if (!template) return;

  const status = mapTemplateEvent(value.event);
  const rejected = status === "rejected";
  await unscoped.template.update({
    where: { id: template.id },
    data: {
      metaStatus: status,
      ...(metaId ? { metaTemplateId: metaId } : {}),
      rejectionReason: rejected ? value.reason ?? "Rejected by Meta" : null,
    },
  });
  await logAudit({
    tenantId: template.tenantId,
    actorType: "system",
    action: "whatsapp.template_status",
    target: template.id,
    meta: { status, reason: value.reason ?? null, name },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const auth = await getWebhookAuth();
  const signatureValid = auth.secrets.length
    ? auth.secrets.some((secret) => verifySha256Signature(raw, signature, secret))
    : MOCK;
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Always 200 quickly so Meta does not retry; individual failures are logged
  // and the next webhook delivery remains idempotent.
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        if (change.field === "message_template_status_update") {
          await applyTemplateStatus(value);
          continue;
        }

        for (const status of value.statuses ?? []) {
          await applyDeliveryStatus(status);
        }

        for (const incoming of value.messages ?? []) {
          const text =
            incoming.text?.body ??
            incoming.button?.text ??
            incoming.interactive?.button_reply?.title ??
            "";
          if (!text.trim()) continue;

          const phone = normalizePhone(incoming.from);
          if (!phone) continue;
          const profileName = value.contacts?.[0]?.profile?.name;

          const connection = await resolveConnection(value.metadata?.phone_number_id);
          if (!connection) {
            console.warn("whatsapp webhook: no connected tenant for number", value.metadata?.phone_number_id);
            continue;
          }
          const tenantId = connection.tenantId;

          // Idempotency: Meta retries the same message id.
          const existing = await unscoped.message.findUnique({ where: { waMessageId: incoming.id } });
          if (existing) continue;

          let contact = await unscoped.contact.findFirst({ where: { tenantId, phone } });
          if (!contact) {
            contact = await unscoped.contact.create({
              data: {
                tenantId,
                phone,
                name: profileName ?? phone.slice(-4),
                source: "chat",
                optIn: true,
                optInAt: new Date(),
                lastSeenAt: new Date(),
              },
            });
          }

          // Record opt-out before the AI runs so a paused chat still honours STOP.
          if (/^(stop|unsubscribe|opt\s*out)$/i.test(text.trim())) {
            await unscoped.contact.update({
              where: { id: contact.id },
              data: { optIn: false, optOutAt: new Date() },
            });
          }
          if (/^start$/i.test(text.trim())) {
            await unscoped.contact.update({
              where: { id: contact.id },
              data: { optIn: true, optInAt: new Date(), optOutAt: null },
            });
          }

          let conversation = await unscoped.conversation.findFirst({
            where: { tenantId, contactId: contact.id },
          });
          if (!conversation) {
            conversation = await unscoped.conversation.create({
              data: { tenantId, contactId: contact.id },
            });
          }

          await db(tenantId).message.create({
            data: {
              tenantId,
              conversationId: conversation.id,
              direction: "in",
              role: "customer",
              body: text,
              status: "delivered",
              statusAt: new Date(),
              waMessageId: incoming.id,
            },
          });
          await db(tenantId).conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: text.slice(0, 120),
              unread: { increment: 1 },
            },
          });
          await db(tenantId).contact.update({
            where: { id: contact.id },
            data: { lastSeenAt: new Date() },
          });

          if (!conversation.aiPaused) {
            await handleInboundMessage({ tenantId, conversationId: conversation.id, text }).catch(
              (error) => console.error("chat agent failed", error)
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("whatsapp webhook processing failed", error);
  }

  return NextResponse.json({ received: true });
}
