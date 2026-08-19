import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "./dashboard/DashboardCard";
import ComicBubble from "./ComicBubble";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  getStatus, isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  Package, ShieldAlert, Leaf, Trash2, Recycle, Battery, Droplets,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

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

// ── Severity row ──────────────────────────────────────────────

function SeverityRow({ label, count, value, dot, countColor, weightColor, unit }: {
  label: string; count: number; value: number; dot: string;
  countColor?: string; weightColor?: string; unit?: string;
}) {
  const displayUnit = unit || "kg";
  return (
    <div className="flex items-center gap-1.5 py-[1px]">
      <span className={`h-[5px] w-[5px] rounded-full shrink-0 ${dot}`} />
      <span className={`text-[11px] font-bold w-3.5 text-right tabular-nums ${countColor || "text-foreground"}`}>{count}</span>
      <span className={`text-[10px] ${count > 0 && countColor ? "font-semibold" : ""} text-muted-foreground flex-1`}>{label}</span>
      <span className={`text-[10px] font-mono w-14 text-right tabular-nums ${weightColor || "text-muted-foreground"}`}>
        {count > 0 ? `${fmtNum(value)} ${displayUnit}` : "—"}
      </span>
    </div>
  );
}

// ── Generic category block ────────────────────────────────────

function CategoryBlock({ entries, label, Icon, dot, textColor, unit, filterFn, totalValue }: {
  entries: WasteEntry[]; label: string; Icon: React.ElementType; dot: string;
  textColor: string; unit: string;
  filterFn: (e: WasteEntry) => boolean;
  totalValue: number;
}) {
  const catEntries = entries.filter((e) => !isDisposed(e) && filterFn(e));
  const isEmpty = catEntries.length === 0;
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

  // Only one bubble open at a time
  const [openBubble, setOpenBubble] = useState<string | null>(null);
  const toggle = (key: string) => setOpenBubble(prev => prev === key ? null : key);
  return (
    <div>
      <div className="flex items-center justify-center gap-1 mb-2">
        <Icon className={`h-3.5 w-3.5 ${textColor}`} />
        <span className="text-[11px] font-bold text-foreground">{label}</span>
      </div>
      <div className="flex items-start justify-center gap-2.5">
        <ComicBubble
          tone="overdue"
          open={openBubble === "overdue"}
          onOpenChange={(v) => toggle("overdue")}
          body={
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-overdue/80">Overdue</p>
              <p className="font-medium">{fmtNum(ovdW)} {unit}</p>
              <p className="text-foreground/65">{ovd.length > 0 ? `Due: ${overdueDue}` : "No overdue items"}</p>
              <p className="text-foreground/50">{maxDaysOverdue > 0 ? `${maxDaysOverdue} days overdue` : ovd.length > 0 ? "Past due" : "—"}</p>
            </div>
          }
        >
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-overdue/20 to-overdue/5 border-2 border-overdue/30 shadow-[0_2px_8px_rgba(239,68,68,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-overdue/10" />
            <span className="relative text-[9px] font-bold text-overdue leading-none tabular-nums">{ovdW ? fmtNum(ovdW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-overdue/70 leading-none">{ovdW ? unit : ""}</span>
          </div>
        </ComicBubble>
        <ComicBubble
          tone="warning"
          open={openBubble === "warning"}
          onOpenChange={(v) => toggle("warning")}
          body={
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-warning/80">Warning</p>
              <p className="font-medium">{fmtNum(wrnW)} {unit}</p>
              <p className="text-foreground/65">{minDaysToDue}d remaining to disposal</p>
            </div>
          }
        >
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 border-2 border-orange-500/30 shadow-[0_2px_8px_rgba(249,115,22,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite] [animation-delay:1s]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-orange-500/10" />
            <span className="relative text-[9px] font-bold text-orange-500 leading-none tabular-nums">{wrnW ? fmtNum(wrnW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-orange-500/70 leading-none">{wrnW ? unit : ""}</span>
          </div>
        </ComicBubble>
        <ComicBubble
          tone="success"
          open={openBubble === "success"}
          onOpenChange={(v) => toggle("success")}
          body={
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-success/80">On Track</p>
              <p className="font-medium">{fmtNum(safW)} {unit}</p>
              <p className="text-foreground/65">Next disposal: {nextDue ? fmtDate(nextDue) : "—"}</p>
            </div>
          }
        >
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-success/20 to-success/5 border-2 border-success/30 shadow-[0_2px_8px_rgba(34,197,94,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite] [animation-delay:2s]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-success/10" />
            <span className="relative text-[9px] font-bold text-success leading-none tabular-nums">{safW ? fmtNum(safW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-success/70 leading-none">{safW ? unit : ""}</span>
          </div>
        </ComicBubble>
      </div>
      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-[11px]">
        <span className="font-mono font-bold text-[12px]" style={{ color: textColor }}>{Math.round(totalValue)} {unit}</span>
        <span className="text-muted-foreground">total</span>
        <span className="text-border">·</span>
        <span className="text-muted-foreground">{catEntries.length} {catEntries.length === 1 ? "entry" : "entries"}</span>
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

  return (
    <div className="relative space-y-4">
      {/* ── Compliance overview ─────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">
          Compliance Status
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="Hazardous Solids" Icon={ShieldAlert} dot="bg-overdue" textColor="text-overdue" unit="kg"
                filterFn={(e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={hazSolidsKg(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="Non-Hazardous Solids" Icon={Leaf} dot="bg-success" textColor="text-success" unit="kg"
                filterFn={(e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={nonHazSolidsKg(entries)} />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="E-Waste" Icon={Trash2} dot="bg-orange-500" textColor="text-orange-500" unit="kg"
                filterFn={(e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries"}
                totalValue={eWasteKg(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="Battery Waste" Icon={Battery} dot="bg-yellow-600" textColor="text-yellow-600" unit="kg"
                filterFn={(e) => e.waste_type_id === "used-batteries"}
                totalValue={batteryKg(entries)} />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="Liquid Waste" Icon={Droplets} dot="bg-cyan-500" textColor="text-cyan-500" unit="L"
                filterFn={(e) => getMeasureUnit(e.waste_type_id) === "litres"}
                totalValue={liquidLitres(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CategoryBlock entries={entries} label="Other Wastes" Icon={Recycle} dot="bg-amber-600" textColor="text-amber-600" unit="kg"
                filterFn={(e) => e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={otherWastesKg(entries)} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════ SECTION B: This month ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/70 mb-1">
          This Month
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {solidsThisMonth.length === 0 && liquidThisMonth.length === 0 && eWasteThisMonth.length === 0 && batteryThisMonth.length === 0 && otherWastesThisMonth.length === 0 ? (
            <div
              className="col-span-full"
            >
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Package className="h-6 w-6 opacity-40" />
                  <p className="text-xs">No waste generated this month yet.</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div>
                <Card className="border-overdue/30 tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-overdue/50" style={{ "--ripple-color": "rgba(239,68,68,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("hazardous")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(hazSolidsKg(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Hazardous Solids</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="border-success/30 tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-success/50" style={{ "--ripple-color": "rgba(34,197,94,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("nonHazardous")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-success shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(nonHazSolidsKg(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Non-Hazardous Solids</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-cyan-500/50" style={{ "--ripple-color": "rgba(6,182,212,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("liquid")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-cyan-500 shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(liquidLitres(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">L</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Liquid Waste</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-orange-500/50" style={{ "--ripple-color": "rgba(249,115,22,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("ewaste")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-orange-500 shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(eWasteKg(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">E-Waste</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-yellow-600/50" style={{ "--ripple-color": "rgba(202,138,4,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("battery")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Battery className="h-5 w-5 text-yellow-600 shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(batteryKg(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Battery Waste</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="tap-ripple cursor-pointer active:scale-[0.97] transition-all duration-200 hover:shadow-md hover:border-amber-600/50" style={{ "--ripple-color": "rgba(217,119,6,0.25)" } as React.CSSProperties} onClick={() => setSplitBar("other")}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Recycle className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-xl font-bold leading-tight">{fmtNum(otherWastesKg(thisMonthEntries))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Other Wastes</p>
                  </CardContent>
                </Card>
              </div>
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

        {!hasAnyThisMonth && (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <Package className="h-5 w-5 opacity-40" />
              No waste generated this month yet.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
