import { notFound } from "next/navigation";
import { requireTenant, localeForRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChatThread } from "@/components/inbox/chat-thread";
import { getSessionWindow } from "@/lib/adapters/whatsapp";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireTenant();
  const locale = await localeForRequest();
  const conversation = await db(session.tenantId).conversation.findFirst({
    where: { id },
    include: { contact: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();
  const sessionWindow = await getSessionWindow(session.tenantId, conversation.id);

  return (
    <ChatThread
      conversationId={conversation.id}
      contactName={conversation.contact.name ?? conversation.contact.phone}
      phone={conversation.contact.phone}
      aiPaused={conversation.aiPaused}
      handoffReason={conversation.handoffReason}
      locale={locale}
      windowExpiresAt={sessionWindow.expiresAt?.toISOString() ?? null}
      initialMessages={conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        role: message.role,
        body: message.body,
        status: message.status,
        error: message.error,
        createdAt: message.createdAt.toISOString(),
        groundedSources: message.groundedSources,
      }))}
    />
  );
}
