import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import ComicBubble from "./ComicBubble";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  getStatus, isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  Package, ShieldAlert, Leaf, Trash2, Recycle, Battery, Droplets,
  CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Sum weight_kg for entries. */
function sumWeight(entries: WasteEntry[]): number {
  return entries.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
}

/** Hazardous solids only (kg, category = hazardous, measureUnit = kg). */
function hazSolidsKg(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg"));
}

/** Non-hazardous solids only (kg, category = non_hazardous, measureUnit = kg). */
function nonHazSolidsKg(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg"));
}

/** All liquid waste (litres, measureUnit = litres). */
function liquidLitres(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && getMeasureUnit(e.waste_type_id) === "litres"));
}

/** E-waste excluding batteries (e_waste category, not used-batteries). */
function eWasteKg(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries"));
}

/** Battery waste only (used-batteries type). */
function batteryKg(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && e.waste_type_id === "used-batteries"));
}

/** Other wastes solids only (kg, category = other_wastes, measureUnit = kg). */
function otherWastesKg(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => !isDisposed(e) && e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg"));
}

// ── Generic category block ────────────────────────────────────

function CategoryBlock({ entries, label, Icon, textColor, unit, filterFn, totalValue }: {
  entries: WasteEntry[]; label: string; Icon: React.ElementType;
  textColor: string; unit: string;
  filterFn: (e: WasteEntry) => boolean;
  totalValue: number;
}) {
  const catEntries = entries.filter((e) => !isDisposed(e) && filterFn(e));
  const ovd = catEntries.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const wrn = catEntries.filter((e) => { const d = getDaysStored(e.generated_date); return d >= 70 && d < DISPOSAL_LIMIT_DAYS; });
  const saf = catEntries.filter((e) => getStatus(e) === "safe");
  const ovdW = Math.round(sumWeight(ovd));
  const wrnW = Math.round(sumWeight(wrn));
  const safW = Math.round(sumWeight(saf));

  // Bubble detail helpers
  const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const dueDate = (entry: WasteEntry) => {
    const gen = new Date(entry.generated_date + "T00:00:00");
    gen.setDate(gen.getDate() + DISPOSAL_LIMIT_DAYS);
    return gen.toISOString().slice(0, 10);
  };

  const nextDue = saf.length > 0
    ? saf.map(e => dueDate(e)).sort()[0]
    : "";

  const maxDaysOverdue = ovd.length > 0
    ? Math.max(...ovd.map(e => getDaysStored(e.generated_date) - DISPOSAL_LIMIT_DAYS))
    : 0;

  const minDaysToDue = wrn.length > 0
    ? Math.min(...wrn.map(e => DISPOSAL_LIMIT_DAYS - getDaysStored(e.generated_date)))
    : 0;

  const overdueDue = ovd.length > 0
    ? fmtDate(dueDate(ovd.reduce((a, b) => getDaysStored(a.generated_date) > getDaysStored(b.generated_date) ? a : b)))
    : "—";

  const [openBubble, setOpenBubble] = useState<string | null>(null);
  const toggle = (key: string) => setOpenBubble(prev => prev === key ? null : key);

  const totalSafePrc = totalValue > 0 ? (safW / totalValue) * 100 : 0;
  const totalWrnPrc = totalValue > 0 ? (wrnW / totalValue) * 100 : 0;
  const totalOvdPrc = totalValue > 0 ? (ovdW / totalValue) * 100 : 0;

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn("p-1 rounded-md bg-secondary/80 shrink-0", textColor)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          </div>
          <span className="text-[10px] font-mono font-medium text-muted-foreground shrink-0">
            {catEntries.length} {catEntries.length === 1 ? "item" : "items"}
          </span>
        </div>

        {/* Status Pill Counters */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          <ComicBubble
            tone="overdue"
            open={openBubble === "overdue"}
            onOpenChange={() => toggle("overdue")}
            body={
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Overdue (≥90d)</p>
                <p className="font-semibold text-sm">{fmtNum(ovdW)} {unit}</p>
                <p className="text-foreground/75 text-[11px]">{ovd.length > 0 ? `Due: ${overdueDue}` : "No overdue items"}</p>
                <p className="text-muted-foreground text-[10px]">{maxDaysOverdue > 0 ? `${maxDaysOverdue} days past limit` : ovd.length > 0 ? "Past due" : "Compliant"}</p>
              </div>
            }
          >
            <div className={cn(
              "flex flex-col items-center justify-center p-1 rounded-lg border text-center transition-all",
              ovd.length > 0
                ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-2xs"
                : "bg-muted/30 border-border/60 text-muted-foreground/50"
            )}>
              <span className="text-[11px] font-bold font-mono leading-tight">{fmtNum(ovdW)}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider opacity-80">Overdue</span>
            </div>
          </ComicBubble>

          <ComicBubble
            tone="warning"
            open={openBubble === "warning"}
            onOpenChange={() => toggle("warning")}
            body={
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Warning (70-89d)</p>
                <p className="font-semibold text-sm">{fmtNum(wrnW)} {unit}</p>
                <p className="text-foreground/75 text-[11px]">{minDaysToDue}d remaining to 90d limit</p>
              </div>
            }
          >
            <div className={cn(
              "flex flex-col items-center justify-center p-1 rounded-lg border text-center transition-all",
              wrn.length > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-2xs"
                : "bg-muted/30 border-border/60 text-muted-foreground/50"
            )}>
              <span className="text-[11px] font-bold font-mono leading-tight">{fmtNum(wrnW)}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider opacity-80">Warn</span>
            </div>
          </ComicBubble>

          <ComicBubble
            tone="success"
            open={openBubble === "success"}
            onOpenChange={() => toggle("success")}
            body={
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">On Track (&lt;70d)</p>
                <p className="font-semibold text-sm">{fmtNum(safW)} {unit}</p>
                <p className="text-foreground/75 text-[11px]">Earliest due: {nextDue ? fmtDate(nextDue) : "—"}</p>
              </div>
            }
          >
            <div className={cn(
              "flex flex-col items-center justify-center p-1 rounded-lg border text-center transition-all",
              saf.length > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                : "bg-muted/30 border-border/60 text-muted-foreground/50"
            )}>
              <span className="text-[11px] font-bold font-mono leading-tight">{fmtNum(safW)}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider opacity-80">Safe</span>
            </div>
          </ComicBubble>
        </div>

        {/* Proportional compliance micro-bar */}
        <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden flex my-2">
          {totalOvdPrc > 0 && <div className="bg-rose-500 h-full" style={{ width: `${totalOvdPrc}%` }} />}
          {totalWrnPrc > 0 && <div className="bg-amber-500 h-full" style={{ width: `${totalWrnPrc}%` }} />}
          {totalSafePrc > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${totalSafePrc}%` }} />}
        </div>
      </div>

      {/* Card Footer: Total weight and unit */}
      <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">In Storage</span>
        <div className="text-right">
          <span className="text-sm font-bold font-mono text-foreground">{fmtNum(Math.round(totalValue))}</span>{" "}
          <span className="text-[10px] font-medium text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ── Split bar dialog (shown on card tap) ──────────────────────

function SplitBarRow({ name, total, max, unit, barColor }: { name: string; total: number; max: number; unit: string; barColor: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-xs flex-1 truncate">{name}</span>
      <div className="flex-[2] bg-muted rounded-full h-2.5 overflow-hidden">
        <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-[72px] text-right">{fmtNum(total)} {unit}</span>
    </div>
  );
}

function SplitBarDialog({ open, onOpenChange, title, Icon, items, unit, barColor, textColor }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; Icon: React.ElementType; items: { name: string; total: number }[]; unit: string; barColor: string; textColor: string;
}) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.total)) : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-xl">
        <DialogHeader className="items-center text-center">
          <Icon className={`h-5 w-5 ${textColor}`} />
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Breakdown by waste type</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-1">
          {items.length > 0 ? (
            items.map((item) => (
              <SplitBarRow key={item.name} name={item.name} total={item.total} max={max} unit={unit} barColor={barColor} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No data this month</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));

  // ── This month
  const thisMonthEntries = entries.filter((e) => isThisMonth(e.generated_date));

  // Per waste-type breakdown of solids this month, split haz vs non-haz
  const solidsThisMonth = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "kg")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const hazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "hazardous");
  const nonHazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "non_hazardous");

  const eWasteThisMonth = WASTE_TYPES
    .filter((wt) => wt.wasteCategory === "e_waste" && wt.id !== "used-batteries")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const batteryThisMonth = WASTE_TYPES
    .filter((wt) => wt.id === "used-batteries")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const otherWastesThisMonth = WASTE_TYPES
    .filter((wt) => wt.wasteCategory === "other_wastes")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const liquidThisMonth = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "litres")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const hasAnyThisMonth = hazSolids.length > 0 || nonHazSolids.length > 0
    || liquidThisMonth.length > 0 || eWasteThisMonth.length > 0
    || batteryThisMonth.length > 0 || otherWastesThisMonth.length > 0;

  // Dialog state
  const [splitBar, setSplitBar] = useState<string | null>(null);

  const splitBarData: Record<string, { title: string; Icon: React.ElementType; items: { name: string; total: number }[]; unit: string; barColor: string; textColor: string }> = {
    hazardous: { title: "Hazardous Solids", Icon: ShieldAlert, items: hazSolids.map((w) => ({ name: w.name, total: w.total })), unit: "kg", barColor: "bg-overdue", textColor: "text-overdue" },
    nonHazardous: { title: "Non-Hazardous Solids", Icon: Leaf, items: nonHazSolids.map((w) => ({ name: w.name, total: w.total })), unit: "kg", barColor: "bg-success", textColor: "text-success" },
    liquid: { title: "Liquid Waste", Icon: Droplets, items: liquidThisMonth.map((w) => ({ name: w.name, total: w.total })), unit: "L", barColor: "bg-cyan-500", textColor: "text-cyan-500" },
    ewaste: { title: "E-Waste", Icon: Trash2, items: eWasteThisMonth.map((w) => ({ name: w.name, total: w.total })), unit: "kg", barColor: "bg-orange-500", textColor: "text-orange-500" },
    battery: { title: "Battery Waste", Icon: Battery, items: batteryThisMonth.map((w) => ({ name: w.name, total: w.total })), unit: "kg", barColor: "bg-yellow-600", textColor: "text-yellow-600" },
    other: { title: "Other Wastes", Icon: Recycle, items: otherWastesThisMonth.map((w) => ({ name: w.name, total: w.total })), unit: "kg", barColor: "bg-amber-600", textColor: "text-amber-600" },
  };

  // Compliance Calculations
  const overdueCount = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS).length;
  const warningCount = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  }).length;

  const earliestDue = useMemo(() => {
    if (active.length === 0) return null;
    const sorted = [...active].sort((a, b) => a.generated_date.localeCompare(b.generated_date));
    const oldest = sorted[0];
    const gen = new Date(oldest.generated_date + "T00:00:00");
    gen.setDate(gen.getDate() + DISPOSAL_LIMIT_DAYS);
    const daysLeft = DISPOSAL_LIMIT_DAYS - getDaysStored(oldest.generated_date);
    return {
      date: gen.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      daysLeft,
    };
  }, [active]);

  return (
    <div className="relative space-y-4">
      {/* ── Executive Compliance Health Banner ── */}
      <Card className={cn(
        "border transition-all shadow-xs overflow-hidden",
        overdueCount > 0
          ? "border-rose-500/30 bg-rose-500/[0.04]"
          : warningCount > 0
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : "border-emerald-500/30 bg-emerald-500/[0.04]"
      )}>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-xl shrink-0 shadow-2xs",
                overdueCount > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : warningCount > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              )}>
                {overdueCount > 0 ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : warningCount > 0 ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {overdueCount > 0
                    ? `${overdueCount} Overdue Disposal ${overdueCount === 1 ? "Item" : "Items"} Require Immediate Action`
                    : warningCount > 0
                    ? `${warningCount} ${warningCount === 1 ? "Item" : "Items"} Approaching 90-Day Storage Limit`
                    : "Facility In 100% Statutory Compliance"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {overdueCount > 0
                    ? "Statutory 90-day storage limit exceeded. Arrange disposal batch with authorized vendor."
                    : warningCount > 0
                    ? "Items in 70–89 day window. Prepare manifest and schedule quarterly disposal batch."
                    : "All hazardous and non-hazardous active waste records are within safe compliance limits."}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 shrink-0">
              {earliestDue && (
                <div className="text-right pl-3 sm:border-l border-border/60">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Next Due
                  </span>
                  <span className={cn(
                    "text-xs font-bold font-mono",
                    earliestDue.daysLeft < 0 ? "text-rose-600 dark:text-rose-400" : earliestDue.daysLeft < 20 ? "text-amber-600" : "text-foreground"
                  )}>
                    {earliestDue.date}
                  </span>
                </div>
              )}
              <div className="text-right pl-3 border-l border-border/60">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Active Items
                </span>
                <span className="text-xs font-bold font-mono text-foreground">
                  {active.length} records
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section A: Statutory In-Storage Breakdown ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Compliance By Category (In Storage)
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Tap cards to inspect status breakdown
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="hover:border-rose-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="Hazardous Solids"
                Icon={ShieldAlert}
                textColor="text-rose-600 dark:text-rose-400"
                unit="kg"
                filterFn={(e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={hazSolidsKg(entries)}
              />
            </CardContent>
          </Card>

          <Card className="hover:border-emerald-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="Non-Haz Solids"
                Icon={Leaf}
                textColor="text-emerald-600 dark:text-emerald-400"
                unit="kg"
                filterFn={(e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={nonHazSolidsKg(entries)}
              />
            </CardContent>
          </Card>

          <Card className="hover:border-cyan-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="Liquid Waste"
                Icon={Droplets}
                textColor="text-cyan-600 dark:text-cyan-400"
                unit="L"
                filterFn={(e) => getMeasureUnit(e.waste_type_id) === "litres"}
                totalValue={liquidLitres(entries)}
              />
            </CardContent>
          </Card>

          <Card className="hover:border-violet-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="E-Waste"
                Icon={Trash2}
                textColor="text-violet-600 dark:text-violet-400"
                unit="kg"
                filterFn={(e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries"}
                totalValue={eWasteKg(entries)}
              />
            </CardContent>
          </Card>

          <Card className="hover:border-amber-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="Battery Waste"
                Icon={Battery}
                textColor="text-amber-600 dark:text-amber-400"
                unit="kg"
                filterFn={(e) => e.waste_type_id === "used-batteries"}
                totalValue={batteryKg(entries)}
              />
            </CardContent>
          </Card>

          <Card className="hover:border-slate-500/40 transition-colors">
            <CardContent className="p-3.5 h-full">
              <CategoryBlock
                entries={entries}
                label="Other Wastes"
                Icon={Recycle}
                textColor="text-slate-600 dark:text-slate-400"
                unit="kg"
                filterFn={(e) => e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={otherWastesKg(entries)}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section B: This Month Generation ── */}
      <section className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            This Month's Generation
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Tap cards to view type breakdown
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar snap-x md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-3">
          {solidsThisMonth.length === 0 && liquidThisMonth.length === 0 && eWasteThisMonth.length === 0 && batteryThisMonth.length === 0 && otherWastesThisMonth.length === 0 ? (
            <div className="w-full md:col-span-full">
              <Card>
                <CardContent className="py-4 text-center text-muted-foreground flex flex-col items-center gap-1">
                  <Package className="h-4 w-4 opacity-40" />
                  <p className="text-xs">No waste entries recorded this month yet.</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-rose-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("hazardous")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(hazSolidsKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Hazardous Solids</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-emerald-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("nonHazardous")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <Leaf className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(nonHazSolidsKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Non-Haz Solids</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-cyan-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("liquid")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Droplets className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(liquidLitres(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">L</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Liquid Waste</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-violet-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("ewaste")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(eWasteKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">E-Waste</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-amber-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("battery")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Battery className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(batteryKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Battery Waste</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer active:scale-[0.98] transition-all hover:shadow-xs hover:border-slate-500/50 min-w-[130px] flex-1 md:min-w-0 snap-start"
                onClick={() => setSplitBar("other")}
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1">
                  <div className="p-1 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400">
                    <Recycle className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-base sm:text-lg font-bold font-mono leading-tight mt-0.5">
                    {fmtNum(otherWastesKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Other Wastes</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {splitBar && (
          <SplitBarDialog
            open={!!splitBar}
            onOpenChange={(v) => { if (!v) setSplitBar(null); }}
            {...splitBarData[splitBar]}
          />
        )}
      </section>
    </div>
  );
}
