import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { unscoped, db } from "@/lib/db";
import { generateKnowledgeBase } from "@/lib/onboarding";
import { simulateOAuth } from "@/lib/adapters/google";
import { logAudit } from "@/lib/audit";

const serviceSchema = z.object({
  name: z.string().min(1),
  pricePaise: z.number().int().min(0),
  durationMin: z.number().int().min(5).max(480),
});

const schema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  website: z.string().optional().default(""),
  description: z.string().optional().default(""),
  brandTone: z.string().default("friendly"),
  languages: z.array(z.string()).default(["en"]),
  hours: z.record(
    z.string(),
    z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })
  ),
  services: z.array(serviceSchema).default([]),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  connectGoogle: z.boolean().default(false),
  connectWhatsapp: z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the details" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  let tenantId = session.tenantId;
  if (!tenantId) {
    const tenant = await unscoped.tenant.create({
      data: {
        name: input.name,
        memberships: { create: { userId: session.userId, role: "owner" } },
      },
    });
    tenantId = tenant.id;
  }

  await db(tenantId).business.upsert({
    where: { tenantId },
    create: {
      tenantId,
      name: input.name,
      category: input.category,
      city: input.city,
      address: input.address,
      phone: input.phone,
      website: input.website,
      description: input.description,
      brandTone: input.brandTone,
      languages: input.languages,
      hours: input.hours,
      services: input.services,
      faqs: input.faqs,
    },
    update: {
      name: input.name,
      category: input.category,
      city: input.city,
      address: input.address,
      phone: input.phone,
      website: input.website,
      description: input.description,
      brandTone: input.brandTone,
      languages: input.languages,
      hours: input.hours,
      services: input.services,
      faqs: input.faqs,
    },
  });

  if (input.connectGoogle) await simulateOAuth("google_business", tenantId);
  if (input.connectWhatsapp) await simulateOAuth("whatsapp", tenantId);

  const knowledge = await generateKnowledgeBase(tenantId);

  await logAudit({
    tenantId,
    actorUserId: session.userId,
    actorType: "user",
    action: "onboarding.completed",
    target: tenantId,
    meta: { knowledge },
  });

  return NextResponse.json({ ok: true, tenantId, knowledge });
}
