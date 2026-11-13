import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const hoursSchema = z.record(
  z.string(),
  z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })
);

const schema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  website: z.string().optional().default(""),
  description: z.string().optional().default(""),
  brandTone: z.string().default("friendly"),
  languages: z.array(z.string()).min(1),
  autoReplyReviews: z.boolean().default(false),
  hours: hoursSchema,
  services: z.array(z.any()).default([]),
  faqCount: z.number().optional(),
});

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const input = parsed.data;
  const database = db(session.tenantId);
  const business = await database.business.findFirst();
  if (!business) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  await database.business.update({
    where: { id: business.id },
    data: {
      name: input.name,
      category: input.category,
      city: input.city,
      address: input.address,
      phone: input.phone,
      website: input.website,
      description: input.description,
      brandTone: input.brandTone,
      languages: input.languages,
      autoReplyReviews: input.autoReplyReviews,
      hours: input.hours,
    },
  });

  await logAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    actorType: "user",
    action: "settings.updated",
    target: business.id,
  });

  return NextResponse.json({ ok: true });
}
