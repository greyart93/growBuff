import { NextResponse } from "next/server";
import { unscoped } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { runDueJobs } from "@/lib/jobs/run";

async function handle(request: Request) {
  const url = new URL(request.url);
  const secret = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
  if (secret !== (process.env.CRON_SECRET ?? "dev-cron-secret")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const tenants = await unscoped.tenant.findMany({
    where: { automations: { some: { enabled: true } } },
    select: { id: true },
  });
  const day = new Date().toISOString().slice(0, 10);
  let queued = 0;
  for (const tenant of tenants) {
    const job = await enqueue({
      type: "automation_sweep",
      tenantId: tenant.id,
      idempotencyKey: `sweep:${tenant.id}:${day}`,
      payload: { day },
    });
    if (job) queued++;
  }

  const result = await runDueJobs(50);
  return NextResponse.json({ tenants: tenants.length, sweepsQueued: queued, ...result });
}

export const GET = handle;
export const POST = handle;
