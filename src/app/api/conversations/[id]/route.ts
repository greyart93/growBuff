import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { aiPaused?: boolean };
  if (typeof body.aiPaused !== "boolean") {
    return NextResponse.json({ error: "aiPaused must be a boolean" }, { status: 400 });
  }

  const updated = await db(session.tenantId).conversation.update({
    where: { id },
    data: {
      aiPaused: body.aiPaused,
      handoffReason: body.aiPaused ? "Paused by owner" : null,
      unread: 0,
    },
  });
  await logAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    actorType: "user",
    action: body.aiPaused ? "chat.ai_paused" : "chat.ai_resumed",
    target: id,
  });
  return NextResponse.json({ ok: true, aiPaused: updated.aiPaused });
}
