"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoutButton({
  compact,
  tone = "light",
}: {
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      aria-label="Log out"
      title="Log out"
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
        tone === "dark"
          ? "text-cream/50 hover:bg-white/10 hover:text-cream"
          : "text-muted-foreground hover:bg-ink/5 hover:text-foreground"
      )}
    >
      <LogOut className="h-4 w-4" />
      {!compact && "Log out"}
    </button>
  );
}
