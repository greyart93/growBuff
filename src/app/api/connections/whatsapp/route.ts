import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

const graphVersion = () => process.env.WHATSAPP_API_VERSION || "v21.0";

const idSchema = z
  .string()
  .trim()
  .regex(/^\d{5,30}$/, "Use the numeric Meta ID (5–30 digits)");

const saveSchema = z.object({
  action: z.literal("save").default("save"),
  phoneNumberId: idSchema,
  wabaId: idSchema,
  accessToken: z.string().max(4096).optional().default(""),
  appSecret: z.string().max(512).optional().default(""),
  verifyToken: z.string().max(512).optional().default(""),
});

const testSchema = z.object({ action: z.literal("test") });

type MetaErrorPayload = {
  error?: { message?: string; error_user_msg?: string; code?: number; type?: string };
};

type MetaProfile = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

async function metaGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as T & MetaErrorPayload;
  if (!response.ok) {
    throw new Error(
      payload.error?.error_user_msg ||
        payload.error?.message ||
        `Meta rejected the credentials (HTTP ${response.status})`
    );
  }
  return payload;
}

async function loadProfile(token: string, phoneNumberId: string) {
  return metaGet<MetaProfile>(
    token,
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`
  );
}

async function loadAccount(token: string, wabaId: string) {
  return metaGet<{ id?: string; name?: string }>(token, `${wabaId}?fields=id,name`);
}

function safeConnection(input: {
  status: string;
  displayName: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhoneNumber: string | null;
  qualityRating: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
}) {
  return { ...input, mode: "live" as const };
}

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const database = db(session.tenantId);
  const existing = await database.connection.findFirst({ where: { provider: "whatsapp" } });
  const existingMeta = (existing?.meta ?? {}) as {
    phoneNumberId?: string;
    wabaId?: string;
    displayPhoneNumber?: string;
    qualityRating?: string;
  };

  try {
    if (body.action === "test") {
      const parsed = testSchema.safeParse(body);
      if (!parsed.success) throw new Error("Invalid test request");
      if (!existing) throw new Error("Save live WhatsApp credentials first.");
      const token = decrypt(existing?.accessTokenEnc) ?? process.env.WHATSAPP_ACCESS_TOKEN ?? "";
      const phoneNumberId =
        existingMeta.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
      if (!token || !phoneNumberId) throw new Error("Save live WhatsApp credentials first.");

      const profile = await loadProfile(token, phoneNumberId);
      const updated = await database.connection.update({
        where: { id: existing!.id },
        data: {
          status: "connected",
          displayName:
            profile.verified_name ??
            existing?.displayName ??
            `WhatsApp ${profile.display_phone_number ?? phoneNumberId}`,
          meta: {
            ...(existingMeta as object),
            phoneNumberId,
            displayPhoneNumber: profile.display_phone_number ?? existingMeta.displayPhoneNumber ?? null,
            qualityRating: profile.quality_rating ?? existingMeta.qualityRating ?? null,
            lastCheckedAt: new Date().toISOString(),
          },
        },
      });
      await logAudit({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        actorType: "user",
        action: "whatsapp.connection_tested",
        target: updated.id,
        meta: { phoneNumberId, qualityRating: profile.quality_rating ?? null },
      });
      return NextResponse.json({
        ok: true,
        connection: safeConnection({
          status: updated.status,
          displayName: updated.displayName,
          phoneNumberId,
          wabaId: existingMeta.wabaId ?? null,
          displayPhoneNumber: profile.display_phone_number ?? null,
          qualityRating: profile.quality_rating ?? null,
          hasAccessToken: Boolean(updated.accessTokenEnc),
          hasAppSecret: Boolean(updated.appSecretEnc) || Boolean(process.env.WHATSAPP_APP_SECRET),
          hasVerifyToken: Boolean(updated.verifyTokenEnc) || Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        }),
      });
    }

    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Enter the Meta phone number and WABA IDs.");
    }
    const input = parsed.data;

    const accessToken =
      clean(input.accessToken) ||
      decrypt(existing?.accessTokenEnc) ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      "";
    const appSecret =
      clean(input.appSecret) ||
      decrypt(existing?.appSecretEnc) ||
      process.env.WHATSAPP_APP_SECRET ||
      "";
    const verifyToken =
      clean(input.verifyToken) ||
      decrypt(existing?.verifyTokenEnc) ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      "";

    if (!accessToken) throw new Error("Enter a Meta access token.");
    if (!appSecret) throw new Error("Enter the Meta app secret.");
    if (!verifyToken) throw new Error("Choose a webhook verify token.");

    // Validate both the sending number and the WABA before saving anything.
    const [profile, account] = await Promise.all([
      loadProfile(accessToken, input.phoneNumberId),
      loadAccount(accessToken, input.wabaId),
    ]);

    const meta = {
      ...(existingMeta as object),
      mode: "live",
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      displayPhoneNumber: profile.display_phone_number ?? null,
      qualityRating: profile.quality_rating ?? null,
      verifiedName: profile.verified_name ?? null,
      wabaName: account.name ?? null,
      apiVersion: graphVersion(),
      connectedAt: new Date().toISOString(),
    };

    const connection = await database.connection.upsert({
      where: { tenantId_provider: { tenantId: session.tenantId, provider: "whatsapp" } },
      create: {
        tenantId: session.tenantId,
        provider: "whatsapp",
        status: "connected",
        externalId: input.wabaId,
        displayName: profile.verified_name ?? `WhatsApp ${profile.display_phone_number ?? input.phoneNumberId}`,
        accessTokenEnc: encrypt(accessToken),
        appSecretEnc: encrypt(appSecret),
        verifyTokenEnc: encrypt(verifyToken),
        meta,
      },
      update: {
        status: "connected",
        externalId: input.wabaId,
        displayName: profile.verified_name ?? `WhatsApp ${profile.display_phone_number ?? input.phoneNumberId}`,
        accessTokenEnc: encrypt(accessToken),
        appSecretEnc: encrypt(appSecret),
        verifyTokenEnc: encrypt(verifyToken),
        meta,
      },
    });

    await logAudit({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      actorType: "user",
      action: "whatsapp.live_configured",
      target: connection.id,
      meta: {
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        displayPhoneNumber: profile.display_phone_number ?? null,
        verifyTokenStored: Boolean(connection.verifyTokenEnc),
      },
    });

    return NextResponse.json({
      ok: true,
      connection: safeConnection({
        status: connection.status,
        displayName: connection.displayName,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        displayPhoneNumber: profile.display_phone_number ?? null,
        qualityRating: profile.quality_rating ?? null,
        hasAccessToken: true,
        hasAppSecret: true,
        hasVerifyToken: true,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not validate these Meta credentials." },
      { status: 400 }
    );
  }
}
