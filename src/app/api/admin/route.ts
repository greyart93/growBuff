import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiSession, TENANT_COOKIE } from "@/lib/auth";
import { unscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; tenantId?: string };
  const store = await cookies();

  if (body.action === "exit") {
    store.delete(TENANT_COOKIE);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "impersonate" || !body.tenantId) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const tenant = await unscoped.tenant.findUnique({ where: { id: body.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  store.set(TENANT_COOKIE, tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3600,
  });

  await logAudit({
    tenantId: tenant.id,
    actorUserId: session.userId,
    actorType: "admin",
    action: "admin.impersonation_started",
    target: tenant.id,
    meta: { tenantName: tenant.name },
  });

  return NextResponse.json({ ok: true });
}
