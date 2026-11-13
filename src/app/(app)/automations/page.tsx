import { Zap } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUTOMATION_TYPES } from "@/lib/marketing/constants";
import { Card, CardContent } from "@/components/ui/card";
import { AutomationList } from "@/components/automations/automation-list";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const session = await requireTenant();
  const rows = await db(session.tenantId).automation.findMany();
  const automations = AUTOMATION_TYPES.map((type) => {
    const existing = rows.find((row) => row.type === type.type);
    return {
      type: type.type,
      name: existing?.name ?? type.name,
      detail: type.detail,
      enabled: existing?.enabled ?? false,
      lastRunAt: existing?.lastRunAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
        <p className="text-sm text-muted-foreground">
          The work that happens without you opening the app.
        </p>
      </div>

      <div className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Zap className="h-4 w-4 text-amber-300" /> Scheduled by the delivery worker
        </p>
        <p className="mt-1 text-xs text-primary-foreground/75">
          Reminders and review requests respect today&apos;s bookings. Messages are only sent to opted-in
          customers and use approved templates.
        </p>
      </div>

      <AutomationList automations={automations} />

      <Card>
        <CardContent className="text-xs leading-relaxed text-muted-foreground">
          Automations run on the background worker (or <code>/api/cron</code> in this demo). Each job is
          idempotent, retried with backoff and moved to a dead-letter queue after three failures.
        </CardContent>
      </Card>
    </div>
  );
}
