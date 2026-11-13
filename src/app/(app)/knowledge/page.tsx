import { BookOpen, FileText } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [docs, chunkCount, business] = await Promise.all([
    database.knowledgeDoc.findMany({ orderBy: { updatedAt: "desc" } }),
    database.knowledgeChunk.count(),
    database.business.findFirst(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge base</h1>
          <p className="text-sm text-muted-foreground">
            The only facts your agents are allowed to use.
          </p>
        </div>
        <KnowledgeEditor docs={[]} mode="create" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Documents", value: docs.length },
          { label: "Search chunks", value: chunkCount },
          { label: "Languages", value: business?.languages.length ?? 1 },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-none">
            <CardContent className="p-3">
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {docs.map((doc) => (
          <Card key={doc.id} id={`doc-${doc.id}`} className="scroll-mt-24">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{doc.title}</p>
                    <Badge tone="muted">{doc.source}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {doc.content}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Updated {formatDate(doc.updatedAt)}</p>
                </div>
                <KnowledgeEditor
                  docs={[{ id: doc.id, title: doc.title, content: doc.content }]}
                  mode="edit"
                  docId={doc.id}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-semibold">No documents yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Finish onboarding or add a document so your chat agent has something to answer from.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Rebuild from business profile</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Regenerates services, timings, FAQs and safety policy documents from your current business details.
          Manual edits in those documents will be replaced.
        </p>
        <div className="mt-2">
          <KnowledgeEditor docs={[]} mode="regenerate" />
        </div>
      </div>
    </div>
  );
}
