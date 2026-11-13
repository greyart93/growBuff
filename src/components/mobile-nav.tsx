"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, MapPin, Megaphone, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/gbp", label: "Google", icon: MapPin },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/campaigns", label: "Promos", icon: Megaphone },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-semibold",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full",
                  active && "bg-secondary"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
