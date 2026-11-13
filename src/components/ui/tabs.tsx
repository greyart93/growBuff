"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  initial = 0,
}: {
  tabs: Array<{ id: string; label: string; badge?: number; content: React.ReactNode }>;
  initial?: number;
}) {
  const [active, setActive] = useState(initial);
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => setActive(index)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] transition-all duration-200",
              active === index
                ? "border-ink bg-ink text-cream"
                : "border-ink/10 bg-card text-muted-foreground hover:border-ink/25 hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  active === index ? "bg-lime text-ink" : "bg-amber-100 text-amber-900"
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="animate-fade-in">{tabs[active]?.content}</div>
    </div>
  );
}
