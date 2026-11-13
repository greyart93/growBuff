import { db, unscoped } from "@/lib/db";
import { decrypt, randomToken } from "@/lib/crypto";
import { addMinutes } from "@/lib/utils";

export const MOCK = process.env.MOCK_INTEGRATIONS !== "false";

const GRAPH_URL = "https://graph.facebook.com";
const SESSION_MS = 24 * 60 * 60 * 1000;

export class WhatsAppWindowClosedError extends Error {
  readonly code = "whatsapp_window_closed";
  constructor(message = "Outside the 24-hour customer service window. An approved template is required.") {
    super(message);
    this.name = "WhatsAppWindowClosedError";
  }
}

export class WhatsAppApiError extends Error {
  readonly code = "whatsapp_api_error";
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

export type WhatsAppCredentials = {
  tenantId: string;
  mode: "mock" | "live";
  accessToken: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string | null;
};

export function isWithinSession(lastInboundAt: Date | null | undefined) {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < SESSION_MS;
}

export function sessionExpiresAt(lastInboundAt: Date | null | undefined) {
  return lastInboundAt ? new Date(lastInboundAt.getTime() + SESSION_MS) : null;
}

/** The customer-service window is 24h after the latest inbound customer message. */
export async function getSessionWindow(tenantId: string, conversationId: string) {
  const lastInbound = await db(tenantId).message.findFirst({
    where: { conversationId, direction: "in" },
    orderBy: { createdAt: "desc" },
  });
  const expiresAt = sessionExpiresAt(lastInbound?.createdAt);
  return {
    open: Boolean(expiresAt && expiresAt.getTime() > Date.now()),
    lastInboundAt: lastInbound?.createdAt ?? null,
    expiresAt,
  };
}

export async function getWhatsAppCredentials(tenantId: string): Promise<WhatsAppCredentials> {
  const connection = await unscoped.connection.findFirst({
    where: { tenantId, provider: "whatsapp" },
  });
  const meta = (connection?.meta ?? {}) as {
    mode?: string;
    wabaId?: string;
    phoneNumberId?: string;
  };
  const decrypted = connection?.accessTokenEnc ? decrypt(connection.accessTokenEnc) : null;
  // Saving live credentials opts this tenant into live WhatsApp without forcing
  // Google, Calendar or billing out of sandbox mode. The global flag still
  // forces every tenant live, and a stale sandbox connection can never override it.
  const liveConfigured = meta.mode === "live" && Boolean(connection?.accessTokenEnc);
  return {
    tenantId,
    mode: !MOCK || liveConfigured ? "live" : "mock",
    accessToken: decrypted ?? process.env.WHATSAPP_ACCESS_TOKEN ?? null,
    phoneNumberId: meta.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    wabaId: meta.wabaId ?? process.env.WHATSAPP_WABA_ID ?? null,
    displayName: connection?.displayName ?? null,
  };
}

export async function getWhatsAppMode(tenantId: string) {
  return (await getWhatsAppCredentials(tenantId)).mode;
}

function apiVersion() {
  return process.env.WHATSAPP_API_VERSION || "v21.0";
}

function normalizeRecipient(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) {
    throw new WhatsAppApiError("Recipient phone must be a valid E.164 number", 400);
  }
  return digits;
}

function messageError(statuses: Array<{ title?: string; message?: string; code?: number }> = []) {
  return statuses
    .map((error) => [error.code, error.title ?? error.message].filter(Boolean).join(": "))
    .join("; ")
    .slice(0, 500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphRequest(
  creds: WhatsAppCredentials,
  path: string,
  init: RequestInit,
  allowRateLimitRetry = false
): Promise<Record<string, unknown>> {
  if (!creds.accessToken) throw new WhatsAppApiError("WhatsApp access token is missing", 401);
  const response = await fetch(`${GRAPH_URL}/${apiVersion()}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${creds.accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string; fbtrace_id?: string };
    [key: string]: unknown;
  };
  if (response.ok) return payload;

  const error = payload.error ?? {};
  const retryAfter = Number(response.headers.get("retry-after") ?? 0);
  if (allowRateLimitRetry && response.status === 429) {
    await sleep(Math.min(Math.max(retryAfter, 1), 5) * 1000);
    return graphRequest(creds, path, init, false);
  }
  if (response.status === 401 || error.code === 190) {
    await unscoped.connection.updateMany({
      where: { tenantId: creds.tenantId, provider: "whatsapp" },
      data: { status: "error" },
    });
  }
  if (error.code === 131047) {
    throw new WhatsAppWindowClosedError(
      "Meta rejected this message because the 24-hour customer service window is closed. Use an approved template."
    );
  }
  throw new WhatsAppApiError(
    error.error_user_msg || error.message || `WhatsApp API ${response.status}`,
    response.status,
    response.status === 429 || response.status >= 500,
    {
      metaCode: error.code,
      subcode: error.error_subcode,
      fbtraceId: error.fbtrace_id,
      retryAfter,
    }
  );
}

/**
 * Send an outbound WhatsApp message and persist it.
 * In live mode this enforces the 24-hour window for free-form replies and
 * sends approved templates for business-initiated messages.
 */
export async function sendWhatsAppMessage(input: {
  tenantId: string;
  conversationId: string;
  contactPhone: string;
  body: string;
  role?: "ai" | "agent" | "system";
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Array<string | number>;
  clientRef?: string;
  groundedSources?: string[];
  agentRunId?: string;
}) {
  const database = db(input.tenantId);
  const recipient = normalizeRecipient(input.contactPhone);
  const creds = await getWhatsAppCredentials(input.tenantId);
  const templateParams = (input.templateParams ?? []).map((value) => String(value).slice(0, 1024));

  if (creds.mode === "live") {
    if (!creds.phoneNumberId) {
      throw new WhatsAppApiError(
        "WhatsApp phone number ID is missing. Set it in the connection or WHATSAPP_PHONE_NUMBER_ID.",
        400
      );
    }
    if (!input.templateName) {
      const window = await getSessionWindow(input.tenantId, input.conversationId);
      if (!window.open) throw new WhatsAppWindowClosedError();
    } else {
      const localTemplate = await database.template.findFirst({
        where: { name: input.templateName },
        orderBy: { createdAt: "desc" },
      });
      if (localTemplate && localTemplate.metaStatus !== "approved") {
        throw new WhatsAppApiError(
          `Template "${input.templateName}" is ${localTemplate.metaStatus}, not approved by Meta.`,
          400
        );
      }
    }
  }

  const message = await database.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      direction: "out",
      role: input.role ?? "ai",
      body: input.body,
      status: creds.mode === "mock" ? "sent" : "queued",
      statusAt: new Date(),
      waMessageId: creds.mode === "mock" ? `wamid.mock.${randomToken(8)}` : null,
      groundedSources: input.groundedSources ?? [],
      agentRunId: input.agentRunId,
    },
  });

  if (creds.mode === "mock") {
    await sleep(10);
  } else {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      biz_opaque_callback_data: (input.clientRef ?? message.id).slice(0, 512),
    };

    if (input.templateName) {
      payload.type = "template";
      payload.template = {
        name: input.templateName,
        language: { code: input.templateLanguage ?? "en" },
        ...(templateParams.length
          ? {
              components: [
                {
                  type: "body",
                  parameters: templateParams.map((text) => ({ type: "text", text })),
                },
              ],
            }
          : {}),
      };
    } else {
      payload.type = "text";
      payload.text = { preview_url: false, body: input.body.slice(0, 4096) };
    }

    try {
      const response = await graphRequest(creds, `${creds.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const waMessageId = (response.messages as Array<{ id?: string }> | undefined)?.[0]?.id;
      if (!waMessageId) throw new WhatsAppApiError("Meta did not return a message id", 502, true);
      await database.message.update({
        where: { id: message.id },
        data: { waMessageId, status: "sent", statusAt: new Date(), error: null },
      });
    } catch (error) {
      await database.message.update({
        where: { id: message.id },
        data: {
          status: "failed",
          statusAt: new Date(),
          error: (error as Error).message.slice(0, 500),
        },
      });
      throw error;
    }
  }

  const saved = await database.message.findFirstOrThrow({ where: { id: message.id } });
  await database.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date(), lastMessagePreview: input.body.slice(0, 120) },
  });
  return saved;
}

function sampleValue(token: string) {
  if (/name/i.test(token)) return "Ananya";
  if (/date|time|day/i.test(token)) return "15 Nov";
  if (/service/i.test(token)) return "teeth cleaning";
  if (/amount|price/i.test(token)) return "₹999";
  return "Sample";
}

/** Meta templates require numeric placeholders ({{1}}, {{2}}). */
export function buildMetaTemplateBody(body: string, variables: string[] = []) {
  const assigned = new Map<string, number>();
  const examples: string[] = [];
  const text = body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, token: string) => {
    if (/^\d+$/.test(token)) {
      const index = Number(token);
      examples[index - 1] = sampleValue(variables[index - 1] ?? token);
      return `{{${index}}}`;
    }
    let index = assigned.get(token);
    if (!index) {
      index = assigned.size + 1;
      assigned.set(token, index);
      examples[index - 1] = sampleValue(token);
    }
    return `{{${index}}}`;
  });
  return { text, examples: examples.filter(Boolean) };
}

export function mapTemplateStatus(status: string | undefined) {
  const value = (status ?? "").toUpperCase();
  if (value === "APPROVED") return "approved";
  if (value === "REJECTED") return "rejected";
  if (value === "PENDING" || value === "IN_APPEAL") return "submitted";
  return value ? value.toLowerCase() : "draft";
}

/** Submit a template to the WABA that belongs to this tenant. */
export async function submitTemplateForApproval(input: {
  tenantId: string;
  name: string;
  category: string;
  language: string;
  body: string;
  variables?: string[];
}) {
  const creds = await getWhatsAppCredentials(input.tenantId);
  if (creds.mode === "mock") {
    return { externalId: `mock_tpl_${randomToken(6)}`, status: "approved" as const };
  }
  if (!creds.wabaId) {
    throw new WhatsAppApiError("WhatsApp Business Account ID is not connected", 400);
  }
  const { text, examples } = buildMetaTemplateBody(input.body, input.variables ?? []);
  const components: Array<Record<string, unknown>> = [{ type: "BODY", text }];
  if (examples.length) components[0].example = { body_text: [examples] };

  const payload = (await graphRequest(creds, `${creds.wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      category: input.category.toUpperCase(),
      language: input.language,
      components,
      allow_category_change: false,
    }),
  })) as { id?: string; status?: string };

  if (!payload.id) throw new WhatsAppApiError("Meta did not return a template id", 502);
  return {
    externalId: payload.id,
    status: mapTemplateStatus(payload.status) as "submitted" | "approved" | "rejected",
  };
}

/** Fetch the latest approval state for a locally-stored template. */
export async function syncTemplateStatus(tenantId: string, templateId: string) {
  const database = db(tenantId);
  const template = await database.template.findFirst({ where: { id: templateId } });
  if (!template) throw new Error("Template not found");
  const creds = await getWhatsAppCredentials(tenantId);
  if (creds.mode === "mock") return template;
  if (!creds.wabaId) {
    throw new WhatsAppApiError("WhatsApp Business Account ID is not connected", 400);
  }
  const payload = (await graphRequest(
    creds,
    `${creds.wabaId}/message_templates?fields=id,name,status,rejected_reason,language&name=${encodeURIComponent(
      template.name
    )}&limit=50`,
    { method: "GET" },
    true
  )) as {
    data?: Array<{ id: string; name: string; status: string; rejected_reason?: string; language?: string }>;
  };
  const row =
    payload.data?.find((item) => item.id === template.metaTemplateId) ??
    payload.data?.find((item) => item.name === template.name) ??
    payload.data?.[0];
  if (!row) return template;
  return database.template.update({
    where: { id: template.id },
    data: {
      metaStatus: mapTemplateStatus(row.status),
      metaTemplateId: row.id,
      rejectionReason: row.status === "REJECTED" ? row.rejected_reason ?? "Rejected by Meta" : null,
    },
  });
}

export function reviewRequestLink(phone: string, businessName: string) {
  const text = encodeURIComponent(
    `Hi! Thank you for visiting ${businessName}. Could you share a quick Google review? It helps us a lot.`
  );
  return `https://wa.me/${phone.replace("+", "")}?text=${text}`;
}

export async function bookingReminderBody(businessName: string, startsAt: Date, service: string) {
  const when = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(startsAt);
  return `Reminder: your ${service} at ${businessName} is on ${when}. Reply RESCHEDULE if you need another time.`;
}

export function reminderRunAt(startsAt: Date) {
  return addMinutes(startsAt, -24 * 60);
}

export { messageError as whatsappStatusError };
