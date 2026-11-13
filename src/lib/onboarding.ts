import { db } from "@/lib/db";
import { reindexDocument } from "@/lib/ai/rag";
import { asFaqs, asHours, asServices } from "@/lib/types";
import type { Business } from "@prisma/client";

export function knowledgeDocsFor(business: Business) {
  const services = asServices(business.services);
  const hours = asHours(business.hours);
  const faqs = asFaqs(business.faqs);
  const openHours = Object.entries(hours)
    .map(([day, config]) => `${day}: ${config.closed ? "closed" : `${config.open}–${config.close}`}`)
    .join(", ");

  const docs: Array<{ title: string; source: string; content: string; keywords: string[] }> = [
    {
      title: "About the business",
      source: "onboarding",
      keywords: [business.name.toLowerCase(), business.category.toLowerCase(), business.city.toLowerCase()],
      content: `${business.name} is a ${business.category.toLowerCase()} in ${business.city}. ${
        business.description ?? ""
      }\n\nAddress: ${business.address ?? business.city}. Phone: ${business.phone ?? "shared on request"}. Website: ${
        business.website ?? "not listed"
      }. Languages spoken: ${business.languages.join(", ")}.`,
    },
    {
      title: "Services and prices",
      source: "onboarding",
      keywords: ["price", "cost", "service", "fee", ...services.map((service) => service.name.toLowerCase())],
      content: services.length
        ? `${business.name} services:\n${services
            .map(
              (service) =>
                `- ${service.name}: ₹${(service.pricePaise / 100).toLocaleString("en-IN")}, about ${service.durationMin} minutes.`
            )
            .join("\n")}\n\nPayment is collected at the business. Ask about the current month's packages rather than assuming a discount is active.`
        : "Service prices are confirmed by the team before booking.",
    },
    {
      title: "Timings and location",
      source: "onboarding",
      keywords: ["hours", "open", "timing", "location", "address", "directions", "parking"],
      content: `${business.name} is open ${openHours}. Address: ${business.address ?? business.city}. Timezone: ${
        business.timezone
      }. Please arrive 10 minutes before your first appointment.`,
    },
    {
      title: "Frequently asked questions",
      source: "onboarding",
      keywords: ["faq", "question", "help"],
      content: faqs.length
        ? faqs.map((faq) => `Q: ${faq.q}\nA: ${faq.a}`).join("\n\n")
        : "The team answers questions individually on WhatsApp.",
    },
    {
      title: "Safety and policies",
      source: "onboarding",
      keywords: ["policy", "cancellation", "safety", "medical", "legal", "refund"],
      content: `We never diagnose or prescribe over WhatsApp, and never guarantee an outcome. Any medical, dental, legal or emergency question is handed to the team. Appointments can be rescheduled up to 4 hours before the start time. In an emergency please call the business directly or visit the nearest hospital.`,
    },
  ];
  return docs;
}

/** Regenerates the onboarding knowledge base and re-embeds every chunk. */
export async function generateKnowledgeBase(tenantId: string) {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");

  await database.knowledgeDoc.deleteMany({ where: { source: { in: ["onboarding", "faq"] } } });

  let chunks = 0;
  for (const doc of knowledgeDocsFor(business)) {
    if (!doc.content.trim()) continue;
    const created = await database.knowledgeDoc.create({
      data: {
        tenantId,
        title: doc.title,
        source: doc.source === "faq" ? "faq" : "onboarding",
        content: doc.content,
      },
    });
    chunks += await reindexDocument(tenantId, created.id, doc.content, doc.keywords);
  }

  await database.business.update({
    where: { id: business.id },
    data: { onboardingStep: 4, completedAt: business.completedAt ?? new Date() },
  });

  return { docs: 5, chunks };
}
