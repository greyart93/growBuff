"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonateButton({ tenantId, name }: { tenantId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function impersonate() {
    if (!confirm(`Open ${name}'s workspace? This support access is audit-logged.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "impersonate", tenantId }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button size="sm" variant="outline" onClick={impersonate} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
        Open
      </Button>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
