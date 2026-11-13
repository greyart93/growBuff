import { NextResponse } from "next/server";
import { apiSession, normalizePhone } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleInboundMessage } from "@/lib/ai/agents/chat";
import { randomToken } from "@/lib/crypto";

export async function GET() {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = await db(session.tenantId).conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: { contact: true },
    take: 50,
  });
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    message?: string;
  };
  const text = (body.message ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write a message" }, { status: 400 });

  const phone = normalizePhone(body.phone ?? "") ?? `+9199${Date.now().toString().slice(-8)}`;
  const database = db(session.tenantId);

  let contact = await database.contact.findFirst({ where: { phone } });
  if (!contact) {
    contact = await database.contact.create({
      data: {
        tenantId: session.tenantId,
        phone,
        name: body.name?.trim() || `Customer ${phone.slice(-4)}`,
        source: "chat",
        optIn: true,
        optInAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  let conversation = await database.conversation.findFirst({ where: { contactId: contact.id } });
  if (!conversation) {
    conversation = await database.conversation.create({
      data: {
        tenantId: session.tenantId,
        contactId: contact.id,
        lastMessagePreview: text.slice(0, 120),
      },
    });
  }

  const inbound = await database.conversation.findFirst({ where: { id: conversation.id } });
  if (!inbound) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  await database.message.create({
    data: {
      tenantId: session.tenantId,
      conversationId: conversation.id,
      direction: "in",
      role: "customer",
      body: text,
      status: "delivered",
      waMessageId: `wamid.mock.in.${randomToken(6)}`,
    },
  });
  await database.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 120) },
  });
  await database.contact.update({ where: { id: contact.id }, data: { lastSeenAt: new Date() } });

  if (!conversation.aiPaused) {
    await handleInboundMessage({
      tenantId: session.tenantId,
      conversationId: conversation.id,
      text,
    });
  }

  return NextResponse.json({ conversationId: conversation.id });
}
