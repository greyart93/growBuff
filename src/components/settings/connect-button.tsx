"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectButton({ provider }: { provider: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not connect");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button size="sm" variant="outline" onClick={connect} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
        Connect
      </Button>
      {error && <p className="mt-0.5 text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
