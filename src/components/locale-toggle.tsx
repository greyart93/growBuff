"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function LocaleToggle({ locale, tone = "light" }: { locale: string; tone?: "light" | "dark" }) {
  const router = useRouter();
  const [current, setCurrent] = useState(locale);

  async function toggle() {
    const next = current === "hi" ? "en" : "hi";
    setCurrent(next);
    await fetch("/api/settings/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors",
        tone === "dark"
          ? "border border-white/10 text-cream/55 hover:bg-white/10 hover:text-cream"
          : "border border-ink/10 bg-card text-muted-foreground hover:border-ink/25 hover:text-foreground"
      )}
      aria-label="Change language"
    >
      <Languages className="h-3.5 w-3.5" />
      {current === "hi" ? "हिन्दी" : "EN"}
    </button>
  );
}
