import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const session = await requireTenant();
  const business = await db(session.tenantId).business.findFirst();
  const pending = await db(session.tenantId).agentRun.findMany({
    where: { agent: "assistant", status: "pending_approval" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <AssistantChat
      businessName={business?.name ?? session.tenantName}
      pendingActions={pending.map((run) => ({
        runId: run.id,
        label: run.action.replace("assistant.", "").replace("_", " "),
      }))}
    />
  );
}
