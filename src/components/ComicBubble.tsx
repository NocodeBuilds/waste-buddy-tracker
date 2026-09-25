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
  arrow: string;
  accent: string;
}> = {
  overdue: {
    bubble: "border-overdue/25 bg-overdue/[0.06]",
    arrow: "bg-overdue/[0.06] border-r-overdue/25 border-t-overdue/25",
    accent: "text-overdue",
  },
  warning: {
    bubble: "border-warning/25 bg-warning/[0.06]",
    arrow: "bg-warning/[0.06] border-r-warning/25 border-t-warning/25",
    accent: "text-warning",
  },
  success: {
    bubble: "border-success/25 bg-success/[0.06]",
    arrow: "bg-success/[0.06] border-r-success/25 border-t-success/25",
    accent: "text-success",
  },
};

/**
 * A light, transparent tooltip-style popup anchored to the dashboard circles.
 *
 * Renders below the trigger by default so it never overlaps the app header.
 * Collision detection flips it upward only when near the bottom of the viewport.
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
          className="relative inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
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
          "relative w-52 rounded-xl border",
          "backdrop-blur-md shadow-sm",
          "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full",
          tones.bubble,
          tones.accent,
          `before:bg-current before:opacity-50`
        )}
      >
        <div className="space-y-0.5 px-3 py-2 text-[11px] leading-snug text-foreground/80">
          {body}
        </div>
      </PopoverContent>
    </Popover>
  );
}