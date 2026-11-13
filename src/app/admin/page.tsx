import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { unscoped } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpersonateButton } from "@/components/admin/impersonate-button";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();
  if (!session.user.isAdmin) notFound();

  const [tenants, deadJobs, auditLogs, usage] = await Promise.all([
    unscoped.tenant.findMany({
      include: {
        business: true,
        _count: { select: { contacts: true, conversations: true, campaigns: true, agentRuns: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    unscoped.job.findMany({ where: { status: "dead" }, orderBy: { updatedAt: "desc" }, take: 10 }),
    unscoped.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    unscoped.usageEvent.groupBy({ by: ["tenantId", "type"], _sum: { quantity: true } }),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
          <Link href="/dashboard">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary sm:block">
              Internal admin
            </span>
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to app
            </Link>
            <LogoutButton compact />
          </div>
        </div>
      </header>

      <main className="container space-y-4 py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
            <p className="text-sm text-muted-foreground">Support impersonation is audit-logged.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Tenants", value: tenants.length },
            { label: "Dead jobs", value: deadJobs.length },
            { label: "Audit events", value: auditLogs.length },
          ].map((stat) => (
            <Card key={stat.label} className="shadow-none">
              <CardContent className="p-3">
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle>Tenants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenants.map((tenant) => {
              const tenantUsage = usage
                .filter((row) => row.tenantId === tenant.id)
                .map((row) => `${row.type}: ${row._sum.quantity ?? 0}`)
                .join(" · ");
              return (
                <div key={tenant.id} className="rounded-xl border px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.business?.category ?? "No business"} · {tenant.business?.city ?? "—"} ·{" "}
                        {tenant._count.contacts} customers
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={tenant.status === "active" ? "success" : "danger"}>{tenant.status}</Badge>
                      <ImpersonateButton tenantId={tenant.id} name={tenant.name} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {tenant._count.conversations} chats · {tenant._count.campaigns} campaigns ·{" "}
                    {tenant._count.agentRuns} AI runs
                  </p>
                  {tenantUsage && <p className="mt-0.5 text-[10px] text-muted-foreground">Usage: {tenantUsage}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dead-letter queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {deadJobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No failed jobs. Everything is healthy.</p>
            )}
            {deadJobs.map((job) => (
              <div key={job.id} className="rounded-lg border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{job.type}</span>
                  <Badge tone="danger">{job.attempts} attempts</Badge>
                </div>
                <p className="mt-0.5 text-muted-foreground">{job.lastError}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-2 border-b pb-1.5 text-xs last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium">{log.action}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {log.actorType} · {log.target ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
