"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  PlugZap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

type Setup = {
  status: string;
  displayName: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhoneNumber: string | null;
  qualityRating: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  liveMode: boolean;
};

export function WhatsAppSetup({ setup, webhookUrl }: { setup: Setup; webhookUrl: string }) {
  const router = useRouter();
  const configured = setup.hasAccessToken && setup.hasAppSecret && setup.hasVerifyToken;
  const [editing, setEditing] = useState(!configured);
  const [phoneNumberId, setPhoneNumberId] = useState(setup.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(setup.wabaId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "save" | "test") {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/connections/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "save"
            ? { phoneNumberId, wabaId, accessToken, appSecret, verifyToken }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not validate WhatsApp credentials.");
      setAccessToken("");
      setAppSecret("");
      setVerifyToken("");
      setEditing(false);
      setMessage(
        action === "test"
          ? `Connected. Meta reports ${data.connection?.displayName ?? "this number"} is reachable.`
          : "Saved. Credentials are encrypted and the webhook is ready."
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{setup.displayName ?? "WhatsApp Cloud API"}</p>
          <p className="text-xs text-muted-foreground">
            {configured
              ? setup.displayPhoneNumber
                ? `Live number ${setup.displayPhoneNumber}`
                : "Credentials saved"
              : "Connect a Meta WhatsApp Business number"}
          </p>
        </div>
        <Badge tone={configured ? "success" : "muted"}>{configured ? "configured" : "not configured"}</Badge>
        <Badge tone={setup.liveMode ? "success" : "warning"}>
          {setup.liveMode ? "live mode" : "sandbox mode"}
        </Badge>
      </div>

      {!setup.liveMode && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          WhatsApp uses the sandbox until live credentials are saved. Other integrations stay in sandbox
          unless <code>MOCK_INTEGRATIONS=false</code> is set in <code>.env</code>.
        </p>
      )}

      {configured && !editing ? (
        <div className="space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border px-3 py-2">
              <p className="text-muted-foreground">Phone number ID</p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold">{setup.phoneNumberId}</p>
            </div>
            <div className="rounded-xl border px-3 py-2">
              <p className="text-muted-foreground">WABA ID</p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold">{setup.wabaId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => call("test")}
            >
              {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
              Test connection
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setEditing(true)}>
              Update credentials
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wa-phone-id">Phone number ID</Label>
              <Input
                id="wa-phone-id"
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                placeholder="123456789012345"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label htmlFor="wa-waba-id">WhatsApp Business Account ID</Label>
              <Input
                id="wa-waba-id"
                value={wabaId}
                onChange={(event) => setWabaId(event.target.value)}
                placeholder="987654321098765"
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wa-access-token">Permanent access token</Label>
            <Input
              id="wa-access-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder={setup.hasAccessToken ? "Saved — leave blank to keep it" : "Paste the system-user token"}
              autoComplete="new-password"
              spellCheck={false}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wa-app-secret">Meta app secret</Label>
              <Input
                id="wa-app-secret"
                type="password"
                value={appSecret}
                onChange={(event) => setAppSecret(event.target.value)}
                placeholder={setup.hasAppSecret ? "Saved — leave blank to keep it" : "App Dashboard → Settings → Basic"}
                autoComplete="new-password"
                spellCheck={false}
              />
            </div>
            <div>
              <Label htmlFor="wa-verify-token">Webhook verify token</Label>
              <Input
                id="wa-verify-token"
                type="password"
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
                placeholder={setup.hasVerifyToken ? "Saved — leave blank to keep it" : "Choose a random string"}
                autoComplete="new-password"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={
                Boolean(busy) ||
                !phoneNumberId.trim() ||
                !wabaId.trim() ||
                (!configured && (!accessToken.trim() || !appSecret.trim() || !verifyToken.trim()))
              }
              onClick={() => call("save")}
            >
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save live credentials
            </Button>
            {configured && (
              <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tokens are encrypted at rest and are never shown again or returned by the API.
          </p>
        </div>
      )}

      {message && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {message}
        </p>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <div className="rounded-xl border bg-muted/35 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Webhook callback URL</p>
        <code className="mt-1 block break-all rounded-lg bg-card px-2 py-1.5 text-[11px]">{webhookUrl}</code>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Subscribe to <code>messages</code> and <code>message_template_status_update</code>. Meta must be able to
          reach this HTTPS URL, so use your public tunnel URL during local testing.
        </p>
      </div>

      <details className="rounded-xl border px-3 py-2.5">
        <summary className="cursor-pointer text-xs font-semibold">Where to find these values in Meta</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            Meta App Dashboard → WhatsApp → API Setup: copy the <strong>Phone number ID</strong> and{" "}
            <strong>WhatsApp Business Account ID</strong>.
          </li>
          <li>
            Create a system-user token with <code>whatsapp_business_messaging</code> and{" "}
            <code>whatsapp_business_management</code>, then paste it above.
          </li>
          <li>
            App Dashboard → Settings → Basic: copy the <strong>App secret</strong>.
          </li>
          <li>
            Choose a random <strong>Webhook verify token</strong>, enter the same value in Meta&apos;s webhook
            configuration, and enable the two webhook fields above.
          </li>
          <li>Submit and approve every marketing/automation template before enabling live sends.</li>
        </ol>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          Open Meta App Dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </details>
    </div>
  );
}
