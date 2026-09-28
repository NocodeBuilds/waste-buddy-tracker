import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 tracking-tight",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary dark:text-primary",
        secondary: "border-border/80 bg-secondary/80 text-secondary-foreground",
        destructive: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        overdue: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        neutral: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
        info: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
        outline: "border-border/80 text-foreground bg-card",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
