import { Check, ReceiptText } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, usageThisMonth } from "@/lib/usage";
import { formatDate, formatMoney, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BillingActions } from "@/components/billing/billing-actions";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [subscriptions, invoices, aiMessages, gbpPosts, campaignMessages] = await Promise.all([
    database.subscription.findMany(),
    database.invoice.findMany({ orderBy: { createdAt: "desc" } }),
    usageThisMonth(session.tenantId, "ai_message"),
    usageThisMonth(session.tenantId, "gbp_post"),
    usageThisMonth(session.tenantId, "campaign_message"),
  ]);

  const usage = [
    { agent: "chat", label: "AI replies", used: aiMessages, limit: 2000 },
    { agent: "gbp", label: "Google posts", used: gbpPosts, limit: 60 },
    { agent: "marketing", label: "Campaign messages", used: campaignMessages, limit: 4000 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plan & billing</h1>
        <p className="text-sm text-muted-foreground">
          Subscribe per agent. GST invoice generated on every payment.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((plan) => {
          const active = subscriptions.some((sub) => sub.agent === plan.agent && sub.status === "active");
          return (
            <Card key={plan.id} className={active ? "border-primary ring-1 ring-primary/20" : ""}>
              <CardContent className="flex h-full flex-col p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {plan.name}
                  </p>
                  {active && <Badge tone="success">active</Badge>}
                </div>
                <p className="text-2xl font-bold">
                  {formatMoney(plan.pricePaise)}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-2 flex-1 space-y-1 text-xs text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <BillingActions
                    planId={plan.id}
                    agent={plan.agent}
                    label={plan.name}
                    active={active}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This month&apos;s usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usage.map((item) => {
            const percent = pct(item.used, item.limit);
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.used.toLocaleString("en-IN")} / {item.limit.toLocaleString("en-IN")}
                  </span>
                </div>
                <Progress value={percent} />
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">
            Limits reset on the 1st. When a limit is reached the chat agent hands off to you instead of
            replying.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
              <div>
                <p className="font-mono text-xs font-semibold">{invoice.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)} · GST {formatMoney(invoice.gstPaise)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatMoney(invoice.totalPaise)}</p>
                <Badge tone={invoice.status === "paid" ? "success" : "warning"}>{invoice.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="rounded-xl bg-secondary/50 px-3 py-2.5 text-xs text-muted-foreground">
        Sandbox billing: no card is charged. In production this page creates a Razorpay or Stripe
        subscription and a GSTIN-ready invoice.
      </p>
    </div>
  );
}
