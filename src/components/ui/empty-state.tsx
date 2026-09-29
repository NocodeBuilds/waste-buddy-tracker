import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/80 bg-muted/20",
        compact ? "p-4 space-y-1.5" : "p-8 space-y-3",
        className
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground border border-border/60 shadow-2xs",
          compact ? "h-9 w-9" : "h-12 w-12"
        )}
      >
        <Icon className={cn(compact ? "h-4 w-4" : "h-6 w-6", "text-muted-foreground/80")} />
      </div>

      <div className="space-y-1 max-w-xs">
        <h4 className={cn("font-semibold text-foreground tracking-tight", compact ? "text-xs" : "text-sm")}>
          {title}
        </h4>
        {description && (
          <p className={cn("text-muted-foreground leading-relaxed", compact ? "text-[11px]" : "text-xs")}>
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="h-8 text-xs font-medium rounded-lg mt-1 gap-1.5 shadow-2xs"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
