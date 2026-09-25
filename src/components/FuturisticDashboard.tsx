import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  "hsl(var(--haz-text))",       /* HAZ red */
  "hsl(var(--safe-text))",      /* SAFE green */
  "hsl(var(--liq-text))",       /* LIQ blue */
  "hsl(var(--elec-text))",      /* ELEC orange */
  "hsl(var(--batt-text))",      /* BATT amber */
  "hsl(var(--other-text))",     /* OTHER slate */
  "hsl(var(--primary))",        /* Brand green */
  "hsl(var(--accent))",         /* FAB green */
  "hsl(var(--tertiary))",       /* Ocean blue */
  "hsl(var(--secondary))",      /* Teal */
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

  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4">
      {/* ── Soft background spotlight ── */}
      {!reduceMotion && (
        <div className="relative -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-2 overflow-hidden rounded-b-2xl">
          {/* Green radial glow — very restrained */}
          <motion.div
            className="absolute -top-20 right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
            animate={{
              x: [0, 15, -8, 0],
              y: [0, -10, 8, 0],
              scale: [1, 1.03, 0.98, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -bottom-16 left-[5%] w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(var(--accent) / 0.04) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
            animate={{
              x: [0, -10, 6, 0],
              y: [0, 8, -12, 0],
              scale: [1, 0.97, 1.02, 1],
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}

      {/* Two-section summary (cumulative + this month) */}
      <DashboardStats entries={entries} />

      {/* This Week at a Glance */}
      <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.02] overflow-hidden">
        <CardContent className="p-0">
          {/* Header with colored accent bar */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-foreground/70">
              Latest entries
            </h3>
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
                    : entry.waste_category === "e_waste" ? "elec-text"
                    : entry.waste_category === "other_wastes" ? "other-text"
                    : isLiquid ? "liq-text" : "foreground";
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
                      <div className="w-12 text-center">{isLiquid ? <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-liq-bg text-liq-text">{fmtNum(w)}</span> : <span className={emptyCls}>—</span>}</div>
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