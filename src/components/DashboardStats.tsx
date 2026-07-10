import { useMemo } from "react";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  AlertTriangle, Clock,
} from "lucide-react";

interface Props {
  entries: WasteEntry[];
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isDueThisMonth(entry: WasteEntry): boolean {
  if (isDisposed(entry)) return false;
  const gen = new Date(entry.generated_date);
  const due = new Date(gen);
  due.setDate(due.getDate() + DISPOSAL_LIMIT_DAYS);
  const now = new Date();
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
}

/** Sum weight_kg for entries matching predicate. */
function sumWeight(entries: WasteEntry[]): number {
  return entries.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
}

/** Split entries into { hazKg, nonHazKg, litres } using measureUnit + waste_category. */
function splitByCatAndUnit(entries: WasteEntry[]) {
  const solids = entries.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const liquids = entries.filter((e) => getMeasureUnit(e.waste_type_id) === "litres");
  return {
    hazKg: sumWeight(solids.filter((e) => e.waste_category === "hazardous")),
    nonHazKg: sumWeight(solids.filter((e) => e.waste_category === "non_hazardous")),
    litres: sumWeight(liquids),
  };
}

// Category split by weight (kg) — hazardous vs non-hazardous
function splitActiveByCategory(entries: WasteEntry[]) {
  const solids = entries.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const hazKg = solids.filter((e) => e.waste_category === "hazardous").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazKg = solids.filter((e) => e.waste_category === "non_hazardous").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  return { hazKg, nonHazKg };
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const overdue = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const warning = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  const cumul = splitByCatAndUnit(active);
  const overdueSplit = splitByCatAndUnit(overdue);
  const warningSplit = splitByCatAndUnit(warning);

  // ── This month
  const thisMonthEntries = entries.filter((e) => isThisMonth(e.generated_date));
  const monthSplit = splitByCatAndUnit(thisMonthEntries);

  const dueThisMonth = active.filter(isDueThisMonth);
  const dueSplit = splitByCatAndUnit(dueThisMonth);

  // Per waste-type breakdown of solids this month, split haz vs non-haz
  const solidsThisMonth = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "kg")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  const hazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "hazardous");
  const nonHazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "non_hazardous");

  const liquidsThisMonth = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "litres")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  return (
    <div className="space-y-6">
      {/* ═══════════ SECTION A: Cumulative overview ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Cumulative — In Storage
        </h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-overdue/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-overdue">{fmtNum(cumul.hazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Hazardous</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-success">{fmtNum(cumul.nonHazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Non-Hazardous</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "hsl(var(--accent) / 0.1)" }}>
            <p className="text-2xl font-bold text-accent">{fmtNum(cumul.litres)} <span className="text-xs font-normal text-muted-foreground">L</span></p>
            <p className="text-xs text-muted-foreground">Liquid</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "hsl(var(--primary) / 0.1)" }}>
            <p className="text-2xl font-bold text-primary">{fmtNum(cumul.hazKg + cumul.nonHazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Total Solids</p>
          </div>
          <div className="bg-overdue/10 rounded-lg p-3">
            <p className="text-xl font-bold text-overdue">{fmtNum(overdueSplit.hazKg + overdueSplit.nonHazKg)} kg · {fmtNum(overdueSplit.litres)} L</p>
            <p className="text-xs text-muted-foreground">Overdue (&gt; 90 days)</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "hsl(var(--warning) / 0.1)" }}>
            <p className="text-xl font-bold" style={{ color: "hsl(var(--warning))" }}>{fmtNum(warningSplit.hazKg + warningSplit.nonHazKg)} kg · {fmtNum(warningSplit.litres)} L</p>
            <p className="text-xs text-muted-foreground">Warning (70–89 days)</p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION B: This month ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          This Month
        </h2>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-overdue/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-overdue">{fmtNum(monthSplit.hazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Hazardous generated</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-success">{fmtNum(monthSplit.nonHazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Non-Hazardous generated</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "hsl(var(--accent) / 0.1)" }}>
            <p className="text-2xl font-bold text-accent">{fmtNum(monthSplit.litres)} <span className="text-xs font-normal text-muted-foreground">L</span></p>
            <p className="text-xs text-muted-foreground">Liquid generated</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "hsl(var(--primary) / 0.1)" }}>
            <p className="text-xl font-bold text-primary">{fmtNum(dueSplit.hazKg + dueSplit.nonHazKg)} kg · {fmtNum(dueSplit.litres)} L</p>
            <p className="text-xs text-muted-foreground">Disposal due this month</p>
          </div>
        </div>
      </section>
    </div>
  );
}
