import { Card, CardContent } from "@/components/ui/card";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  isDisposed, sumByUnit, getMeasureUnit, fmtNum,
} from "@/lib/wasteTypes";
import { Package, AlertTriangle, Clock, Scale, Beaker, CalendarClock } from "lucide-react";

interface Props {
  entries: WasteEntry[];
}

/** Filter entries generated within the current calendar month. */
function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Filter active entries whose 90-day disposal deadline falls in the current month. */
function isDueThisMonth(entry: WasteEntry): boolean {
  if (isDisposed(entry)) return false;
  const gen = new Date(entry.generated_date);
  const due = new Date(gen);
  due.setDate(due.getDate() + DISPOSAL_LIMIT_DAYS);
  const now = new Date();
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const overdue = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const warning = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  const activeTotals = sumByUnit(active);
  const overdueTotals = sumByUnit(overdue);
  const warningTotals = sumByUnit(warning);

  // ── This month: generated per waste type (split by measure unit)
  const thisMonthEntries = entries.filter((e) => isThisMonth(e.generated_date));
  const byTypeThisMonth = WASTE_TYPES.map((wt) => {
    const items = thisMonthEntries.filter((e) => e.waste_type_id === wt.id);
    const total = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
    return { ...wt, total };
  }).filter((w) => w.total > 0);

  const solidsThisMonth = byTypeThisMonth.filter((w) => w.measureUnit === "kg");
  const liquidsThisMonth = byTypeThisMonth.filter((w) => w.measureUnit === "litres");

  const dueThisMonth = active.filter(isDueThisMonth);
  const dueTotals = sumByUnit(dueThisMonth);

  return (
    <div className="space-y-6">
      {/* ═══════════ SECTION A: Cumulative overview ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Cumulative — In Storage
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(activeTotals.kg)}</p>
                <p className="text-[10px] text-muted-foreground">kg of solids in storage</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Beaker className="h-6 w-6 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(activeTotals.litres)}</p>
                <p className="text-[10px] text-muted-foreground">L of liquid in storage</p>
              </div>
            </CardContent>
          </Card>
          <Card className={overdue.length > 0 ? "border-overdue/40" : ""}>
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-overdue shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">
                  {fmtNum(overdueTotals.kg)} kg · {fmtNum(overdueTotals.litres)} L
                </p>
                <p className="text-[10px] text-muted-foreground">Overdue (&gt; 90 days)</p>
              </div>
            </CardContent>
          </Card>
          <Card className={warning.length > 0 ? "border-warning/40" : ""}>
            <CardContent className="p-3 flex items-center gap-2">
              <Clock className="h-6 w-6 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">
                  {fmtNum(warningTotals.kg)} kg · {fmtNum(warningTotals.litres)} L
                </p>
                <p className="text-[10px] text-muted-foreground">Warning (70–89 days)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════ SECTION B: This month ═══════════ */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          This Month
        </h2>

        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                {fmtNum(dueTotals.kg)} kg · {fmtNum(dueTotals.litres)} L
              </p>
              <p className="text-[10px] text-muted-foreground">Disposal due this month</p>
            </div>
          </CardContent>
        </Card>

        {solidsThisMonth.length === 0 && liquidsThisMonth.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <Package className="h-5 w-5 opacity-40" />
              No waste generated this month yet.
            </CardContent>
          </Card>
        ) : (
          <>
            {solidsThisMonth.length > 0 && (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Solids generated this month (kg)
                  </h3>
                  {solidsThisMonth.map((w) => {
                    const max = Math.max(...solidsThisMonth.map((x) => x.total));
                    return (
                      <div key={w.id} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate">{w.name}</span>
                        <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${(w.total / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono font-semibold w-16 text-right">{fmtNum(w.total)} kg</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            {liquidsThisMonth.length > 0 && (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Liquids generated this month (L)
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
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  );
}
