"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  MapPin,
  Megaphone,
  Sparkles,
  Users,
  Zap,
  BookOpen,
  CreditCard,
  Settings,
  ShieldCheck,
  Command,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { cn, initials } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/gbp", label: "Google profile", icon: MapPin },
  { href: "/seo", label: "SEO & Maps", icon: Search },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/contacts", label: "Customers", icon: Users },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/assistant", label: "Growth assistant", icon: Sparkles },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-xl transition-colors",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5 text-sm font-medium",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
      {!collapsed && label}
    </Link>
  );
}

export function AppShell({
  children,
  businessName,
  ownerName,
  locale,
  isAdmin,
}: {
  children: React.ReactNode;
  businessName: string;
  ownerName: string;
  locale: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("growbuff-sidebar-collapsed") === "true");
    } catch {
      // Storage can be unavailable in privacy mode; the sidebar still works for this visit.
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem("growbuff-sidebar-collapsed", String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }

  const items = isAdmin ? [...nav, { href: "/admin", label: "Admin", icon: ShieldCheck }] : nav;
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="min-h-dvh lg:flex">
      <aside
        id="app-sidebar"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card py-5 transition-[width] duration-200 lg:flex",
          collapsed ? "w-20 px-2" : "w-64 px-3"
        )}
      >
        <div className={cn("mb-6 flex items-center", collapsed ? "justify-center gap-1" : "justify-between px-2")}>
          <Link href="/dashboard" aria-label="GrowBuff home">
            <Brand compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed ? "h-6 w-6" : "h-7 w-7"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {collapsed ? (
          <div className="mb-5 flex justify-center" title={businessName}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials(businessName)}
            </span>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials(businessName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{businessName}</p>
              <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Demo workspace
              </p>
            </div>
          </div>
        )}

        <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <NavLink key={item.href} {...item} active={active} collapsed={collapsed} />;
          })}
        </nav>

        <div className="mt-3 border-t pt-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <LocaleToggle locale={locale} />
              <LogoutButton compact />
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">{ownerName}</span>
                <LocaleToggle locale={locale} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> 3 agents online
                </span>
                <LogoutButton compact />
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brand />
          </Link>
          <div className="flex items-center gap-1.5">
            <LocaleToggle locale={locale} />
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
              aria-label="Settings"
            >
              {initials(businessName)}
            </Link>
          </div>
        </header>

        <div className="hidden items-center justify-between gap-4 px-8 pt-6 lg:flex">
          <p className="text-sm font-medium text-muted-foreground">{current?.label ?? "Home"}</p>
          <div className="flex items-center gap-2">
            <Link
              href="/assistant"
              className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ask the assistant
              <kbd className="hidden items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground sm:flex">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </Link>
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
              aria-label="Open settings"
            >
              {initials(businessName)}
            </Link>
          </div>
        </div>

        <main
          key={pathname}
          className="mx-auto w-full max-w-6xl animate-page-in flex-1 px-4 py-5 pb-28 lg:px-8 lg:py-6 lg:pb-12"
        >
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
