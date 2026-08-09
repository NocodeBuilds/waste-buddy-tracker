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
      <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.02] overflow-hidden">
        <CardContent className="p-0">
          {/* Header with colored accent bar */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <div className="h-[3px] w-5 rounded-full bg-primary/60 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary/70" /> This Week at a Glance
            </h3>
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">({weekLabel()})</span>
          </div>

          {weekEntries.length > 0 ? (
            <div className="max-h-[240px] overflow-y-auto px-3 pb-3">
              {/* Sticky column headers */}
              <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 mb-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-0 pt-1.5 pb-1.5 px-1">
                  <div className="w-12 shrink-0 text-left">Date</div>
                  <div className="w-[110px] shrink-0 text-center">Loc</div>
                  <div className="w-12 shrink-0 text-center">Haz</div>
                  <div className="w-12 shrink-0 text-center">Non-Haz</div>
                  <div className="w-12 shrink-0 text-center">E-Waste</div>
                  <div className="w-12 shrink-0 text-center">Other</div>
                  <div className="w-12 shrink-0 text-center">Liq</div>
                </div>
              </div>
              {/* Data rows */}
              <div className="space-y-0.5">
                {weekEntries.map((entry) => {
                  const isLiquid = ["any-liquid","waste-oil","waste-chemical","waste-water","waste-gas","liquid-chemical"].includes(entry.waste_type_id);
                  const w = Number(entry.weight_kg ?? 0);
                  const catColor = entry.waste_category === "hazardous" ? "overdue"
                    : entry.waste_category === "non_hazardous" ? "success"
                    : entry.waste_category === "e_waste" ? "orange-500"
                    : entry.waste_category === "other_wastes" ? "amber-600"
                    : isLiquid ? "cyan-500" : "foreground";
                  const valCls = `text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-${catColor}/[0.08] text-${catColor}`;
                  const emptyCls = "text-[11px] font-mono text-muted-foreground/50 px-1.5 py-0.5";
                  return (
                    <div key={entry.id} className="flex items-center gap-0 py-1 hover:bg-foreground/[0.02] rounded-lg transition-colors">
                      <div className="w-12 shrink-0 text-center">
                        <span className="text-[11px] font-mono text-muted-foreground">{format(new Date(entry.generated_date + "T00:00:00"), "dd MMM")}</span>
                      </div>
                      <div className="w-[110px] shrink-0 text-center">
                        <span className="text-[11px] truncate block">{entry.location || "—"}</span>
                      </div>
                      <div className="w-12 text-center">{entry.waste_category === "hazardous" && !isLiquid ? <span className={valCls}>{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
                      <div className="w-12 text-center">{entry.waste_category === "non_hazardous" && !isLiquid ? <span className={valCls}>{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
                      <div className="w-12 text-center">{entry.waste_category === "e_waste" && !isLiquid ? <span className={valCls}>{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
                      <div className="w-12 text-center">{entry.waste_category === "other_wastes" && !isLiquid ? <span className={valCls}>{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
                      <div className="w-12 text-center">{isLiquid ? <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-cyan-500/[0.08] text-cyan-500">{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 opacity-40" /> No entries recorded this week.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}