import Link from "next/link";
import { CalendarDays, ChevronRight, Megaphone, Sparkles, Users } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestOccasions } from "@/lib/ai/agents/marketing";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignComposer } from "@/components/campaigns/campaign-composer";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [campaigns, business, optInCount, templates] = await Promise.all([
    database.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    database.business.findFirst(),
    database.contact.count({ where: { optIn: true } }),
    database.template.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const occasions = suggestOccasions({ name: business?.name ?? "your business" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Marketing</h1>
          <p className="text-sm text-muted-foreground">
            {optInCount} opted-in customers · every send needs your approval
          </p>
        </div>
        <CampaignComposer />
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-amber-500" /> Occasions worth a campaign
        </h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {occasions.map((occasion) => (
            <div key={occasion.key} className="w-[240px] shrink-0 rounded-2xl border bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <CalendarDays className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold">{occasion.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{occasion.why}</p>
              <CampaignComposer
                small
                preset={{
                  goal: occasion.goal,
                  name: occasion.name,
                  segment: occasion.segment,
                  brief: occasion.why,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4 text-primary" /> Campaigns
        </h2>
        {campaigns.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet. Start from an occasion above.
            </CardContent>
          </Card>
        )}
        {campaigns.map((campaign) => {
          const stats = campaign.stats as { audience?: number; replied?: number };
          return (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{campaign.name}</p>
                      <Badge
                        tone={
                          campaign.status === "sent"
                            ? "success"
                            : campaign.status === "pending_approval"
                              ? "warning"
                              : campaign.status === "scheduled"
                                ? "info"
                                : "muted"
                        }
                      >
                        {campaign.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {stats.audience ?? 0} audience
                      {campaign.sentAt && <> · sent {formatDate(campaign.sentAt)}</>}
                      {stats.replied ? <> · {stats.replied} replies</> : null}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Template approvals</p>
        <div className="mt-2 space-y-1.5">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-muted-foreground">{template.name}</span>
              <Badge
                tone={
                  template.metaStatus === "approved"
                    ? "success"
                    : template.metaStatus === "rejected"
                      ? "danger"
                      : "warning"
                }
              >
                {template.metaStatus}
              </Badge>
            </div>
          ))}
          {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates yet.</p>}
        </div>
      </div>
    </div>
  );
}
