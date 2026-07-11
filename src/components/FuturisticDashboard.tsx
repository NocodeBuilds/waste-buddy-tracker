import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, getStatus, isDisposed,
  getMeasureUnit, unitLabel, sumByUnit, fmtNum,
} from "@/lib/wasteTypes";
import DashboardStats from "./DashboardStats";
import {
  AlertTriangle, Clock, Activity, Droplets,
} from "lucide-react";

interface Props { entries: WasteEntry[]; }

const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  overdue: "hsl(var(--overdue))",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_PALETTE = [
  "hsl(180 90% 55%)",
  "hsl(280 80% 65%)",
  "hsl(40 95% 60%)",
  "hsl(150 70% 50%)",
  "hsl(340 80% 60%)",
  "hsl(220 85% 65%)",
  "hsl(20 90% 60%)",
  "hsl(100 60% 55%)",
  "hsl(260 70% 60%)",
  "hsl(190 80% 55%)",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--popover-foreground))",
};

export default function FuturisticDashboard({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));

  // Upcoming disposal (top 6 by soonest deadline).
  const upcoming = useMemo(() => {
    return active
      .map((e) => ({ ...e, daysLeft: DISPOSAL_LIMIT_DAYS - getDaysStored(e.generated_date) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 6);
  }, [active]);

  return (
    <div className="space-y-4">
      {/* Two-section summary (cumulative + this month) */}
      <DashboardStats entries={entries} />

      {/* Upcoming disposal */}
      {upcoming.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Disposal Due
            </h3>
            <ul className="divide-y divide-border/50">
              {upcoming.map((e) => {
                const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
                const status = getStatus(e);
                const tone = status === "overdue"
                  ? "text-overdue border-overdue/40 bg-overdue/10"
                  : status === "warning"
                  ? "text-warning border-warning/40 bg-warning/10"
                  : "text-success border-success/40 bg-success/10";
                return (
                  <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {wt?.name ?? e.waste_type_id} · <span className="font-mono text-muted-foreground">{e.location ?? "—"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtNum(Number(e.weight_kg ?? 0))} {unitLabel(getMeasureUnit(e.waste_type_id))} · gen {e.generated_date}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-mono ${tone}`}>
                      {e.daysLeft >= 0 ? `${e.daysLeft}d left` : `${Math.abs(e.daysLeft)}d over`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {upcoming.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 opacity-40" /> No active entries.
        </div>
      )}
    </div>
  );
}
