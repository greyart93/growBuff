import Link from "next/link";
import { MapPin, Phone, Search, Star, TrendingUp } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { runGbpAudit } from "@/lib/ai/agents/gbp";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GbpPanels } from "@/components/gbp/gbp-panels";

export const dynamic = "force-dynamic";

type AuditOutput = {
  score: number;
  band: string;
  fixes: Array<{ title: string; impact: "high" | "medium" | "low"; detail: string }>;
};

export default async function GbpPage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [business, connection, posts, reviews, metrics, latestRun] = await Promise.all([
    database.business.findFirst(),
    database.connection.findFirst({ where: { provider: "google_business" } }),
    database.gbpPost.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    database.gbpReview.findMany({ orderBy: { reviewedAt: "desc" }, take: 20 }),
    database.gbpMetricSnapshot.findMany({ orderBy: { date: "desc" }, take: 14 }),
    database.agentRun.findFirst({
      where: { agent: "gbp", action: "gbp.audit" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const fresh = latestRun && Date.now() - latestRun.createdAt.getTime() < 3600_000;
  const audit: AuditOutput = fresh
    ? (latestRun!.output as unknown as AuditOutput)
    : ((await runGbpAudit(session.tenantId)) as unknown as AuditOutput);

  const chart = [...metrics].reverse();
  const maxViews = Math.max(...chart.map((m) => m.searchViews), 1);
  const totalCalls = chart.reduce((sum, m) => sum + m.calls, 0);
  const totalDirections = chart.reduce((sum, m) => sum + m.directions, 0);
  const totalClicks = chart.reduce((sum, m) => sum + m.websiteClicks, 0);
  const checkedIn = connection?.status === "connected";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Agent</h1>
          <p className="text-sm text-muted-foreground">
            {business?.name} · {business?.city}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={checkedIn ? "success" : "warning"}>
            {checkedIn ? "Profile connected" : "Not connected"}
          </Badge>
          <Link
            href="/seo"
            className="flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" /> SEO &amp; Maps
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.2fr] sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile score</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-5xl font-bold leading-none">{audit.score}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
              <Badge
                tone={audit.score >= 75 ? "success" : audit.score >= 50 ? "warning" : "danger"}
                className="mb-1.5 ml-1"
              >
                {audit.band}
              </Badge>
            </div>
            <Progress value={audit.score} className="mt-3 max-w-xs" />
            <p className="mt-2 text-xs text-muted-foreground">
              {audit.fixes.length} fix{audit.fixes.length === 1 ? "" : "es"} suggested · audited just now
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Phone, label: "Calls", value: totalCalls },
              { icon: MapPin, label: "Directions", value: totalDirections },
              { icon: TrendingUp, label: "Site clicks", value: totalClicks },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-muted/60 p-3">
                <stat.icon className="h-4 w-4 text-primary" />
                <p className="mt-1.5 text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label} · 14d</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t bg-muted/20 px-4 pb-3 pt-4">
          <div className="flex items-end gap-2">
            {chart.slice(-7).map((metric) => (
              <div key={metric.id} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums">{metric.searchViews}</span>
                <div
                  className="w-full rounded-t bg-sky-400/70 transition-colors hover:bg-sky-500/80"
                  style={{ height: `${Math.max(6, (metric.searchViews / maxViews) * 72)}px` }}
                  title={`${new Date(metric.date).toLocaleDateString("en-IN")}: ${metric.searchViews} views`}
                />
                <span className="text-[9px] text-muted-foreground">
                  {new Date(metric.date).toLocaleDateString("en-IN", { weekday: "narrow" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {audit.fixes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fix these first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.fixes.map((fix) => (
              <div key={fix.title} className="rounded-xl border px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Badge
                    tone={fix.impact === "high" ? "danger" : fix.impact === "medium" ? "warning" : "muted"}
                    className="mt-0.5 shrink-0"
                  >
                    {fix.impact}
                  </Badge>
                  <div>
                    <p className="text-sm font-semibold">{fix.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{fix.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <GbpPanels
        autoReply={business?.autoReplyReviews ?? false}
        posts={posts.map((post) => ({
          id: post.id,
          title: post.title,
          body: post.body,
          status: post.status,
          type: post.type,
          keywords: post.keywords,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }))}
        reviews={reviews.map((review) => ({
          id: review.id,
          author: review.author,
          rating: review.rating,
          text: review.text,
          status: review.status,
          reply: review.reply,
          sentiment: review.sentiment,
          reviewedAt: review.reviewedAt.toISOString(),
        }))}
      />

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <CardTitle>Ask happy customers for reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Every completed visit queues a WhatsApp review request with a one-tap Google link and QR. Manage
            it under Automations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
