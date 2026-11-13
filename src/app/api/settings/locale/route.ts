import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiSession } from "@/lib/auth";
import { unscoped } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const locale = body.locale === "hi" ? "hi" : "en";
  const store = await cookies();
  store.set("gb_locale", locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });

  const session = await apiSession();
  if (session) {
    await unscoped.user.update({ where: { id: session.userId }, data: { locale } });
  }
  return NextResponse.json({ ok: true, locale });
}
