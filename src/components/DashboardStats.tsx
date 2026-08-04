import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  getStatus, isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  Package, Beaker, ShieldAlert, Leaf, Trash2, Recycle, Battery, Droplets,
} from "lucide-react";

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
  if (catEntries.length === 0) return null;
  const ovd = catEntries.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const wrn = catEntries.filter((e) => { const d = getDaysStored(e.generated_date); return d >= 70 && d < DISPOSAL_LIMIT_DAYS; });
  const saf = catEntries.filter((e) => getStatus(e) === "safe");
  const ovdW = Math.round(sumWeight(ovd));
  const wrnW = Math.round(sumWeight(wrn));
  const safW = Math.round(sumWeight(saf));
  return (
    <div>
      <div className="flex items-center justify-center gap-1 mb-2">
        <Icon className={`h-3.5 w-3.5 ${textColor}`} />
        <span className="text-[11px] font-bold text-foreground">{label}</span>
        <span className="text-[9px] text-muted-foreground">({catEntries.length})</span>
        <span className="text-[9px] font-mono ml-auto" style={{ color: textColor }}>{fmtNum(totalValue)} {unit}</span>
      </div>
      <div className="flex items-start justify-center gap-2.5">
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-overdue/20 to-overdue/5 border-2 border-overdue/30 shadow-[0_2px_8px_rgba(239,68,68,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-overdue/10" />
            <span className="relative text-[9px] font-bold text-overdue leading-none tabular-nums">{ovdW ? fmtNum(ovdW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-overdue/70 leading-none">{ovdW ? unit : ""}</span>
          </div>
          <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Overdue</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 border-2 border-orange-500/30 shadow-[0_2px_8px_rgba(249,115,22,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite] [animation-delay:1s]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-orange-500/10" />
            <span className="relative text-[9px] font-bold text-orange-500 leading-none tabular-nums">{wrnW ? fmtNum(wrnW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-orange-500/70 leading-none">{wrnW ? unit : ""}</span>
          </div>
          <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Warning</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-success/20 to-success/5 border-2 border-success/30 shadow-[0_2px_8px_rgba(34,197,94,0.15)] flex flex-col items-center justify-center shrink-0 animate-[pulse-gentle_3s_ease-in-out_infinite] [animation-delay:2s]">
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-t from-transparent to-success/10" />
            <span className="relative text-[9px] font-bold text-success leading-none tabular-nums">{safW ? fmtNum(safW) : "0"}</span>
            <span className="relative text-[7px] font-semibold text-success/70 leading-none">{safW ? unit : ""}</span>
          </div>
          <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">OK</span>
        </div>
      </div>
    </div>
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
    .filter((w) => w.total > 0);

  const hazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "hazardous");
  const nonHazSolids = solidsThisMonth.filter((w) => w.wasteCategory === "non_hazardous");

  const eWasteThisMonth = WASTE_TYPES
    .filter((wt) => wt.wasteCategory === "e_waste" && wt.id !== "used-batteries")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  const batteryThisMonth = WASTE_TYPES
    .filter((wt) => wt.id === "used-batteries")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  const otherWastesThisMonth = WASTE_TYPES
    .filter((wt) => wt.wasteCategory === "other_wastes")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  const liquidThisMonth = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "litres")
    .map((wt) => {
      const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
      return { ...wt, total: sumWeight(items) };
    })
    .filter((w) => w.total > 0);

  const hasAnyThisMonth = hazSolids.length > 0 || nonHazSolids.length > 0
    || liquidThisMonth.length > 0 || eWasteThisMonth.length > 0
    || batteryThisMonth.length > 0 || otherWastesThisMonth.length > 0;

  return (
    <div className="space-y-4">
      {/* ═══════════ SECTION A: Compliance overview ═══════════ */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Compliance Status
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="Hazardous Solids" Icon={ShieldAlert} dot="bg-overdue" textColor="text-overdue" unit="kg"
                filterFn={(e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={hazSolidsKg(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="Non-Hazardous Solids" Icon={Leaf} dot="bg-success" textColor="text-success" unit="kg"
                filterFn={(e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={nonHazSolidsKg(entries)} />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="E-Waste" Icon={Trash2} dot="bg-orange-500" textColor="text-orange-500" unit="kg"
                filterFn={(e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries"}
                totalValue={eWasteKg(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="Battery Waste" Icon={Battery} dot="bg-yellow-600" textColor="text-yellow-600" unit="kg"
                filterFn={(e) => e.waste_type_id === "used-batteries"}
                totalValue={batteryKg(entries)} />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="Liquid Waste" Icon={Droplets} dot="bg-cyan-500" textColor="text-cyan-500" unit="L"
                filterFn={(e) => getMeasureUnit(e.waste_type_id) === "litres"}
                totalValue={liquidLitres(entries)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <CategoryBlock entries={entries} label="Other Wastes" Icon={Recycle} dot="bg-amber-600" textColor="text-amber-600" unit="kg"
                filterFn={(e) => e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg"}
                totalValue={otherWastesKg(entries)} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════ SECTION B: This month ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          This Month
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-overdue/30">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(hazSolidsKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-success shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(nonHazSolidsKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Non-Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-cyan-500 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(liquidLitres(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">L</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Liquid Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-orange-500 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(eWasteKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">E-Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-yellow-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(batteryKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Battery Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Recycle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(otherWastesKg(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Other Wastes</p>
            </CardContent>
          </Card>
        </div>

        {hasAnyThisMonth ? (
          <>
            {hazSolids.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-overdue" />
                  Hazardous Solids This Month (kg)
                </h3>
                {hazSolids.map((w) => {
                  const max = Math.max(...hazSolids.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-overdue h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
            {nonHazSolids.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Leaf className="h-3.5 w-3.5 text-success" />
                  Non-Hazardous Solids This Month (kg)
                </h3>
                {nonHazSolids.map((w) => {
                  const max = Math.max(...nonHazSolids.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-success h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
            {liquidThisMonth.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                  Liquid Waste This Month (L)
                </h3>
                {liquidThisMonth.map((w) => {
                  const max = Math.max(...liquidThisMonth.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} L</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
            {eWasteThisMonth.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5 text-orange-500" />
                  E-Waste This Month (kg)
                </h3>
                {eWasteThisMonth.map((w) => {
                  const max = Math.max(...eWasteThisMonth.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
            {batteryThisMonth.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Battery className="h-3.5 w-3.5 text-yellow-600" />
                  Battery Waste This Month (kg)
                </h3>
                {batteryThisMonth.map((w) => {
                  const max = Math.max(...batteryThisMonth.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-yellow-600 h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
            {otherWastesThisMonth.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Recycle className="h-3.5 w-3.5 text-amber-600" />
                  Other Wastes This Month (kg)
                </h3>
                {otherWastesThisMonth.map((w) => {
                  const max = Math.max(...otherWastesThisMonth.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-600 h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                    </div>
                  );
                })}
              </DashboardCard>
            )}
          </>
        ) : (
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
