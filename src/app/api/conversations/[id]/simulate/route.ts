import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleInboundMessage } from "@/lib/ai/agents/chat";
import { randomToken } from "@/lib/crypto";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });

  const database = db(session.tenantId);
  const conversation = await database.conversation.findFirst({ where: { id } });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const inbound = await database.message.create({
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
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: text.slice(0, 120),
      unread: 0,
    },
  });

  const messages = [
    {
      id: inbound.id,
      direction: "in",
      role: "customer",
      body: inbound.body,
      createdAt: inbound.createdAt.toISOString(),
      groundedSources: [] as string[],
    },
  ];

  let handoff = false;
  if (!conversation.aiPaused) {
    const result = await handleInboundMessage({
      tenantId: session.tenantId,
      conversationId: conversation.id,
      text,
    });
    handoff = result.handoff;
    const outbound = await database.message.findFirst({
      where: { conversationId: conversation.id, direction: "out" },
      orderBy: { createdAt: "desc" },
    });
    if (outbound) {
      messages.push({
        id: outbound.id,
        direction: "out",
        role: outbound.role,
        body: outbound.body,
        createdAt: outbound.createdAt.toISOString(),
        groundedSources: outbound.groundedSources,
      });
    }
  }

  return NextResponse.json({ messages, handoff });
}
