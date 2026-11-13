"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingActions({
  planId,
  agent,
  label,
  active,
}: {
  planId: string;
  agent: string;
  label: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Checkout failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        className="w-full"
        variant={active ? "outline" : "default"}
        size="sm"
        onClick={subscribe}
        disabled={busy}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {active ? `Renew ${label}` : `Subscribe — ${agent === "gbp" ? "Google" : agent === "chat" ? "Chat" : "Marketing"}`}
      </Button>
      {error && <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p>}
    </div>
  );
}
