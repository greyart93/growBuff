"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { timeAgo } from "@/lib/utils";

type Automation = {
  type: string;
  name: string;
  detail: string;
  enabled: boolean;
  lastRunAt: string | null;
};

export function AutomationList({ automations }: { automations: Automation[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(automations);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(type: string, enabled: boolean) {
    setBusy(type);
    setError(null);
    setRows((current) => current.map((row) => (row.type === type ? { ...row, enabled } : row)));
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, enabled }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not update");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setRows((current) => current.map((row) => (row.type === type ? { ...row, enabled: !enabled } : row)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {error && <p className="border-b bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {rows.map((automation) => (
        <div key={automation.type} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{automation.name}</p>
            <p className="text-xs text-muted-foreground">{automation.detail}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {automation.lastRunAt ? `Last ran ${timeAgo(automation.lastRunAt)} ago` : "Not run yet"}
            </p>
          </div>
          {busy === automation.type ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={automation.enabled}
              onChange={(next) => toggle(automation.type, next)}
              label={automation.name}
            />
          )}
        </div>
      ))}
    </div>
  );
}
