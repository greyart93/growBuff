import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTenant, verifyOtp } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const schema = z.object({ phone: z.string().min(6), code: z.string().min(4).max(8) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const user = await verifyOtp(parsed.data.phone, parsed.data.code);
    const tenant = await hasTenant(user.id);
    await logAudit({ actorUserId: user.id, actorType: "user", action: "auth.login", target: user.id });
    return NextResponse.json({ ok: true, hasTenant: tenant });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
