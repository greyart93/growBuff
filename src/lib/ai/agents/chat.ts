import { db } from "@/lib/db";
import { retrieveKnowledge } from "@/lib/ai/rag";
import { detectLanguage, tokenize } from "@/lib/ai/embed";
import { getPrompt } from "@/lib/ai/prompts";
import { generateJson } from "@/lib/ai/provider";
import { sendWhatsAppMessage } from "@/lib/adapters/whatsapp";
import { availableSlots, formatSlotList } from "@/lib/adapters/calendar";
import { logAgentRun, logAudit } from "@/lib/audit";
import { checkUsage, recordUsage } from "@/lib/usage";
import { enqueue } from "@/lib/jobs/queue";
import { asServices, type ConversationState } from "@/lib/types";
import { addMinutes } from "@/lib/utils";

export type ChatIntent = "booking" | "price" | "complaint" | "enquiry" | "optout";

const OPT_OUT = /^(stop|unsubscribe|opt[\s-]?out|band karo|bandh karo|mat bhejo)$/i;
const GUARDRAIL =
  /(diagnos|prescri|dose|dosage|medicine|tablet|cure|permanent fix|guarantee|legal|sue|court|emergency|chest pain|bleeding|accident|pregnan)/i;

export function detectIntent(text: string): ChatIntent {
  const t = text.toLowerCase();
  if (OPT_OUT.test(t.trim())) return "optout";
  if (/(complaint|worst|rude|refund|angry|bad experience|paisa wapas|shikayat)/.test(t)) return "complaint";
  if (/(book|appointment|slot|schedule|milna|samay|time chahiye|reserve|visit)/.test(t)) return "booking";
  if (/(price|cost|fee|charge|how much|rate|kitna|kimat|paisa)/.test(t)) return "price";
  return "enquiry";
}

function groundedReply(content: string, lang: "en" | "hi") {
  const trimmed = content.length > 420 ? `${content.slice(0, 400).replace(/\s+\S*$/, "")}…` : content;
  if (lang === "hi") return `जी, ${trimmed}\n\nऔर कुछ जानना है?`;
  return `${trimmed}\n\nAnything else I can help with?`;
}

function pickSlot(text: string, slots: string[]): number | null {
  const trimmed = text.trim().toLowerCase();
  const numeric = trimmed.match(/^([1-9])$/);
  if (numeric) {
    const index = Number(numeric[1]) - 1;
    return index < slots.length ? index : null;
  }
  const words: Record<string, number> = { first: 0, second: 1, third: 2, pehla: 0, dusra: 1, teesra: 2 };
  for (const [word, index] of Object.entries(words)) {
    if (trimmed.includes(word) && index < slots.length) return index;
  }
  return slots.findIndex((slot) => {
    const time = new Date(slot).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
    return trimmed.includes(time) || trimmed.includes(time.replace(":", "."));
  });
}

/** Persist lead + score from an inbound message (idempotent per open lead). */
const PRICE_GENERIC = new Set(["price", "cost", "charge", "fee", "rate", "much", "many", "kitna", "kitne", "kimat", "paisa"]);

function querySubjects(text: string) {
  return tokenize(text).filter((token) => !PRICE_GENERIC.has(token));
}

/** Finds the sentence that mentions what the customer asked about AND a price. */
function priceGrounding(chunks: Array<{ content: string }>, query: string): string | null {
  const subjects = querySubjects(query);
  if (!subjects.length) return null;
  for (const chunk of chunks) {
    const sentences = chunk.content.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim());
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const mentionsSubject = subjects.some((subject) => lower.includes(subject));
      const hasPrice = /(₹|rs\.?|rupees|inr)|\b\d{3,}\b/i.test(sentence);
      if (mentionsSubject && hasPrice) return sentence;
    }
  }
  return null;
}

/** Picks the sentence that best overlaps the customer's question. */
function bestSnippet(chunks: Array<{ content: string }>, query: string) {
  const subjects = querySubjects(query);
  let best = { text: chunks[0]?.content ?? "", score: -1 };
  for (const chunk of chunks) {
    const sentences = chunk.content.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const score =
        subjects.filter((subject) => lower.includes(subject)).length +
        (/(₹|rs\.?|rupees)/i.test(sentence) ? 0.5 : 0);
      if (score > best.score) best = { text: sentence, score };
    }
  }
  return best.text;
}

async function upsertLead(
  tenantId: string,
  conversationId: string,
  contactId: string,
  name: string | null,
  phone: string,
  intent: ChatIntent
) {
  if (intent === "optout") return;
  const database = db(tenantId);
  const score = { booking: 80, price: 60, complaint: 75, enquiry: 40 }[intent] ?? 40;
  const existing = await database.lead.findFirst({
    where: { contactId, status: { in: ["new", "contacted"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await database.lead.update({
      where: { id: existing.id },
      data: {
        intent,
        score: Math.max(existing.score, score),
        conversationId,
      },
    });
    return;
  }
  await database.lead.create({
    data: { tenantId, contactId, conversationId, name, phone, intent, score },
  });
}

export async function handleInboundMessage(input: {
  tenantId: string;
  conversationId: string;
  text: string;
}) {
  const database = db(input.tenantId);
  const conversation = await database.conversation.findFirst({ where: { id: input.conversationId } });
  if (!conversation) throw new Error("Conversation not found");
  const contact = await database.contact.findFirst({ where: { id: conversation.contactId } });
  const business = await database.business.findFirst();
  if (!contact || !business) throw new Error("Business not configured");

  const text = input.text.trim();
  const lang = detectLanguage(text) === "hi" ? "hi" : "en";
  const intent = detectIntent(text);

  if (intent === "optout") {
    await database.contact.update({
      where: { id: contact.id },
      data: { optIn: false, optOutAt: new Date() },
    });
    const body =
      lang === "hi"
        ? "आपको सूचनाएँ बंद कर दी गई हैं। दोबारा जुड़ने के लिए START भेजें।"
        : "You're unsubscribed and won't get marketing messages. Reply START to opt back in.";
    const message = await sendWhatsAppMessage({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      body,
      role: "system",
    });
    await logAudit({
      tenantId: input.tenantId,
      actorType: "ai",
      action: "contact.opt_out",
      target: contact.id,
    });
    return { reply: message.body, handoff: false, intent, sources: [] as string[], agentRunId: null as string | null };
  }

  await upsertLead(input.tenantId, conversation.id, contact.id, contact.name, contact.phone, intent);

  // --- Complaints, guardrail topics and opt-in compliance hand off to a human.
  let handoffReason: string | null = null;
  if (intent === "complaint") handoffReason = "Customer complaint";
  if (GUARDRAIL.test(text)) handoffReason = "Medical/legal topic — needs a human";
  if (handoffReason) {
    return handoff({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      businessName: business.name,
      reason: handoffReason,
      lang,
    });
  }

  const usage = await checkUsage(input.tenantId, "ai_message");
  if (!usage.allowed) {
    return handoff({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      businessName: business.name,
      reason: usage.reason === "no_plan" ? "Chat plan not active" : "Monthly message limit reached",
      lang,
    });
  }

  // --- Booking flow: confirm a previously offered slot.
  const state = (conversation.state ?? {}) as ConversationState;
  if (state.pendingSlots?.length) {
    const index = pickSlot(text, state.pendingSlots);
    if (index != null) {
      const services = asServices(business.services);
      const service = services.find((s) => s.name === state.pendingService) ?? services[0];
      const startsAt = new Date(state.pendingSlots[index]);
      const durationMin = service?.durationMin ?? 30;
      const booking = await database.booking.create({
        data: {
          tenantId: input.tenantId,
          contactId: contact.id,
          serviceName: service?.name ?? "Consultation",
          pricePaise: service?.pricePaise ?? null,
          startsAt,
          endsAt: addMinutes(startsAt, durationMin),
          status: "confirmed",
          source: "whatsapp",
        },
      });
      await database.lead.updateMany({
        where: { contactId: contact.id, status: { in: ["new", "contacted"] } },
        data: { status: "booked" },
      });
      const when = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }).format(startsAt);
      const gate = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      });
      const body =
        lang === "hi"
          ? `बुकिंग कन्फर्म! ${gate.format(startsAt)} को ${when.split(", ").pop()} बजे ${business.name} में आपका स्वागत है। हम एक दिन पहले रिमाइंडर भेजेंगे।`
          : `You're booked! ${when} at ${business.name}. We'll send a reminder a day before. Reply RESCHEDULE if plans change.`;
      const message = await sendWhatsAppMessage({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactPhone: contact.phone,
        body,
        role: "ai",
      });
      await database.conversation.update({
        where: { id: conversation.id },
        data: { state: {}, unread: 0 },
      });
      await enqueue({
        type: "appointment_reminder",
        tenantId: input.tenantId,
        payload: { bookingId: booking.id },
        runAt: addMinutes(startsAt, -24 * 60),
        idempotencyKey: `reminder:${booking.id}`,
      });
      const run = await logAgentRun({
        tenantId: input.tenantId,
        agent: "chat",
        action: "booking.confirmed",
        input: { text },
        output: { bookingId: booking.id, startsAt: startsAt.toISOString() },
      });
      await recordUsage(input.tenantId, "ai_message");
      return { reply: message.body, handoff: false, intent, sources: [], agentRunId: run.id };
    }
  }

  const prompt = getPrompt("chat-agent");
  const chunks = await retrieveKnowledge(input.tenantId, text, { limit: 4, minScore: 0.16 });

  // --- No grounded knowledge: never invent an answer, hand off.
  if (!chunks.length) {
    return handoff({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      businessName: business.name,
      reason: "Answer not found in knowledge base",
      lang,
    });
  }

  // --- Price questions: the service the customer asked about must appear in a
  // chunk that also contains a price. Otherwise hand off — never map an unknown
  // service onto a different price list.
  let priceSnippet: string | null = null;
  if (intent === "price") {
    const grounding = priceGrounding(chunks, text);
    if (!grounding) {
      return handoff({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactPhone: contact.phone,
        businessName: business.name,
        reason: "Price not confirmed in knowledge base",
        lang,
      });
    }
    priceSnippet = grounding;
  }

  const knowledge = chunks.map((chunk) => `- ${chunk.content}`).join("\n");
  const services = asServices(business.services);
  const fallback = {
    reply: groundedReply(priceSnippet ?? bestSnippet(chunks, text), lang),
    handoff: false,
  };
  const generation = await generateJson<{ reply: string; handoff: boolean }>({
    system: prompt.system
      .replace("{{businessName}}", business.name)
      .replace("{{category}}", business.category)
      .replace("{{city}}", business.city)
      .replace("{{knowledge}}", knowledge)
      .replace("{{slots}}", "not offered yet"),
    prompt: `Customer message: "${text}"\nDetected language: ${lang}\nReply to the customer.`,
    fallback,
    maxTokens: 400,
  });

  if (generation.data.handoff) {
    return handoff({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      businessName: business.name,
      reason: "AI asked for a human",
      lang,
    });
  }

  // --- Booking intent: offer real available slots, grounded in the calendar.
  if (intent === "booking") {
    const service = services[0];
    const slots = await availableSlots(input.tenantId, { durationMin: service?.durationMin ?? 30 });
    if (slots.length) {
      const list = formatSlotList(slots);
      const body =
        lang === "hi"
          ? `नमस्ते! ${service?.name ?? "अपॉइंटमेंट"} के लिए ये समय उपलब्ध हैं:\n\n${list.join("\n")}\n\nकृपया नंबर भेजें (1/2/3)।`
          : `Happy to book you in for ${service?.name ?? "an appointment"}! These are open:\n\n${list.join("\n")}\n\nReply with 1, 2 or 3.`;
      const message = await sendWhatsAppMessage({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactPhone: contact.phone,
        body,
        role: "ai",
      });
      await database.conversation.update({
        where: { id: conversation.id },
        data: {
          state: {
            pendingSlots: slots.map((slot) => slot.toISOString()),
            pendingService: service?.name ?? "Consultation",
            offeredAt: new Date().toISOString(),
          } as object,
        },
      });
      const run = await logAgentRun({
        tenantId: input.tenantId,
        agent: "chat",
        action: "booking.slots_offered",
        input: { text },
        output: { slots: slots.map((slot) => slot.toISOString()) },
      });
      await recordUsage(input.tenantId, "ai_message");
      return { reply: message.body, handoff: false, intent, sources: [], agentRunId: run.id };
    }
  }

  const body = generation.data.reply || fallback.reply;
  const message = await sendWhatsAppMessage({
    tenantId: input.tenantId,
    conversationId: conversation.id,
    contactPhone: contact.phone,
    body,
    role: "ai",
    groundedSources: chunks.map((chunk) => chunk.title),
  });
  const run = await logAgentRun({
    tenantId: input.tenantId,
    agent: "chat",
    action: "chat.reply",
    input: { text, language: lang },
    output: { reply: body, sources: chunks.map((chunk) => chunk.id) },
    model: generation.model,
    tokens: generation.tokens,
  });
  await recordUsage(input.tenantId, "ai_message");
  await database.conversation.update({
    where: { id: conversation.id },
    data: { unread: 0 },
  });

  // Auto follow-up if the customer goes quiet (idempotent per message count).
  const messageCount = await database.message.count({ where: { conversationId: conversation.id } });
  await enqueue({
    type: "chat_followup",
    tenantId: input.tenantId,
    payload: { conversationId: conversation.id, attempt: 1 },
    runAt: addMinutes(new Date(), 4 * 60),
    idempotencyKey: `followup:${conversation.id}:${messageCount}`,
  });

  return {
    reply: message.body,
    handoff: false,
    intent,
    sources: chunks.map((chunk) => chunk.title),
    agentRunId: run.id,
  };
}

async function handoff(input: {
  tenantId: string;
  conversationId: string;
  contactPhone: string;
  businessName: string;
  reason: string;
  lang: "en" | "hi";
}) {
  const database = db(input.tenantId);
  const body =
    input.lang === "hi"
      ? `मैं इसकी पुष्टि नहीं कर सकता। हमारी टीम से बात करने के लिए कृपया थोड़ी प्रतीक्षा करें — ${input.businessName} से कोई जल्द संपर्क करेगा।`
      : `I don't want to give you the wrong information. I've asked the team at ${input.businessName} to reply here — they'll be with you shortly.`;

  const message = await sendWhatsAppMessage({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    contactPhone: input.contactPhone,
    body,
    role: "system",
  });
  await database.conversation.update({
    where: { id: input.conversationId },
    data: { aiPaused: true, handoffReason: input.reason, status: "open" },
  });
  const run = await logAgentRun({
    tenantId: input.tenantId,
    agent: "chat",
    action: "chat.handoff",
    input: { reason: input.reason },
    output: { reply: body },
    requiresApproval: false,
  });
  await logAudit({
    tenantId: input.tenantId,
    actorType: "ai",
    action: "chat.handoff",
    target: input.conversationId,
    meta: { reason: input.reason },
  });
  return {
    reply: message.body,
    handoff: true,
    intent: "enquiry" as ChatIntent,
    sources: [] as string[],
    agentRunId: run.id as string | null,
  };
}
