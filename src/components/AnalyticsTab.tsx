import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch,
  getMeasureUnit, sumByUnit, fmtNum,
} from "@/lib/wasteTypes";
import { BarChart3, Calendar, TrendingUp, AlertTriangle, Scale, Beaker } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid } from "recharts";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
}

export default function AnalyticsTab({ entries, batches }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const disposed = entries.filter((e) => isDisposed(e));

  // Avg days to disposal
  const batchMap = new Map(batches.map((b) => [b.id, b]));
  const disposedWithDays = disposed
    .map((e) => {
      const batch = batchMap.get(e.disposal_batch_id!);
      if (!batch) return null;
      const gen = new Date(e.generated_date).getTime();
      const dis = new Date(batch.disposed_date).getTime();
      return Math.floor((dis - gen) / (1000 * 60 * 60 * 24));
    })
    .filter((n): n is number => n !== null);
  const avgDays = disposedWithDays.length > 0
    ? Math.round(disposedWithDays.reduce((a, b) => a + b, 0) / disposedWithDays.length)
    : 0;

  // Days until oldest active entry hits 90d
  const oldest = active.reduce<number | null>((max, e) => {
    const d = getDaysStored(e.generated_date);
    return max === null || d > max ? d : max;
  }, null);
  const daysToNextDisposal = oldest === null ? null : Math.max(0, DISPOSAL_LIMIT_DAYS - oldest);

  const disposedTotals = sumByUnit(disposed);

  // Category (kg only — mixing units is misleading)
  const solids = active.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const hazardousKg = solids.filter((e) => e.waste_category === "hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazardousKg = solids.filter((e) => e.waste_category === "non_hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);

  // Activity split by weight
  const activityTotals = (["breakdown", "preventive", "5s"] as const).map((a) => {
    const items = entries.filter((e) => e.activity_type === a);
    const t = sumByUnit(items);
    return { activity: a, kg: t.kg, litres: t.litres };
  });

  // Top Locations by kg
  const locMap = new Map<string, { kg: number; litres: number }>();
  entries.forEach((e) => {
    const m = locMap.get(e.location ?? "—") ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "kg") m.kg += v; else m.litres += v;
    locMap.set(e.location ?? "—", m);
  });
  const topWtgs = Array.from(locMap.entries())
    .sort((a, b) => (b[1].kg + b[1].litres) - (a[1].kg + a[1].litres))
    .slice(0, 5);

  // Bar chart: cumulative kg per solid waste type
  const solidChart = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "kg")
    .map((wt) => {
      const items = active.filter((e) => e.waste_type_id === wt.id);
      const qty = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
      return { name: wt.name.split(" ").slice(0, 2).join(" "), qty: +qty.toFixed(2) };
    }).filter((d) => d.qty > 0);

  const liquidChart = WASTE_TYPES
    .filter((wt) => wt.measureUnit === "litres")
    .map((wt) => {
      const items = active.filter((e) => e.waste_type_id === wt.id);
      const qty = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
      return { name: wt.name, qty: +qty.toFixed(2) };
    }).filter((d) => d.qty > 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-accent" /> Analytics
      </h2>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-tight">{avgDays || "—"}</p>
              <p className="text-[10px] text-muted-foreground">Avg days to disposal</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Calendar className={`h-5 w-5 shrink-0 ${daysToNextDisposal !== null && daysToNextDisposal <= 20 ? "text-overdue" : "text-warning"}`} />
            <div>
              <p className="text-2xl font-bold leading-tight">{daysToNextDisposal ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">Days to next disposal</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-tight">{fmtNum(disposedTotals.kg)}</p>
              <p className="text-[10px] text-muted-foreground">kg disposed (lifetime)</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-accent shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-tight">{fmtNum(disposedTotals.litres)}</p>
              <p className="text-[10px] text-muted-foreground">L disposed (lifetime)</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Category (kg) */}
      <DashboardCard>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Active Solids by Category
        </h3>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-overdue/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-overdue">{fmtNum(hazardousKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Hazardous</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-success">{fmtNum(nonHazardousKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">Non-Hazardous</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          {activityTotals.map((a) => (
            <div key={a.activity}>
              <p className="font-bold">{fmtNum(a.kg)}k · {fmtNum(a.litres)}L</p>
              <p className="text-muted-foreground capitalize">
                {a.activity === "5s" ? "5S" : a.activity}
              </p>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Solids by waste type */}
      {solidChart.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cumulative Solids by Waste Type (kg)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(180, solidChart.length * 32)}>
            <BarChart data={solidChart} layout="vertical" margin={{ left: 0, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} kg`, "Weight"]} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                {solidChart.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {/* Liquids by waste type */}
      {liquidChart.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cumulative Liquids by Waste Type (L)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(140, liquidChart.length * 40)}>
            <BarChart data={liquidChart} layout="vertical" margin={{ left: 0, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} L`, "Volume"]} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                {liquidChart.map((_, i) => <Cell key={i} fill="hsl(var(--accent))" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {/* Top Locations (kg + L) */}
      {topWtgs.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Top Locations (kg + L)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(160, topWtgs.length * 40)}>
            <BarChart data={topWtgs.map(([loc, v]) => ({ loc, kg: +v.kg.toFixed(2), litres: +v.litres.toFixed(2) }))}
              layout="vertical" margin={{ left: 0, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="loc" width={70} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="kg" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="litres" stackId="a" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {/* Disposal history */}
      {batches.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Disposals
          </h3>
          <div className="space-y-2">
            {batches.slice(0, 5).map((b) => {
              const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
              const t = sumByUnit(inBatch);
              return (
                <div key={b.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0">
                  <div>
                    <p className="font-medium">{b.disposed_date}</p>
                    <p className="text-xs text-muted-foreground">{fmtNum(t.kg)} kg · {fmtNum(t.litres)} L</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}

      {entries.length === 0 && (
        <DashboardCard>
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No data yet — log waste entries to see analytics.</p>
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
