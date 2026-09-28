import { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ComicBubbleProps {
  children: ReactNode;
  body: ReactNode;
  tone: "overdue" | "warning" | "success";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TONE_CLASSES: Record<ComicBubbleProps["tone"], {
  bubble: string;
  accent: string;
}> = {
  overdue: {
    bubble: "border-rose-500/30 bg-card text-foreground",
    accent: "text-rose-600 dark:text-rose-400",
  },
  warning: {
    bubble: "border-amber-500/30 bg-card text-foreground",
    accent: "text-amber-600 dark:text-amber-400",
  },
  success: {
    bubble: "border-emerald-500/30 bg-card text-foreground",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
};

/**
 * A sleek, high-clarity popover anchored to compliance status counters.
 */
export default function ComicBubble({
  children,
  body,
  tone,
  open,
  onOpenChange,
}: ComicBubbleProps) {
  const tones = TONE_CLASSES[tone];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl"
          aria-label={`${tone} details`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        avoidCollisions
        collisionBoundary={[]}
        collisionPadding={12}
        className={cn(
          "relative w-56 rounded-xl border p-3",
          "backdrop-blur-md shadow-lg bg-card/95",
          tones.bubble
        )}
      >
        <div className="space-y-1 text-xs leading-normal">
          {body}
        </div>
      </PopoverContent>
    </Popover>
  );
}