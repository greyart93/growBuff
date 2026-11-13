import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reindexDocument } from "@/lib/ai/rag";
import { generateKnowledgeBase } from "@/lib/onboarding";
import { logAudit } from "@/lib/audit";
import { tokenize } from "@/lib/ai/embed";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const database = db(session.tenantId);

  try {
    if (action === "regenerate") {
      const result = await generateKnowledgeBase(session.tenantId);
      await logAudit({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        actorType: "user",
        action: "knowledge.regenerated",
        meta: result,
      });
      return NextResponse.json(result);
    }

    if (action === "create") {
      const title = String(body.title ?? "").trim();
      const content = String(body.content ?? "").trim();
      if (!title || !content) throw new Error("Title and content are required");
      const doc = await database.knowledgeDoc.create({
        data: { tenantId: session.tenantId, title, content, source: "manual", status: "ready" },
      });
      const chunks = await reindexDocument(session.tenantId, doc.id, content, tokenize(`${title} ${content}`).slice(0, 12));
      return NextResponse.json({ doc, chunks });
    }

    const docId = String(body.docId ?? "");
    const doc = await database.knowledgeDoc.findFirst({ where: { id: docId } });
    if (!doc) throw new Error("Document not found");

    if (action === "update") {
      const title = String(body.title ?? doc.title).trim();
      const content = String(body.content ?? doc.content).trim();
      const updated = await database.knowledgeDoc.update({
        where: { id: doc.id },
        data: { title, content },
      });
      const chunks = await reindexDocument(
        session.tenantId,
        updated.id,
        content,
        tokenize(`${title} ${content}`).slice(0, 12)
      );
      await logAudit({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        actorType: "user",
        action: "knowledge.updated",
        target: doc.id,
      });
      return NextResponse.json({ doc: updated, chunks });
    }

    if (action === "delete") {
      await database.knowledgeChunk.deleteMany({ where: { docId: doc.id } });
      await database.knowledgeDoc.delete({ where: { id: doc.id } });
      await logAudit({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        actorType: "user",
        action: "knowledge.deleted",
        target: doc.id,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
