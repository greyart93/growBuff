import Link from "next/link";
import { ChevronRight, MessageCircle, UserRound } from "lucide-react";
import { requireTenant, localeForRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NewChatSimulator } from "@/components/inbox/new-chat-simulator";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requireTenant();
  const locale = await localeForRequest();
  const conversations = await db(session.tenantId).conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: { contact: true },
  });

  const handoffs = conversations.filter((conversation) => conversation.aiPaused).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t(locale, "inbox.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {conversations.length} conversations · {handoffs} need a human
          </p>
        </div>
        <NewChatSimulator />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <Badge tone="default">{t(locale, "common.all")} {conversations.length}</Badge>
        <Badge tone="warning">{t(locale, "inbox.handoff")} {handoffs}</Badge>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-4 py-14 text-center">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">{t(locale, "inbox.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every WhatsApp message will land here. The agent replies instantly.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/inbox/${conversation.id}`}
              className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0 hover:bg-muted/40"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                {conversation.contact.name?.slice(0, 1) ?? <UserRound className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {conversation.contact.name ?? conversation.contact.phone}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-muted-foreground">
                    {conversation.lastMessagePreview ?? "No messages yet"}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {conversation.aiPaused ? (
                    <Badge tone="warning">{t(locale, "inbox.handoff")}</Badge>
                  ) : (
                    <Badge tone="success">AI on</Badge>
                  )}
                  {conversation.contact.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
        The agent answers only from your knowledge base, never invents prices, and hands over complaints
        or medical questions. You can take over any chat.
      </div>
    </div>
  );
}
