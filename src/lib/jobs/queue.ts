import { unscoped } from "@/lib/db";

export type JobType =
  | "gbp_publish"
  | "campaign_send"
  | "appointment_reminder"
  | "review_request"
  | "birthday_offer"
  | "win_back"
  | "chat_followup"
  | "automation_sweep";

export async function enqueue(input: {
  type: JobType;
  tenantId?: string | null;
  payload?: Record<string, unknown>;
  runAt?: Date;
  idempotencyKey?: string;
  maxAttempts?: number;
}) {
  if (input.idempotencyKey) {
    const existing = await unscoped.job.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return null;
  }

  try {
    return await unscoped.job.create({
      data: {
        type: input.type,
        tenantId: input.tenantId ?? null,
        payload: (input.payload ?? {}) as object,
        runAt: input.runAt ?? new Date(),
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts ?? 3,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return null; // idempotent duplicate
    throw error;
  }
}

export async function queueDepth(tenantId: string) {
  const [queued, dead] = await Promise.all([
    unscoped.job.count({ where: { tenantId, status: "queued" } }),
    unscoped.job.count({ where: { tenantId, status: "dead" } }),
  ]);
  return { queued, dead };
}
