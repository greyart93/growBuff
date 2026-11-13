import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/usage";
import { createCheckout, gstBreakup, invoiceNumber } from "@/lib/adapters/payments";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { planId?: string };
  const plan = PLANS.find((item) => item.id === body.planId);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  try {
    const checkout = await createCheckout({
      tenantId: session.tenantId,
      planId: plan.id,
      pricePaise: plan.pricePaise,
      agent: plan.agent,
    });

    const database = db(session.tenantId);
    const renewsAt = new Date(Date.now() + 30 * 86400_000);
    await database.subscription.upsert({
      where: { tenantId_agent: { tenantId: session.tenantId, agent: plan.agent } },
      create: {
        tenantId: session.tenantId,
        agent: plan.agent,
        plan: plan.name,
        status: "active",
        pricePaise: plan.pricePaise,
        gateway: checkout.provider,
        gatewayRef: checkout.reference,
        renewsAt,
      },
      update: {
        status: "active",
        plan: plan.name,
        pricePaise: plan.pricePaise,
        gateway: checkout.provider,
        gatewayRef: checkout.reference,
        renewsAt,
      },
    });

    const totals = gstBreakup(plan.pricePaise);
    await database.invoice.create({
      data: {
        tenantId: session.tenantId,
        number: invoiceNumber(),
        amountPaise: totals.amountPaise,
        gstPaise: totals.gstPaise,
        totalPaise: totals.totalPaise,
        status: "paid",
        periodStart: new Date(),
        periodEnd: renewsAt,
      },
    });

    await logAudit({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      actorType: "user",
      action: "billing.subscribed",
      target: plan.agent,
      meta: { plan: plan.id, totalPaise: totals.totalPaise, gateway: checkout.provider },
    });

    return NextResponse.json({ ok: true, url: checkout.url, renewsAt });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
