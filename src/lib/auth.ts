import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unscoped } from "@/lib/db";
import { generateOtp, hashOtp, randomToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "gb_session";
export const TENANT_COOKIE = "gb_tenant";
const SESSION_DAYS = 30;

export type SessionContext = {
  userId: string;
  user: { id: string; name: string | null; phone: string | null; email: string | null; isAdmin: boolean; locale: string };
  tenantId: string;
  tenantName: string;
  role: string;
  businessName: string | null;
  businessId: string | null;
};

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await unscoped.session.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await unscoped.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Request a phone OTP. In mock mode the code is returned so the UI can show it;
 * with a real SMS provider wired up this returns null and the code is sent.
 */
export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Enter a valid phone number");
  const code = generateOtp();
  await unscoped.otpCode.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  const mock = process.env.MOCK_INTEGRATIONS !== "false" || process.env.NODE_ENV !== "production";
  return { phone, devCode: mock ? code : null };
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Enter a valid phone number");
  const latest = await unscoped.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) throw new Error("Request a new code");
  if (latest.expiresAt < new Date()) throw new Error("Code expired, request a new one");
  if (latest.attempts >= 5) throw new Error("Too many attempts, request a new code");
  if (hashOtp(phone, code.trim()) !== latest.codeHash) {
    await unscoped.otpCode.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
    throw new Error("Incorrect code");
  }
  await unscoped.otpCode.update({ where: { id: latest.id }, data: { consumedAt: new Date() } });

  let user = await unscoped.user.findFirst({ where: { phone } });
  if (!user) {
    user = await unscoped.user.create({ data: { phone, name: phone.slice(-10) } });
  }
  await createSession(user.id);
  return user;
}

export async function mockGoogleLogin(email: string, name?: string) {
  let user = await unscoped.user.findFirst({ where: { email } });
  if (!user) {
    user = await unscoped.user.create({
      data: { email, name: name || email.split("@")[0], phone: null },
    });
  }
  await createSession(user.id);
  return user;
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await unscoped.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: { tenant: { include: { business: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const preferredTenant = store.get(TENANT_COOKIE)?.value;
  const memberships = session.user.memberships;
  const membership =
    memberships.find((m) => m.tenantId === preferredTenant) ?? memberships[0] ?? null;

  return {
    userId: session.user.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      phone: session.user.phone,
      email: session.user.email,
      isAdmin: session.user.isAdmin,
      locale: session.user.locale,
    },
    tenantId: membership?.tenantId ?? "",
    tenantName: membership?.tenant.name ?? "",
    role: membership?.role ?? "owner",
    businessName: membership?.tenant.business?.name ?? null,
    businessId: membership?.tenant.business?.id ?? null,
  };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireTenant(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.tenantId) redirect("/onboarding");
  return session;
}

/** For route handlers: returns null instead of redirecting. */
export async function apiSession(): Promise<SessionContext | null> {
  return getSession();
}

export async function hasTenant(userId: string) {
  const membership = await unscoped.membership.findFirst({ where: { userId } });
  return Boolean(membership);
}

export async function localeForRequest() {
  const store = await cookies();
  return store.get("gb_locale")?.value === "hi" ? "hi" : "en";
}
