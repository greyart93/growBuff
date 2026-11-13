import { unscoped } from "@/lib/db";

export async function logAudit(input: {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorType?: "user" | "ai" | "system" | "admin";
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await unscoped.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? "system",
        action: input.action,
        target: input.target,
        meta: (input.meta ?? {}) as object,
      },
    });
  } catch (error) {
    // Audit logging must never break the user's action.
    console.error("audit log failed", error);
  }
}

export async function logAgentRun(input: {
  tenantId: string;
  agent: "gbp" | "seo" | "chat" | "marketing" | "assistant";
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status?: string;
  model?: string;
  tokens?: number;
  requiresApproval?: boolean;
  error?: string;
}) {
  return unscoped.agentRun.create({
    data: {
      tenantId: input.tenantId,
      agent: input.agent,
      action: input.action,
      input: (input.input ?? {}) as object,
      output: (input.output ?? {}) as object,
      status: input.status ?? "succeeded",
      model: input.model ?? "mock",
      tokens: input.tokens ?? 0,
      requiresApproval: input.requiresApproval ?? false,
      error: input.error,
    },
  });
}
