import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(10,23,16,0.9)] hover:-translate-y-0.5 hover:bg-ink hover:shadow-[0_16px_30px_-16px_rgba(10,23,16,0.9)]",
        lime: "bg-lime text-ink shadow-[0_10px_24px_-14px_rgba(182,238,47,0.9)] hover:-translate-y-0.5 hover:bg-lime-deep",
        gold: "bg-gold text-ink shadow-[0_10px_24px_-14px_rgba(218,165,32,0.9)] hover:-translate-y-0.5 hover:bg-goldenrod",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline: "border border-ink/15 bg-transparent text-foreground hover:border-ink/30 hover:bg-ink/5",
        ghost: "text-muted-foreground hover:bg-ink/5 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        accent: "bg-clay text-ink hover:bg-clay/90",
        whatsapp: "bg-[#25D366] text-[#06392c] hover:bg-[#20c05c]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-14 min-h-[54px] rounded-full px-7 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
