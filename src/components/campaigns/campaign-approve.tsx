"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function CampaignApprove({
  campaignId,
  status,
  templateStatus,
}: {
  campaignId: string;
  status: string;
  templateStatus: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("");

  const closed = status === "sent" || status === "sending";

  async function run(action: string, extra: Record<string, unknown> = {}, key = action) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campaignId, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (closed) {
    return (
      <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        This campaign is {status}. Replies land in your inbox.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {templateStatus !== "approved" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            The template must be approved by Meta before a live send. In sandbox mode, submission is
            approved instantly.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => run("submit_template")}
            disabled={busy === "submit_template"}
          >
            {busy === "submit_template" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Submit template for approval
          </Button>
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => run("approve")}
        disabled={busy === "approve" || templateStatus !== "approved"}
      >
        {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Approve & send now
      </Button>

      <div className="rounded-xl border p-3">
        <Label htmlFor="schedule-at" className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> Schedule instead
        </Label>
        <div className="flex gap-2">
          <Input
            id="schedule-at"
            className="min-w-0"
            type="datetime-local"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => run("approve", { scheduledAt: new Date(schedule).toISOString() }, "schedule")}
            disabled={!schedule || busy === "schedule" || templateStatus !== "approved"}
          >
            {busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Sending uses your WhatsApp Business quota. Rate limits and quality rating are respected by the
        delivery worker.
      </p>
    </div>
  );
}
