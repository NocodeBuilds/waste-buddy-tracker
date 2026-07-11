import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: ReactNode;
  variant?: "default" | "glass";
  className?: string;
}

export default function DashboardCard({ children, variant = "default", className }: DashboardCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        variant === "glass" && "bg-card/60 backdrop-blur-sm",
        className
      )}
    >
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}
