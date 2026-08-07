import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { WasteEntry, fmtNum, getLocalDate } from "@/lib/wasteTypes";
import DashboardStats from "./DashboardStats";
import { format } from "date-fns";
import {
  AlertTriangle, Fan, Activity,
} from "lucide-react";

interface Props { entries: WasteEntry[]; }

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return getLocalDate(monday);
}

function getWeekEnd(): string {
  const monday = new Date(getWeekStart() + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return getLocalDate(sunday);
}

function isThisWeek(dateStr: string): boolean {
  return dateStr >= getWeekStart() && dateStr <= getWeekEnd();
}

function weekLabel(): string {
  const s = new Date(getWeekStart() + "T00:00:00");
  const e = new Date(getWeekEnd() + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-IN", opts)} – ${e.toLocaleDateString("en-IN", opts)}`;
}

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
  // Filter entries from this week (Mon–Sun), newest first
  const weekEntries = useMemo(() => {
    return entries
      .filter((e) => isThisWeek(e.generated_date))
      .sort((a, b) => b.generated_date.localeCompare(a.generated_date));
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Two-section summary (cumulative + this month) */}
      <DashboardStats entries={entries} />

      {/* This Week at a Glance */}
      <Card className="border-border/50 bg-card/70 backdrop-blur">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> This Week at a Glance <span className="text-[10px] font-normal normal-case tracking-normal">({weekLabel()})</span>
          </h3>

          {weekEntries.length > 0 ? (
            <div className="max-h-[240px] overflow-y-auto -mx-1 px-1">
              <div className="w-full text-xs">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex px-2 items-center gap-0">
                  <div className="w-12 shrink-0 text-left truncate">Date</div>
                  <div className="w-[110px] shrink-0 text-center truncate border-l border-border/40">Location</div>
                  <div className="w-12 shrink-0 text-center truncate border-l border-border/40">HW</div>
                  <div className="w-12 shrink-0 text-center truncate border-l border-border/40">NHW</div>
                  <div className="w-12 shrink-0 text-center truncate border-l border-border/40">EW</div>
                  <div className="w-12 shrink-0 text-center truncate border-l border-border/40">Other</div>
                  <div className="w-12 shrink-0 text-center truncate border-l border-border/40">Liq</div>
                </div>
                <div className="divide-y divide-border/50">
                  {weekEntries.map((entry) => {
                    const isLiquid = ["any-liquid","waste-oil","waste-chemical","waste-water","waste-gas","liquid-chemical"].includes(entry.waste_type_id);
                    const w = Number(entry.weight_kg ?? 0);
                    return (
                      <div key={entry.id} className="flex px-2 items-center gap-0">
                        <div className="w-12 text-center font-mono text-xs text-muted-foreground shrink-0 truncate">
                          {format(new Date(entry.generated_date + "T00:00:00"), "dd MMM")}
                        </div>
                        <div className="w-[110px] shrink-0 truncate border-l border-border/40">
                          <span className="text-xs truncate block text-center">{entry.location || "—"}</span>
                        </div>
                        <div className="w-12 text-center font-mono text-xs shrink-0 truncate border-l border-border/40">{entry.waste_category === "hazardous" && !isLiquid ? fmtNum(w) : "—"}</div>
                        <div className="w-12 text-center font-mono text-xs shrink-0 truncate border-l border-border/40">{entry.waste_category === "non_hazardous" && !isLiquid ? fmtNum(w) : "—"}</div>
                        <div className="w-12 text-center font-mono text-xs shrink-0 truncate border-l border-border/40">{entry.waste_category === "e_waste" && !isLiquid ? fmtNum(w) : "—"}</div>
                        <div className="w-12 text-center font-mono text-xs shrink-0 truncate border-l border-border/40">{entry.waste_category === "other_wastes" && !isLiquid ? fmtNum(w) : "—"}</div>
                        <div className="w-12 text-center font-mono text-xs shrink-0 truncate border-l border-border/40">{isLiquid ? fmtNum(w) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 opacity-40" /> No entries recorded this week.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}