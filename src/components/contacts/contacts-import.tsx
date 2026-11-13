"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export function ContactsImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("name,phone,tags,optin\nNeha Sharma,+919811122233,new,true");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      setResult(`Imported ${data.imported}, skipped ${data.skipped}, opted in ${data.optedIn}.`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import customers">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="csv">CSV</Label>
            <Textarea
              id="csv"
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              className="min-h-[160px] font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only rows with <code>optin=true</code> will receive marketing messages. Duplicate phone numbers
            update the existing customer.
          </p>
          {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{result}</p>}
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Button className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import with opt-in rules
          </Button>
        </form>
      </Modal>
    </>
  );
}
