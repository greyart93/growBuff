import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Unscoped client: use only for auth, webhooks and admin lookups. */
export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

export const unscoped = basePrisma;

/**
 * Every tenant-owned model. Queries through db(tenantId) always constrain these
 * rows to the active tenant, so a forgotten filter cannot leak data between
 * businesses.
 */
const TENANT_MODELS = new Set([
  "Business",
  "Membership",
  "Connection",
  "KnowledgeDoc",
  "KnowledgeChunk",
  "Contact",
  "Conversation",
  "Message",
  "Lead",
  "Booking",
  "Campaign",
  "Template",
  "CampaignRecipient",
  "Automation",
  "GbpPost",
  "GbpReview",
  "GbpMetricSnapshot",
  "SeoKeyword",
  "SeoContent",
  "AgentRun",
  "Subscription",
  "UsageEvent",
  "Invoice",
  "Job",
  "AuditLog",
]);

type TenantArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

const clients = new Map<string, PrismaClient>();

function scopedClient(tenantId: string): PrismaClient {
  const cached = clients.get(tenantId);
  if (cached) return cached;

  const client = basePrisma.$extends({
    name: `tenant-${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);

          const a = (args ?? {}) as TenantArgs;
          const where = { ...(a.where ?? {}), tenantId };

          // findUnique cannot carry tenantId, so run it as a tenant-filtered findFirst.
          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const delegate = (basePrisma as unknown as Record<string, { findFirst: Function }>)[
              model.charAt(0).toLowerCase() + model.slice(1)
            ];
            const row = await delegate.findFirst({ ...a, where });
            if (operation === "findUniqueOrThrow" && !row) {
              throw new Error(`No ${model} found in this workspace`);
            }
            return row;
          }

          if (operation === "create") {
            const data = Array.isArray(a.data)
              ? a.data.map((d) => ({ ...d, tenantId }))
              : { ...(a.data ?? {}), tenantId };
            return query({ ...a, data } as typeof args);
          }

          if (operation === "createMany") {
            const data = Array.isArray(a.data)
              ? a.data.map((d) => ({ ...d, tenantId }))
              : { ...(a.data ?? {}), tenantId };
            return query({ ...a, data } as typeof args);
          }

          if (operation === "upsert") {
            return query({
              ...a,
              where,
              create: { ...(a.create ?? {}), tenantId },
            } as typeof args);
          }

          if (
            [
              "findMany",
              "findFirst",
              "findFirstOrThrow",
              "count",
              "aggregate",
              "groupBy",
              "update",
              "updateMany",
              "delete",
              "deleteMany",
            ].includes(operation)
          ) {
            return query({ ...a, where } as typeof args);
          }

          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;

  if (clients.size > 200) clients.clear();
  clients.set(tenantId, client);
  return client;
}

/** Tenant-scoped Prisma client. Throws if no tenant is supplied. */
export function db(tenantId: string): PrismaClient {
  if (!tenantId) throw new Error("Tenant context is required");
  return scopedClient(tenantId);
}

export default basePrisma;
