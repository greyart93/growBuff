import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveCampaign, draftCampaign, refreshCampaignTemplate, submitCampaignTemplate } from "@/lib/ai/agents/marketing";
import type { CampaignSegment } from "@/lib/types";

export async function GET() {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await db(session.tenantId).campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    if (action === "create") {
      const segment = (body.segment ?? { all: true }) as CampaignSegment;
      const result = await draftCampaign({
        tenantId: session.tenantId,
        goal: typeof body.goal === "string" ? body.goal : "win_back",
        name: typeof body.name === "string" && body.name.trim() ? body.name : undefined,
        brief: typeof body.brief === "string" ? body.brief : undefined,
        segment,
      });
      return NextResponse.json({ campaignId: result.campaign.id, audience: result.audience });
    }

    const campaignId = String(body.campaignId ?? "");
    if (!campaignId) throw new Error("Campaign is required");

    if (action === "submit_template") {
      const template = await submitCampaignTemplate(session.tenantId, campaignId);
      return NextResponse.json({ template });
    }

    if (action === "refresh_template") {
      const template = await refreshCampaignTemplate(session.tenantId, campaignId);
      return NextResponse.json({ template });
    }

    if (action === "approve") {
      const scheduledAt =
        typeof body.scheduledAt === "string" && body.scheduledAt ? new Date(body.scheduledAt) : null;
      const result = await approveCampaign(session.tenantId, campaignId, { scheduledAt });
      return NextResponse.json({ ok: true, audience: result.audience, status: result.campaign.status });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
