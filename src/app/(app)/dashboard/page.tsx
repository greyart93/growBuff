import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronRight,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireTenant, localeForRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTasks, getWeekSummary } from "@/lib/insights";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";

export const dynamic = "force-dynamic";

const kindTone = {
  post: "info",
  campaign: "warning",
  review: "danger",
  lead: "success",
  handoff: "danger",
} as const;

export default async function DashboardPage() {
  const session = await requireTenant();
  const locale = await localeForRequest();
  const tenantId = session.tenantId;
  const [summary, tasks, business, metrics, recentChats, subscriptionCount] = await Promise.all([
    getWeekSummary(tenantId),
    getTasks(tenantId),
    db(tenantId).business.findFirst(),
    db(tenantId).gbpMetricSnapshot.findMany({ orderBy: { date: "desc" }, take: 7 }),
    db(tenantId).conversation.findMany({
      take: 3,
      orderBy: { lastMessageAt: "desc" },
      include: { contact: true },
    }),
    db(tenantId).subscription.count({ where: { status: "active" } }),
  ]);

  const firstName = (session.user.name ?? "there").replace(/^(Dr\.?|Mr\.?|Ms\.?)\s+/i, "").split(" ")[0];
  const trend =
    summary.callsPrev > 0
      ? Math.round(((summary.calls - summary.callsPrev) / summary.callsPrev) * 100)
      : summary.calls > 0
        ? 100
        : 0;
  const chart = [...metrics].reverse();
  const maxViews = Math.max(...chart.map((m) => m.searchViews), 1);
  const averageViews = Math.round(chart.reduce((sum, m) => sum + m.searchViews, 0) / Math.max(chart.length, 1));
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const stats = [
    { label: t(locale, "dashboard.calls"), value: summary.calls, icon: Phone, hint: `${trend >= 0 ? "+" : ""}${trend}% vs last week` },
    { label: t(locale, "dashboard.leads"), value: summary.leads, icon: Users, hint: `${summary.aiMessages} AI replies` },
    { label: t(locale, "dashboard.bookings"), value: summary.bookings, icon: CalendarCheck, hint: "from chats" },
    { label: t(locale, "dashboard.reviews"), value: summary.reviews, icon: Star, hint: `${summary.responses} campaign replies` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={today}
        title={`Good to see you, ${firstName}.`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {business?.name ?? session.tenantName} · {business?.city ?? "—"}
            </span>
            <Badge tone="success" dot>
              All agents on
            </Badge>
          </span>
        }
      />

      <Link href="/assistant" className="block">
        <Card className="transition-colors hover:bg-muted/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(locale, "dashboard.askAssistant")}
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  “Send a Diwali offer to customers who visited last month.”
                </p>
                <p className="text-xs text-muted-foreground">Drafts it, waits for your tap, then runs it.</p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-semibold text-primary">
              Ask assistant <ArrowRight className="h-4 w-4" />
            </span>
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="min-w-0 shadow-none">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-1">
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[11px]">
                  {stat.label}
                </p>
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                <CountUp value={stat.value} />
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                {stat.label === t(locale, "dashboard.calls") && <TrendingUp className="h-3 w-3" />}
                {stat.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t(locale, "dashboard.tasks")}</CardTitle>
            <Badge tone={tasks.length ? "warning" : "success"}>{tasks.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 && (
              <p className="rounded-xl bg-secondary/50 px-3 py-6 text-center text-sm text-muted-foreground">
                {t(locale, "dashboard.noTasks")}
              </p>
            )}
            {tasks.slice(0, 5).map((task) => (
              <Link
                key={`${task.kind}-${task.id}`}
                href={task.href}
                className="flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-muted/60"
              >
                <Badge tone={kindTone[task.kind]} className="shrink-0">
                  {task.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Google views</CardTitle>
              <Badge tone="info">7 days</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.searchViews} search views · {averageViews}/day average
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2 border-b pb-0">
              {chart.map((metric) => (
                <div key={metric.id} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-semibold tabular-nums text-foreground">
                    {metric.searchViews}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-primary/75 transition-colors hover:bg-primary"
                    style={{ height: `${Math.max(8, (metric.searchViews / maxViews) * 96)}px` }}
                    title={`${new Date(metric.date).toLocaleDateString("en-IN", { weekday: "short" })}: ${metric.searchViews} views`}
                  />
                  <span className="pb-1 text-[10px] text-muted-foreground">
                    {new Date(metric.date).toLocaleDateString("en-IN", { weekday: "narrow" })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Direction requests</p>
                <p className="font-semibold">{summary.directions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Website clicks</p>
                <p className="font-semibold">{summary.websiteClicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/gbp",
            icon: MapPin,
            title: "Google Agent",
            detail: business?.autoReplyReviews ? "Auto-replying to reviews" : "Reviews need approval",
            cta: "Review profile",
          },
          {
            href: "/inbox",
            icon: MessageCircle,
            title: "Chat Agent",
            detail: `${recentChats.length} recent chats · ${summary.aiMessages} replies`,
            cta: "Open inbox",
          },
          {
            href: "/campaigns",
            icon: Megaphone,
            title: "Marketing Agent",
            detail: tasks.filter((task) => task.kind === "campaign").length
              ? "Campaign waiting for approval"
              : "Next festival idea ready",
            cta: "Plan a campaign",
          },
        ].map((agent) => (
          <Card key={agent.title}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <agent.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{agent.title}</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{agent.detail}</p>
              <Link href={agent.href}>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  {agent.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Latest conversations</CardTitle>
          <Link href="/inbox" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentChats.map((chat) => (
            <Link
              key={chat.id}
              href={`/inbox/${chat.id}`}
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
                {(chat.contact.name ?? "?").slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{chat.contact.name ?? chat.contact.phone}</p>
                <p className="truncate text-xs text-muted-foreground">{chat.lastMessagePreview}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDate(chat.lastMessageAt).split(",").pop()}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {subscriptionCount === 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">No agent plan is active. Pick a plan to turn agents on.</p>
          <Link href="/billing">
            <Button size="sm" variant="accent">
              Choose plan
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
