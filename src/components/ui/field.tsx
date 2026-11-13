import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("mb-1.5 block text-[12px] font-bold tracking-[-0.01em]", className)} {...props} />
  )
);
Label.displayName = "Label";

const fieldStyles =
  "flex w-full rounded-xl border border-ink/15 bg-card px-3.5 py-2.5 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] placeholder:text-muted-foreground/70 transition-shadow focus-visible:border-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime/40 disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldStyles, "h-12", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldStyles, "min-h-[96px] resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldStyles, "h-12 appearance-none pr-8", className)} {...props} />
  )
);
Select.displayName = "Select";

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm font-medium text-destructive">{children}</p>;
}
