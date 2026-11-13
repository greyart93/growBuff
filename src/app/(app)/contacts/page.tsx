import Link from "next/link";
import { Download, ShieldCheck, UserCheck, UserX, X } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContactsImport } from "@/components/contacts/contacts-import";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const params = await searchParams;
  const activeTag = typeof params.tag === "string" && params.tag.trim() ? params.tag.trim() : null;
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [contacts, allTagRows, total, optedIn, optedOut] = await Promise.all([
    database.contact.findMany({
      where: activeTag ? { tags: { has: activeTag } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    database.contact.findMany({ select: { tags: true } }),
    database.contact.count(),
    database.contact.count({ where: { optIn: true } }),
    database.contact.count({ where: { optIn: false } }),
  ]);

  const tags = [...new Set(allTagRows.flatMap((contact) => contact.tags))].slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Auto-created from chats, imports and campaigns</p>
        </div>
        <ContactsImport />
      </div>

      <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
        {[
          { icon: UserCheck, label: "Opted in", value: optedIn, tone: "text-emerald-700 bg-emerald-50" },
          { icon: UserX, label: "Opted out", value: optedOut, tone: "text-red-700 bg-red-50" },
          { icon: ShieldCheck, label: "Total", value: total, tone: "text-sky-700 bg-sky-50" },
        ].map((stat) => (
          <Card key={stat.label} className="min-w-0 shadow-none">
            <CardContent className="p-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => {
              const isActive = tag === activeTag;
              return (
                <Link
                  key={tag}
                  href={isActive ? "/contacts" : `/contacts?tag=${encodeURIComponent(tag)}`}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                      : "rounded-full border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-secondary/50"
                  }
                >
                  #{tag}
                </Link>
              );
            })}
            {activeTag && (
              <Link
                href="/contacts"
                className="flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
              >
                <X className="h-3 w-3" /> Reset filter
              </Link>
            )}
          </div>
          {activeTag && (
            <p className="text-xs text-muted-foreground">
              Showing {contacts.length} customer{contacts.length === 1 ? "" : "s"} tagged{" "}
              <span className="font-semibold text-foreground">#{activeTag}</span>.
            </p>
          )}
        </div>
      )}

      <Card>
        <div className="divide-y">
          {contacts.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {activeTag ? `No customers tagged #${activeTag} yet.` : "No customers yet."}
            </p>
          )}
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
                {(contact.name ?? contact.phone).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{contact.name ?? contact.phone}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {contact.phone}
                  {contact.lastSeenAt ? ` · last seen ${formatDate(contact.lastSeenAt)}` : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {contact.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              </div>
              <Badge tone={contact.optIn ? "success" : "danger"}>{contact.optIn ? "opted in" : "opted out"}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-xl bg-secondary/50 px-3 py-2.5 text-xs text-muted-foreground">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 break-words">
          CSV import format: <code className="break-all">name,phone,tags,optin</code>. Only rows marked
          optin=true receive marketing messages. STOP responses are recorded automatically.
        </p>
      </div>
    </div>
  );
}
