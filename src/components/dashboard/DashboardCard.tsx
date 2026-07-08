import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Standardizes card padding, visual treatment, and inner spacing for all dashboard sections. */
export default function DashboardCard({
  children,
  className,
  variant = "default",
  alert = false,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "alert";
  alert?: boolean;
}) {
  return (
    <Card
      className={cn(
        variant === "glass" && "border-border/50 bg-card/70 backdrop-blur",
        variant === "alert" && "border-overdue/30",
        alert && !variant ? "border-overdue/30" : undefined,
        className
      )}
    >
      <CardContent className="p-4 space-y-3">{children}</CardContent>
    </Card>
  );
}
