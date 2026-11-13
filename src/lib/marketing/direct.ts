import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/adapters/whatsapp";

export async function sendDirectMessage(input: {
  tenantId: string;
  contactId: string;
  body: string;
  templateName?: string;
  templateParams?: Array<string | number>;
  role?: "ai" | "agent" | "system";
}) {
  const database = db(input.tenantId);
  const contact = await database.contact.findFirst({ where: { id: input.contactId } });
  if (!contact || !contact.optIn) return { skipped: true as const };

  let conversation = await database.conversation.findFirst({ where: { contactId: contact.id } });
  if (!conversation) {
    conversation = await database.conversation.create({
      data: {
        tenantId: input.tenantId,
        contactId: contact.id,
        lastMessagePreview: input.body.slice(0, 120),
      },
    });
  }

  const message = await sendWhatsAppMessage({
    tenantId: input.tenantId,
    conversationId: conversation.id,
    contactPhone: contact.phone,
    body: input.body,
    role: input.role ?? "system",
    templateName: input.templateName,
    templateParams: input.templateParams,
  });

  await database.contact.update({ where: { id: contact.id }, data: { lastSeenAt: new Date() } });
  return { skipped: false as const, message, conversationId: conversation.id };
}
