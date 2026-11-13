import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUTOMATION_TYPES } from "@/lib/marketing/constants";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { type?: string; enabled?: boolean };
  const type = AUTOMATION_TYPES.find((item) => item.type === body.type);
  if (!type) return NextResponse.json({ error: "Unknown automation" }, { status: 400 });

  const database = db(session.tenantId);
  const automation = await database.automation.upsert({
    where: { tenantId_type: { tenantId: session.tenantId, type: type.type } },
    create: {
      tenantId: session.tenantId,
      type: type.type,
      name: type.name,
      enabled: Boolean(body.enabled),
      config: { delayHours: 24 },
    },
    update: { enabled: Boolean(body.enabled) },
  });

  await logAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    actorType: "user",
    action: "automation.toggled",
    target: automation.id,
    meta: { type: automation.type, enabled: automation.enabled },
  });

  return NextResponse.json({ automation });
}
