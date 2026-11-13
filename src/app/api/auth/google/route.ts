import { NextResponse } from "next/server";
import { hasTenant, mockGoogleLogin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Sandbox Google sign-in. Production replaces this with Google OAuth
 * (authorization code + PKCE) and links the GBP scopes.
 */
export async function POST(request: Request) {
  try {
    if (process.env.MOCK_INTEGRATIONS === "false") {
      return NextResponse.json(
        { error: "Live Google OAuth is not configured in this deployment" },
        { status: 501 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "owner@gmail.com";
    const name = typeof body.name === "string" ? body.name : "Google Owner";
    const user = await mockGoogleLogin(email, name);
    await logAudit({ actorUserId: user.id, actorType: "user", action: "auth.google_sandbox", target: user.id });
    return NextResponse.json({ ok: true, hasTenant: await hasTenant(user.id) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
