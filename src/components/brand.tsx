import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  tone = "dark",
  accent = "lime",
}: {
  className?: string;
  tone?: "dark" | "light";
  accent?: "lime" | "gold";
}) {
  const accentBg = accent === "gold" ? "bg-gold" : "bg-lime";
  const leafFill = accent === "gold" ? "#FFD700" : "#D9FF63";

  return (
    <span
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem]",
        tone === "dark" ? "bg-ink text-cream" : accentBg + " text-ink",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M12 20V9.5M12 9.5C12 6 9.5 4 5.5 4c0 4.2 2.2 6.5 6.5 6.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 13c0-3.2 2.2-5.2 6-5.2 0 3.7-2 5.7-6 5.7Z"
          fill={tone === "dark" ? leafFill : "#0A1710"}
        />
        <circle cx="18.4" cy="5.2" r="1.6" fill={tone === "dark" ? "#FF7A59" : "#F7F3E8"} />
      </svg>
    </span>
  );
}

export function Brand({
  className,
  compact,
  tone = "dark",
  accent = "lime",
}: {
  className?: string;
  compact?: boolean;
  tone?: "dark" | "light";
  accent?: "lime" | "gold";
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark tone={tone} accent={accent} />
      {!compact && (
        <span
          className={cn(
            "text-[18px] font-extrabold tracking-[-0.045em]",
            tone === "dark" ? "text-foreground" : "text-cream"
          )}
        >
          Grow<span className={tone === "dark" ? "text-primary" : accent === "gold" ? "text-gold" : "text-lime"}>Buff</span>
          <span className={tone === "dark" ? "text-clay" : "text-clay"}>.</span>
        </span>
      )}
    </span>
  );
}
