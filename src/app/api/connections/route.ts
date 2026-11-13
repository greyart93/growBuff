import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { simulateOAuth } from "@/lib/adapters/google";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  const provider = body.provider;
  if (!provider || !["google_business", "whatsapp", "google_calendar"].includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (process.env.MOCK_INTEGRATIONS === "false") {
    return NextResponse.json(
      { error: "Live OAuth is not configured. Add Google/Meta credentials to enable it." },
      { status: 501 }
    );
  }

  const connection = await simulateOAuth(provider as "google_business", session.tenantId);
  await logAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    actorType: "user",
    action: "connection.sandbox_connected",
    target: provider,
  });
  return NextResponse.json({ ok: true, provider: connection.provider });
}
