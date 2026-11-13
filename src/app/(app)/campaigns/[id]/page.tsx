import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageSquare, Send, Users } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignApprove } from "@/components/campaigns/campaign-approve";
import type { CampaignStats, CampaignSegment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireTenant();
  const database = db(session.tenantId);
  const campaign = await database.campaign.findFirst({ where: { id } });
  if (!campaign) notFound();

  const [template, recipients] = await Promise.all([
    campaign.templateId ? database.template.findFirst({ where: { id: campaign.templateId } }) : null,
    database.campaignRecipient.findMany({ where: { campaignId: campaign.id } }),
  ]);
  const stats = campaign.stats as CampaignStats;
  const segment = campaign.segment as CampaignSegment;
  const audienceLabel = segment.birthdayMonth
    ? "Birthday this month"
    : segment.inactiveDays
      ? `Not visited in ${segment.inactiveDays} days`
      : segment.tags?.length
        ? `Tag: ${segment.tags.join(", ")}`
        : "All opted-in customers";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/campaigns" className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{campaign.name}</h1>
          <p className="text-xs text-muted-foreground">{audienceLabel}</p>
        </div>
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

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Message preview</CardTitle>
            <p className="text-xs text-muted-foreground">Personalised with each customer&apos;s name</p>
          </CardHeader>
          <CardContent>
            <div className="chat-canvas rounded-2xl border p-3">
              <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-wa-bubble px-3 py-2 text-[13.5px] leading-relaxed shadow-sm">
                <p className="whitespace-pre-wrap">{campaign.messageBody}</p>
                <p className="mt-1 text-right text-[10px] text-black/40">now ✓✓</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Audience
                </p>
                <p className="text-lg font-bold">{stats.audience ?? recipients.length}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Replies
                </p>
                <p className="text-lg font-bold">{stats.replied ?? 0}</p>
              </div>
            </div>

            {stats.delivered != null && campaign.status === "sent" && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border p-2">
                  <p className="font-bold">{stats.delivered}</p>
                  <p className="text-muted-foreground">delivered</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="font-bold">{stats.read ?? 0}</p>
                  <p className="text-muted-foreground">read</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="font-bold">{stats.failed ?? 0}</p>
                  <p className="text-muted-foreground">failed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval & compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">WhatsApp template</p>
                  <p className="text-xs text-muted-foreground">
                    {template?.name ?? "No template linked"}
                  </p>
                </div>
                <Badge
                  tone={
                    template?.metaStatus === "approved"
                      ? "success"
                      : template?.metaStatus === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {template?.metaStatus ?? "none"}
                </Badge>
              </div>
              <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1 font-semibold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Compliance checks
                </p>
                <ul className="mt-1 space-y-0.5 pl-1">
                  <li>• Only opted-in contacts are included</li>
                  <li>• Opt-out (&quot;STOP&quot;) line is present</li>
                  <li>• Outbound campaign uses an approved template</li>
                </ul>
              </div>
              <CampaignApprove
                campaignId={campaign.id}
                status={campaign.status}
                templateStatus={template?.metaStatus ?? null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How replies are handled</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Any customer reply lands in the shared inbox and the Chat Agent picks it up automatically, so
              interest becomes a booking instead of a missed message.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
