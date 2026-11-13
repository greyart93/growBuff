import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendWhatsAppMessage, WhatsAppApiError, WhatsAppWindowClosedError } from "@/lib/adapters/whatsapp";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });

  const database = db(session.tenantId);
  const conversation = await database.conversation.findFirst({
    where: { id },
    include: { contact: true },
  });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let message;
  try {
    message = await sendWhatsAppMessage({
      tenantId: session.tenantId,
      conversationId: conversation.id,
      contactPhone: conversation.contact.phone,
      body: text,
      role: "agent",
    });
  } catch (error) {
    if (error instanceof WhatsAppWindowClosedError) {
      return NextResponse.json({ error: error.message, code: "window_closed" }, { status: 409 });
    }
    if (error instanceof WhatsAppApiError) {
      return NextResponse.json(
        { error: error.message, code: "whatsapp_api_error", retryable: error.retryable },
        { status: 502 }
      );
    }
    throw error;
  }

  // Human takeover pauses the AI for this conversation.
  await database.conversation.update({
    where: { id: conversation.id },
    data: { aiPaused: true, handoffReason: null },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      direction: message.direction,
      role: message.role,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
      groundedSources: message.groundedSources,
    },
  });
}
