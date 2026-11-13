"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        node.style.setProperty("--my", `${event.clientY - rect.top}px`);
      }}
      className={cn(
        "spotlight rounded-[1.6rem] transition-transform duration-300 hover:-translate-y-0.5",
        tone === "dark" && "spotlight-dark",
        className
      )}
    >
      {children}
    </div>
  );
}
