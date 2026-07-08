import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  isDisposed, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import {
  Package, AlertTriangle, Clock, Scale, Beaker, CalendarClock,
  ShieldAlert, Leaf,
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
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-overdue/30">
            <CardContent className="p-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(cumul.hazKg)}</p>
                <p className="text-[10px] text-muted-foreground">kg hazardous solids</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-4 flex items-center gap-2">
              <Leaf className="h-5 w-5 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(cumul.nonHazKg)}</p>
                <p className="text-[10px] text-muted-foreground">kg non-hazardous solids</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Beaker className="h-5 w-5 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(cumul.litres)}</p>
                <p className="text-[10px] text-muted-foreground">L of liquid in storage</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(cumul.hazKg + cumul.nonHazKg)}</p>
                <p className="text-[10px] text-muted-foreground">kg total solids</p>
              </div>
            </CardContent>
          </Card>
          <Card className={overdue.length > 0 ? "border-overdue/40" : ""}>
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-overdue shrink-0" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">
                  {fmtNum(overdueSplit.hazKg + overdueSplit.nonHazKg)} kg · {fmtNum(overdueSplit.litres)} L
                </p>
                <p className="text-[10px] text-muted-foreground">Overdue (&gt; 90 days)</p>
              </div>
            </CardContent>
          </Card>
          <Card className={warning.length > 0 ? "border-warning/40" : ""}>
            <CardContent className="p-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">
                  {fmtNum(warningSplit.hazKg + warningSplit.nonHazKg)} kg · {fmtNum(warningSplit.litres)} L
                </p>
                <p className="text-[10px] text-muted-foreground">Warning (70–89 days)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════ SECTION B: This month ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          This Month
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-overdue/30">
            <CardContent className="p-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(monthSplit.hazKg)}</p>
                <p className="text-[10px] text-muted-foreground">kg hazardous generated</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-4 flex items-center gap-2">
              <Leaf className="h-5 w-5 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(monthSplit.nonHazKg)}</p>
                <p className="text-[10px] text-muted-foreground">kg non-hazardous generated</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Beaker className="h-5 w-5 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(monthSplit.litres)}</p>
                <p className="text-[10px] text-muted-foreground">L liquid generated</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">
                  {fmtNum(dueSplit.hazKg + dueSplit.nonHazKg)} kg · {fmtNum(dueSplit.litres)} L
                </p>
                <p className="text-[10px] text-muted-foreground">Disposal due this month</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {hazSolids.length === 0 && nonHazSolids.length === 0 && liquidsThisMonth.length === 0 ? (
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
                  Hazardous solids this month (kg)
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
                  Non-hazardous solids this month (kg)
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
            {liquidsThisMonth.length > 0 && (
              <DashboardCard>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Beaker className="h-3.5 w-3.5 text-accent" />
                  Liquids this month (L)
                </h3>
                {liquidsThisMonth.map((w) => {
                  const max = Math.max(...liquidsThisMonth.map((x) => x.total));
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{w.name}</span>
                      <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-accent h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} L</span>
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
