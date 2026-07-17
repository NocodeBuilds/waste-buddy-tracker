import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  getStatus, isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  Package, Beaker, ShieldAlert, Leaf, Trash2, Recycle, Battery,
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

/** Split entries into { hazKg, nonHazKg, otherWastesKg, litres } using measureUnit + waste_category. */
function splitByCatAndUnit(entries: WasteEntry[]) {
  const solids = entries.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const liquids = entries.filter((e) => getMeasureUnit(e.waste_type_id) === "litres");
  return {
    hazKg: sumWeight(solids.filter((e) => e.waste_category === "hazardous")),
    nonHazKg: sumWeight(solids.filter((e) => e.waste_category === "non_hazardous")),
    otherWastesKg: sumWeight(solids.filter((e) => e.waste_category === "other_wastes")),
    litres: sumWeight(liquids),
  };
}

/** Sum weight for e-waste entries (excluding batteries). */
function eWasteWeight(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries"));
}

/** Sum weight for battery waste entries (used-batteries type). */
function batteryWasteWeight(entries: WasteEntry[]): number {
  return sumWeight(entries.filter((e) => e.waste_type_id === "used-batteries"));
}

// ── Category config ───────────────────────────────────────────

const CATEGORIES = [
  { id: "hazardous" as const, label: "Hazardous", Icon: ShieldAlert, dot: "bg-overdue", text: "text-overdue" },
  { id: "non_hazardous" as const, label: "Non-Hazardous", Icon: Leaf, dot: "bg-success", text: "text-success" },
  { id: "e_waste" as const, label: "E-Waste", Icon: Trash2, dot: "bg-orange-500", text: "text-orange-500" },
  { id: "other_wastes" as const, label: "Other Wastes", Icon: Recycle, dot: "bg-amber-600", text: "text-amber-600" },
] as const;

// ── Severity row ──────────────────────────────────────────────

function SeverityRow({ label, count, kg, dot, countColor, weightColor }: {
  label: string; count: number; kg: number; dot: string;
  countColor?: string; weightColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 py-[1px]">
      <span className={`h-[5px] w-[5px] rounded-full shrink-0 ${dot}`} />
      <span className={`text-[11px] font-bold w-3.5 text-right tabular-nums ${countColor || "text-foreground"}`}>{count}</span>
      <span className={`text-[10px] ${count > 0 && countColor ? "font-semibold" : ""} text-muted-foreground flex-1`}>{label}</span>
      <span className={`text-[10px] font-mono w-14 text-right tabular-nums ${weightColor || "text-muted-foreground"}`}>
        {count > 0 ? `${fmtNum(kg)} kg` : "—"}
      </span>
    </div>
  );
}

// ── Category block ────────────────────────────────────────────

function CategoryBlock({ entries, id, label, Icon, dot, textColor }: {
  entries: WasteEntry[]; id: string; label: string; Icon: React.ElementType; dot: string; textColor: string;
}) {
  const catEntries = entries.filter((e) => !isDisposed(e) && e.waste_category === id);
  if (catEntries.length === 0) return null;
  const ovd = catEntries.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const wrn = catEntries.filter((e) => { const d = getDaysStored(e.generated_date); return d >= 70 && d < DISPOSAL_LIMIT_DAYS; });
  const saf = catEntries.filter((e) => getStatus(e) === "safe");
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Icon className={`h-3 w-3 ${textColor}`} />
        <span className="text-[11px] font-bold text-foreground">{label}</span>
        <span className="text-[9px] text-muted-foreground">({catEntries.length})</span>
      </div>
      <SeverityRow label="Overdue" count={ovd.length} kg={sumWeight(ovd)} dot="bg-overdue" countColor="text-overdue" weightColor="text-overdue" />
      <SeverityRow label="Warning" count={wrn.length} kg={sumWeight(wrn)} dot="bg-orange-500" countColor="text-orange-500" weightColor="text-orange-500" />
      <SeverityRow label="OK" count={saf.length} kg={sumWeight(saf)} dot="bg-success" />
    </div>
  );
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));

  // ── This month
  const thisMonthEntries = entries.filter((e) => isThisMonth(e.generated_date));
  const monthSplit = splitByCatAndUnit(thisMonthEntries);

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
    .filter((wt) => wt.wasteCategory === "e_waste")
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

  return (
    <div className="space-y-4">
      {/* ═══════════ SECTION A: Compliance overview ═══════════ */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Compliance Status
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Left column: Hazardous + Non-Hazardous */}
          <Card>
            <CardContent className="p-3 space-y-3">
              <CategoryBlock entries={entries} id="hazardous" label="Hazardous" Icon={ShieldAlert} dot="bg-overdue" textColor="text-overdue" />
              <CategoryBlock entries={entries} id="non_hazardous" label="Non-Hazardous" Icon={Leaf} dot="bg-success" textColor="text-success" />
            </CardContent>
          </Card>
          {/* Right column: E-Waste + Other Wastes */}
          <Card>
            <CardContent className="p-3 space-y-3">
              <CategoryBlock entries={entries} id="e_waste" label="E-Waste" Icon={Trash2} dot="bg-orange-500" textColor="text-orange-500" />
              <CategoryBlock entries={entries} id="other_wastes" label="Other Wastes" Icon={Recycle} dot="bg-amber-600" textColor="text-amber-600" />
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
                <p className="text-xl font-bold leading-tight">{fmtNum(monthSplit.hazKg)} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-success shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(monthSplit.nonHazKg)} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Non-Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-accent shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(monthSplit.litres)} <span className="text-[10px] font-normal text-muted-foreground">L</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Hazardous Liquid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-orange-500 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(eWasteWeight(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">E-Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-yellow-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(batteryWasteWeight(thisMonthEntries))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Battery Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Recycle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(monthSplit.otherWastesKg)} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Other Wastes</p>
            </CardContent>
          </Card>
        </div>

        {hazSolids.length === 0 && nonHazSolids.length === 0 && otherWastesThisMonth.length === 0 && eWasteThisMonth.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <Package className="h-5 w-5 opacity-40" />
              No waste generated this month yet.
            </CardContent>
          </Card>
        ) : (
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
          </>
        )}
      </section>
    </div>
  );
}
