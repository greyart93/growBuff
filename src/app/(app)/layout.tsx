import { requireTenant, localeForRequest } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenant();
  const locale = await localeForRequest();
  return (
    <AppShell
      businessName={session.businessName ?? session.tenantName}
      ownerName={session.user.name ?? "Owner"}
      locale={locale}
      isAdmin={session.user.isAdmin}
    >
      {children}
    </AppShell>
  );
}
