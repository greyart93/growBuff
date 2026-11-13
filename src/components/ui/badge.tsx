import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "muted" | "info";

const tones: Record<Tone, string> = {
  default: "bg-ink/5 text-ink ring-1 ring-inset ring-ink/10",
  success: "bg-lime/45 text-ink ring-1 ring-inset ring-lime-deep/50",
  warning: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300/60",
  danger: "bg-clay/15 text-[#9c2f17] ring-1 ring-inset ring-clay/30",
  muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-ink/5",
  info: "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300/60",
};

const dotTones: Record<Tone, string> = {
  default: "bg-ink/40",
  success: "bg-[#4d7a12]",
  warning: "bg-amber-500",
  danger: "bg-clay",
  muted: "bg-muted-foreground/50",
  info: "bg-sky-500",
};

export function Badge({
  className,
  tone = "default",
  dot = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
        tones[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} />}
      {props.children}
    </span>
  );
}
