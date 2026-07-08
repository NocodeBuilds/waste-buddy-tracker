import { useMemo } from "react";
import DashboardCard from "./dashboard/DashboardCard";
import { Badge } from "@/components/ui/badge";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, getStatus, isDisposed,
  unitLabel, fmtNum,
} from "@/lib/wasteTypes";
import DashboardStats from "./DashboardStats";
import {
  AlertTriangle, Clock,
} from "lucide-react";

interface Props { entries: WasteEntry[]; }


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
        <DashboardCard variant="glass">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Disposal Due
          </h3>
          <ul className="divide-y divide-border">
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
        </DashboardCard>
      )}

      {upcoming.length === 0 && (
        <DashboardCard variant="glass">
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 opacity-40" /> No active entries.
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
