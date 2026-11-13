import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]", className)}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          safe >= 75
            ? "bg-[linear-gradient(90deg,#B6EE2F,#4d7a12)]"
            : safe >= 50
              ? "bg-[linear-gradient(90deg,#FBBF24,#F59E0B)]"
              : "bg-[linear-gradient(90deg,#FF7A59,#dc4b28)]"
        )}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}
