import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  addSeoKeyword,
  approveSeoContent,
  generateSeoContent,
  generateSeoKeywords,
  runSeoAudit,
  toggleSeoKeyword,
  updateSeoContent,
  updateSeoSettings,
} from "@/lib/ai/agents/seo";

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export async function GET() {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = db(session.tenantId);
  const [keywords, content] = await Promise.all([
    database.seoKeyword.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] }),
    database.seoContent.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ keywords, content });
}

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "refresh_audit": {
        const audit = await runSeoAudit(session.tenantId);
        return NextResponse.json({ audit });
      }
      case "generate_keywords": {
        await generateSeoKeywords(session.tenantId);
        return NextResponse.json({ ok: true });
      }
      case "add_keyword": {
        const keyword = await addSeoKeyword(
          session.tenantId,
          String(body.keyword ?? ""),
          String(body.intent ?? "local")
        );
        return NextResponse.json({ keyword });
      }
      case "toggle_keyword": {
        const keyword = await toggleSeoKeyword(session.tenantId, String(body.keywordId ?? ""));
        return NextResponse.json({ keyword });
      }
      case "save_settings": {
        const business = await updateSeoSettings(session.tenantId, {
          primaryKeyword: typeof body.primaryKeyword === "string" ? body.primaryKeyword : undefined,
          serviceAreas: strings(body.serviceAreas),
          secondaryCategories: strings(body.secondaryCategories),
        });
        return NextResponse.json({ business });
      }
      case "generate_content": {
        const content = await generateSeoContent({
          tenantId: session.tenantId,
          type: String(body.type ?? "page_meta"),
          keyword: typeof body.keyword === "string" ? body.keyword : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        });
        return NextResponse.json({ content });
      }
      case "update_content": {
        const content = await updateSeoContent(session.tenantId, String(body.contentId ?? ""), {
          title: typeof body.title === "string" ? body.title : undefined,
          metaTitle: typeof body.metaTitle === "string" ? body.metaTitle : undefined,
          metaDescription:
            typeof body.metaDescription === "string" ? body.metaDescription : undefined,
          body: typeof body.body === "string" ? body.body : undefined,
        });
        return NextResponse.json({ content });
      }
      case "approve_content": {
        const content = await approveSeoContent(session.tenantId, String(body.contentId ?? ""));
        return NextResponse.json({ content });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
