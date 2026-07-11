import { useMemo } from "react";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch,
  getMeasureUnit, sumByUnit, fmtNum,
} from "@/lib/wasteTypes";
import { BarChart3, Calendar, TrendingUp, AlertTriangle, Scale, Beaker, Droplets, Activity } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid, PieChart, Pie, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
}

export default function AnalyticsTab({ entries, batches }: Props) {
  const active = entries.filter((e) => !isDisposed(e));

  const COLORS = {
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    overdue: "hsl(var(--overdue))",
    muted: "hsl(var(--muted-foreground))",
  };

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 11,
    color: "hsl(var(--popover-foreground))",
  };

  // ── Key metrics ──────────────────────────────────────────────

  // Avg age across all entries
  const allDays = entries.map((e) => getDaysStored(e.generated_date)).filter((d) => d >= 0);
  const avgDays = allDays.length > 0
    ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
    : 0;

  // Days until oldest active entry hits 90d limit
  const oldest = active.reduce<number | null>((max, e) => {
    const d = getDaysStored(e.generated_date);
    return max === null || d > max ? d : max;
  }, null);
  const daysToNextDisposal = oldest === null ? null : Math.max(0, DISPOSAL_LIMIT_DAYS - oldest);

  // Lifetime totals from all entries
  const lifetimeTotals = sumByUnit(entries);

  // ── Active Solids by Category ────────────────────────────────

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

  // ── Category pie chart data ─────────────────────────────────

  const categoryData = useMemo(() => {
    const haz = solids.filter((e) => e.waste_category === "hazardous")
      .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
    const non = solids.filter((e) => e.waste_category === "non_hazardous")
      .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
    return [
      { name: "Hazardous (kg)", value: +haz.toFixed(2), color: COLORS.overdue },
      { name: "Non-hazardous (kg)", value: +non.toFixed(2), color: COLORS.success },
    ].filter((d) => d.value > 0);
  }, [active]);

  // ── Aging buckets ────────────────────────────────────────────

  const agingData = useMemo(() => {
    const buckets = [
      { name: "0–30 d", min: 0, max: 30 },
      { name: "31–60 d", min: 31, max: 60 },
      { name: "61–89 d", min: 61, max: 89 },
      { name: "≥ 90 d", min: 90, max: Infinity },
    ];
    return buckets.map((b) => {
      const inBucket = active.filter((e) => {
        const d = getDaysStored(e.generated_date);
        return d >= b.min && d <= b.max;
      });
      const t = sumByUnit(inBucket);
      return { name: b.name, kg: +t.kg.toFixed(2), litres: +t.litres.toFixed(2) };
    });
  }, [active]);

  // ── 12-week trend ───────────────────────────────────────────

  const trendData = useMemo(() => {
    const weeks: { week: string; kg: number; litres: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const inRange = entries.filter((e) => {
        const d = new Date(e.generated_date);
        return d >= start && d < end;
      });
      const t = sumByUnit(inRange);
      weeks.push({
        week: `${end.getMonth() + 1}/${end.getDate()}`,
        kg: +t.kg.toFixed(2),
        litres: +t.litres.toFixed(2),
      });
    }
    return weeks;
  }, [entries]);

  // ── Top Locations ────────────────────────────────────────────

  const locMap = new Map<string, { kg: number; litres: number }>();
  entries.forEach((e) => {
    const m = locMap.get(e.location ?? "—") ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "litres") m.litres += v; else m.kg += v;
    locMap.set(e.location ?? "—", m);
  });
  const topLocs = Array.from(locMap.entries())
    .sort((a, b) => (b[1].kg + b[1].litres) - (a[1].kg + a[1].litres))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-accent" /> Analytics
      </h2>

      {/* ── Active Solids by Category (top) ── */}
      <DashboardCard>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Active Solids by Category
        </h3>
        <div className="grid grid-cols-2 gap-3 text-center mb-3">
          <div className="bg-overdue/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-overdue">
              {fmtNum(hazardousKg)} <span className="text-xs font-normal text-muted-foreground">kg</span>
            </p>
            <p className="text-xs text-muted-foreground">Hazardous</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-success">
              {fmtNum(nonHazardousKg)} <span className="text-xs font-normal text-muted-foreground">kg</span>
            </p>
            <p className="text-xs text-muted-foreground">Non-Hazardous</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          {activityTotals.map((a) => (
            <div key={a.activity}>
              <p className="font-bold">{fmtNum(a.kg)} kg · {fmtNum(a.litres)} L</p>
              <p className="text-muted-foreground capitalize">
                {a.activity === "5s" ? "5S" : a.activity}
              </p>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight">{avgDays || "—"} <span className="text-xs font-normal text-muted-foreground">days</span></p>
              <p className="text-[10px] text-muted-foreground">Avg days to disposal</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Calendar
              className={`h-5 w-5 shrink-0 ${daysToNextDisposal !== null && daysToNextDisposal <= 20 ? "text-overdue" : "text-warning"}`}
            />
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight">{daysToNextDisposal ?? "—"} <span className="text-xs font-normal text-muted-foreground">days</span></p>
              <p className="text-[10px] text-muted-foreground">Days to next disposal</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight">{fmtNum(lifetimeTotals.kg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
              <p className="text-[10px] text-muted-foreground">Generated (lifetime)</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight">{fmtNum(lifetimeTotals.litres)} <span className="text-xs font-normal text-muted-foreground">L</span></p>
              <p className="text-[10px] text-muted-foreground">Generated (lifetime)</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* ── Category pie + Aging bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DashboardCard variant="glass">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5" /> By Category (kg)
            </h3>
            <Badge variant="outline" className="text-[10px]">{categoryData.length}</Badge>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No active solid waste</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name"
                  innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {categoryData.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmtNum(v)} kg`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashboardCard>

        <DashboardCard variant="glass">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <Activity className="h-3.5 w-3.5" /> Aging (kg + L)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agingData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="kg" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="litres" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      </div>

      {/* ── 12-Week Trend ── */}
      <DashboardCard variant="glass">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5" /> 12-Week Generation Trend
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="kg" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="litres" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </DashboardCard>

      {/* ── Top Locations ── */}
      {topLocs.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Top Locations (kg + L)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(160, topLocs.length * 40)}>
            <BarChart
              data={topLocs.map(([loc, v]) => ({ loc, kg: +v.kg.toFixed(2), litres: +v.litres.toFixed(2) }))}
              layout="vertical" margin={{ left: 0, right: 24 }}
            >
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

      {/* ── Recent Disposals ── */}
      {batches.length > 0 && (
        <DashboardCard>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
