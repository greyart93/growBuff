import { headers } from "next/headers";
import { CheckCircle2, Link2Off } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { asFaqs, asHours, asServices } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { ConnectButton } from "@/components/settings/connect-button";
import { WhatsAppSetup } from "@/components/settings/whatsapp-setup";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [business, connections] = await Promise.all([
    database.business.findFirst(),
    database.connection.findMany(),
  ]);

  const whatsapp = connections.find((connection) => connection.provider === "whatsapp");
  const whatsappMeta = (whatsapp?.meta ?? {}) as {
    mode?: string;
    phoneNumberId?: string;
    wabaId?: string;
    displayPhoneNumber?: string;
    qualityRating?: string;
  };
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const webhookUrl = `${protocol}://${host}/api/webhooks/whatsapp`;
  const whatsappSetup = {
    status: whatsapp?.status ?? "disconnected",
    displayName: whatsapp?.displayName ?? null,
    phoneNumberId: whatsappMeta.phoneNumberId ?? null,
    wabaId: whatsappMeta.wabaId ?? null,
    displayPhoneNumber: whatsappMeta.displayPhoneNumber ?? null,
    qualityRating: whatsappMeta.qualityRating ?? null,
    hasAccessToken: Boolean(whatsapp?.accessTokenEnc),
    hasAppSecret: Boolean(whatsapp?.appSecretEnc) || Boolean(process.env.WHATSAPP_APP_SECRET),
    hasVerifyToken: Boolean(whatsapp?.verifyTokenEnc) || Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    liveMode:
      process.env.MOCK_INTEGRATIONS === "false" ||
      (whatsappMeta.mode === "live" && Boolean(whatsapp?.accessTokenEnc)),
  };

  const providers = [
    { id: "google_business", name: "Google Business Profile" },
    { id: "whatsapp", name: "WhatsApp Business" },
    { id: "google_calendar", name: "Google Calendar" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Business facts, connections and agent behaviour.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.map((provider) => {
            const connection = connections.find((item) => item.provider === provider.id);
            const connected = connection?.status === "connected";
            return (
              <div key={provider.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    connected ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {connected ? <CheckCircle2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{provider.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connected ? connection?.displayName ?? "Connected (sandbox)" : "Not connected"}
                  </p>
                </div>
                {connected ? (
                  <Badge tone={provider.id === "whatsapp" && !whatsappSetup.hasAccessToken ? "muted" : "success"}>
                    {provider.id === "whatsapp" && !whatsappSetup.hasAccessToken ? "sandbox" : "on"}
                  </Badge>
                ) : provider.id === "whatsapp" ? (
                  <Badge tone="muted">set up below</Badge>
                ) : (
                  <ConnectButton provider={provider.id} />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live WhatsApp setup</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppSetup setup={whatsappSetup} webhookUrl={webhookUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            business={
              business
                ? {
                    name: business.name,
                    category: business.category,
                    city: business.city,
                    address: business.address ?? "",
                    phone: business.phone ?? "",
                    website: business.website ?? "",
                    description: business.description ?? "",
                    brandTone: business.brandTone,
                    languages: business.languages,
                    autoReplyReviews: business.autoReplyReviews,
                    hours: asHours(business.hours),
                    services: asServices(business.services),
                    faqCount: asFaqs(business.faqs).length,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <p>• Marketing messages go only to opted-in customers, with a STOP opt-out on every template.</p>
          <p>• Business-initiated messages outside the 24-hour window use Meta-approved templates.</p>
          <p>• OAuth and WhatsApp tokens are encrypted with AES-256-GCM before storage.</p>
          <p>• AI actions, handoffs and admin access are written to an immutable audit log.</p>
        </CardContent>
      </Card>
    </div>
  );
}
