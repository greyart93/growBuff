"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

type Doc = { id: string; title: string; content: string };

export function KnowledgeEditor({
  docs,
  mode,
  docId,
}: {
  docs: Doc[];
  mode: "create" | "edit" | "regenerate";
  docId?: string;
}) {
  const router = useRouter();
  const doc = docs[0];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      setOpen(false);
      router.refresh();

      // The refreshed list reorders by updatedAt. Bring the created or edited
      // document into view once React has rendered it.
      const savedDocId = data?.doc?.id as string | undefined;
      if (savedDocId) {
        window.setTimeout(() => {
          document
            .getElementById(`doc-${savedDocId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 350);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "regenerate") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => call("regenerate")}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        Rebuild knowledge base
      </Button>
    );
  }

  return (
    <>
      {mode === "create" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Edit document">
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add knowledge" : "Edit document"}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Parking and directions"
            />
          </div>
          <div>
            <Label htmlFor="doc-content">Facts the agent may use</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[220px]"
              placeholder="Write short, factual answers. Prices, timings, policies."
            />
          </div>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="lg"
              disabled={busy || !title.trim() || !content.trim()}
              onClick={() =>
                call(mode === "create" ? "create" : "update", { docId, title, content })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save & re-index
            </Button>
            {mode === "edit" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete document"
                disabled={busy}
                onClick={() => {
                  if (confirm("Delete this document from the knowledge base?")) call("delete", { docId });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Chunks are re-embedded immediately, so the next customer message uses the new facts.
          </p>
        </div>
      </Modal>
    </>
  );
}
