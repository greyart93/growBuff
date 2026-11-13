import { db, unscoped } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { asHours, asServices, asFaqs } from "@/lib/types";

export const MOCK = process.env.MOCK_INTEGRATIONS !== "false";

export type GbpLocation = {
  name: string;
  address: string;
  category: string;
  connected: boolean;
  mode: "mock" | "live";
};

/** Returns the connected Google Business Profile location (mock when not linked). */
export async function getLocation(tenantId: string): Promise<GbpLocation | null> {
  const business = await db(tenantId).business.findFirst();
  if (!business) return null;
  const connection = await db(tenantId).connection.findFirst({ where: { provider: "google_business" } });
  return {
    name: business.name,
    address: business.address ?? business.city,
    category: business.category,
    connected: connection?.status === "connected",
    mode: MOCK ? "mock" : "live",
  };
}

/**
 * Publish a Google Business Profile local post. Mock mode returns a synthetic
 * resource name; live mode calls the GBP v4 localPosts endpoint.
 */
export async function publishGbpPost(tenantId: string, input: { title: string; body: string; imageUrl?: string | null }) {
  if (MOCK) {
    return { externalId: `accounts/mock/locations/mock/localPosts/${Date.now()}`, mode: "mock" as const };
  }

  const connection = await db(tenantId).connection.findFirst({ where: { provider: "google_business" } });
  const token = decrypt(connection?.accessTokenEnc);
  const locationName = connection?.externalId;
  if (!token || !locationName) throw new Error("Google Business Profile is not connected");

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        languageCode: "en",
        summary: `${input.title}\n\n${input.body}`.slice(0, 1500),
        media: input.imageUrl
          ? [{ mediaFormat: "PHOTO", sourceUrl: input.imageUrl }]
          : undefined,
        topicType: "STANDARD",
      }),
    }
  );
  const payload = (await response.json()) as { name?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `GBP API ${response.status}`);
  return { externalId: payload.name ?? null, mode: "live" as const };
}

export async function listGbpReviews(tenantId: string) {
  const connection = await db(tenantId).connection.findFirst({ where: { provider: "google_business" } });
  if (MOCK || !connection) {
    return db(tenantId).gbpReview.findMany({ orderBy: { reviewedAt: "desc" } });
  }
  const token = decrypt(connection.accessTokenEnc) ?? process.env.GOOGLE_PLACES_API_KEY;
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${connection.externalId}/reviews`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Could not load Google reviews");
  return response.json();
}

/** Replies to a review. Mock mode just returns ok. */
export async function replyToGbpReview(tenantId: string, reviewId: string, reply: string) {
  const connection = await db(tenantId).connection.findFirst({ where: { provider: "google_business" } });
  const review = await db(tenantId).gbpReview.findFirst({ where: { id: reviewId } });
  if (!review) throw new Error("Review not found");

  if (MOCK || !connection) return { ok: true, mode: "mock" as const };

  const token = decrypt(connection.accessTokenEnc);
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${connection.externalId}/reviews/${review.externalId}/reply`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ comment: reply }),
    }
  );
  if (!response.ok) throw new Error("Google rejected the reply");
  return { ok: true, mode: "live" as const };
}

/** Simulated profile payload used by the audit when no live GBP is connected. */
export function profileFacts(business: {
  description: string | null;
  hours: unknown;
  services: unknown;
  faqs: unknown;
  languages: string[];
  website: string | null;
  category: string;
}) {
  const hours = asHours(business.hours);
  const services = asServices(business.services);
  const faqs = asFaqs(business.faqs);
  return { hours, services, faqs, hasDescription: Boolean(business.description), hasWebsite: Boolean(business.website), languages: business.languages };
}

export async function simulateOAuth(provider: "google_business" | "whatsapp" | "google_calendar", tenantId: string) {
  const { encrypt } = await import("@/lib/crypto");
  const externalId =
    provider === "whatsapp" ? `mock_waba_${tenantId.slice(-6)}` : `accounts/mock/locations/${tenantId.slice(-6)}`;
  const data = {
    status: "connected",
    externalId,
    meta:
      provider === "whatsapp"
        ? {
            mode: "mock",
            wabaId: `mock_waba_${tenantId.slice(-6)}`,
            phoneNumberId: `mock_phone_${tenantId.slice(-6)}`,
            qualityRating: "GREEN",
          }
        : { mode: "mock" },
    displayName:
      provider === "whatsapp"
        ? "WhatsApp Business (sandbox)"
        : provider === "google_business"
          ? "Google Business Profile (sandbox)"
          : "Google Calendar (sandbox)",
    accessTokenEnc: encrypt(`mock_access_${provider}_${tenantId}`),
    refreshTokenEnc: encrypt(`mock_refresh_${provider}`),
  };
  return unscoped.connection.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: { tenantId, provider, ...data },
    update: data,
  });
}
