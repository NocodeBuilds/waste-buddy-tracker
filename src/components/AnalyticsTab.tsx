import { useState, useMemo } from "react";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch,
  getMeasureUnit, sumByUnit, fmtNum,
  ALL_TIME_PERIOD, monthPeriod, rangePeriod, fyPeriod, currentFyStartYear,
  recentFinancialYears, recentMonthOptions, filterByPeriod,
  PeriodKind, AnalyticsPeriod,
} from "@/lib/wasteTypes";
import {
  BarChart3, CalendarIcon, TrendingUp, AlertTriangle, Scale, Beaker, Droplets, Activity, X,
} from "lucide-react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid, PieChart, Pie, LineChart, Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
}

export default function AnalyticsTab({ entries, batches }: Props) {
  // ── Period state ──────────────────────────────────────────────

  const [periodKind, setPeriodKind] = useState<PeriodKind>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeOpenStart, setRangeOpenStart] = useState(false);
  const [rangeOpenEnd, setRangeOpenEnd] = useState(false);
  const [selectedFy, setSelectedFy] = useState<number>(currentFyStartYear());

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur - 2019 }, (_, i) => 2020 + i);
  }, []);

  const monthOpts = useMemo(() => recentMonthOptions(24), []);
  const fyOpts = useMemo(() => recentFinancialYears(5), []);

  const period = useMemo<AnalyticsPeriod>(() => {
    if (periodKind === "all") return ALL_TIME_PERIOD;
    if (periodKind === "month") return monthPeriod(selectedYear, selectedMonth);
    if (periodKind === "range" && rangeStart && rangeEnd) return rangePeriod(rangeStart, rangeEnd);
    if (periodKind === "fy") return fyPeriod(selectedFy);
    return ALL_TIME_PERIOD;
  }, [periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy]);

  const periodEntries = useMemo(() => filterByPeriod(entries, period), [entries, period]);
  const periodActive = useMemo(() => periodEntries.filter((e) => !isDisposed(e)), [periodEntries]);

  // ── Key metrics ──────────────────────────────────────────────

  const allDays = periodEntries.map((e) => getDaysStored(e.generated_date)).filter((d) => d >= 0);
  const avgDays = allDays.length > 0
    ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
    : 0;

  const oldest = periodActive.reduce<number | null>((max, e) => {
    const d = getDaysStored(e.generated_date);
    return max === null || d > max ? d : max;
  }, null);
  const daysToNextDisposal = oldest === null ? null : Math.max(0, DISPOSAL_LIMIT_DAYS - oldest);

  const lifetimeTotals = sumByUnit(periodEntries);

  // ── 6-category totals ────────────────────────────────────────

  const hazSolidsKg = periodActive.filter((e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazSolidsKg = periodActive.filter((e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const liquidLitres = periodActive.filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const eWasteKg = periodActive.filter((e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const batteryKg = periodActive.filter((e) => e.waste_type_id === "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const otherWastesKg = periodActive.filter((e) => e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);

  // Activity split
  const activityTotals = (["breakdown", "preventive", "5s", "others"] as const).map((a) => {
    const items = periodEntries.filter((e) => e.activity_type === a);
    const t = sumByUnit(items);
    return { activity: a, kg: t.kg, litres: t.litres };
  });

  // ── Category pie chart data ─────────────────────────────────

  const categoryData = useMemo(() => {
    return [
      { name: `Hazardous (${fmtNum(hazSolidsKg)} kg)`, value: +hazSolidsKg.toFixed(2), color: "hsl(var(--overdue))" },
      { name: `Non-Hazardous (${fmtNum(nonHazSolidsKg)} kg)`, value: +nonHazSolidsKg.toFixed(2), color: "hsl(var(--success))" },
      { name: `Liquid (${fmtNum(liquidLitres)} L)`, value: +liquidLitres.toFixed(2), color: "#06b6d4" },
      { name: `E-Waste (${fmtNum(eWasteKg)} kg)`, value: +eWasteKg.toFixed(2), color: "#f97316" },
      { name: `Battery (${fmtNum(batteryKg)} kg)`, value: +batteryKg.toFixed(2), color: "#ca8a04" },
      { name: `Other (${fmtNum(otherWastesKg)} kg)`, value: +otherWastesKg.toFixed(2), color: "hsl(var(--warning))" },
    ].filter((d) => d.value > 0);
  }, [hazSolidsKg, nonHazSolidsKg, liquidLitres, eWasteKg, batteryKg, otherWastesKg]);

  // ── Aging buckets ────────────────────────────────────────────

  const agingData = useMemo(() => {
    const buckets = [
      { name: "0-30 d", min: 0, max: 30 },
      { name: "31-60 d", min: 31, max: 60 },
      { name: "61-89 d", min: 61, max: 89 },
      { name: ">= 90 d", min: 90, max: Infinity },
    ];
    return buckets.map((b) => {
      const inBucket = periodActive.filter((e) => {
        const d = getDaysStored(e.generated_date);
        return d >= b.min && d <= b.max;
      });
      const t = sumByUnit(inBucket);
      return { name: b.name, kg: +t.kg.toFixed(2), litres: +t.litres.toFixed(2) };
    });
  }, [periodActive]);

  // ── 12-week trend ───────────────────────────────────────────

  const trendData = useMemo(() => {
    const weeks: { week: string; kg: number; litres: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const inRange = periodEntries.filter((e) => {
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
  }, [periodEntries]);

  // ── Top Locations ────────────────────────────────────────────

  const locMap = new Map<string, { kg: number; litres: number }>();
  periodEntries.forEach((e) => {
    const m = locMap.get(e.location ?? "-") ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "litres") m.litres += v; else m.kg += v;
    locMap.set(e.location ?? "-", m);
  });
  const topLocs = Array.from(locMap.entries())
    .sort((a, b) => (b[1].kg + b[1].litres) - (a[1].kg + a[1].litres))
    .slice(0, 5);

  // ── Column colors (kept local for recharts) ─────────────────

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

  return (
    <div className="space-y-4">
      {/* ── Header + inline period selector ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2 whitespace-nowrap">
          <BarChart3 className="h-5 w-5 text-accent" /> Analytics
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
            <SelectTrigger className="h-7 text-[11px] w-auto min-w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="range">Custom Range</SelectItem>
              <SelectItem value="fy">Financial Year</SelectItem>
            </SelectContent>
          </Select>

          {periodKind === "month" && (
            <>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="h-7 text-[11px] w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.slice(-6).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="h-7 text-[11px] w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOpts.filter((o) => o.year === selectedYear).map((o) => (
                    <SelectItem key={o.monthIndex} value={String(o.monthIndex)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {periodKind === "range" && (
            <>
              <Popover open={rangeOpenStart} onOpenChange={setRangeOpenStart}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] font-normal px-2">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeStart || "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined} onSelect={(d) => { if (d) { setRangeStart(format(d, "yyyy-MM-dd")); setRangeOpenStart(false); }}} />
                </PopoverContent>
              </Popover>
              <Popover open={rangeOpenEnd} onOpenChange={setRangeOpenEnd}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] font-normal px-2">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeEnd || "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined} onSelect={(d) => { if (d) { setRangeEnd(format(d, "yyyy-MM-dd")); setRangeOpenEnd(false); }}} />
                </PopoverContent>
              </Popover>
              {(rangeStart || rangeEnd) && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setRangeStart(""); setRangeEnd(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          )}

          {periodKind === "fy" && (
            <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
              <SelectTrigger className="h-7 text-[11px] w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOpts.map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {y}-{String(y + 1).slice(-2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {periodEntries.length === 0 && (
        <DashboardCard>
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No entries in the selected period.</p>
          </div>
        </DashboardCard>
      )}

      {periodEntries.length > 0 && (
        <>
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
                <CalendarIcon
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
                  <p className="text-[10px] text-muted-foreground">Generated (period)</p>
                </div>
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-tight">{fmtNum(lifetimeTotals.litres)} <span className="text-xs font-normal text-muted-foreground">L</span></p>
                  <p className="text-[10px] text-muted-foreground">Generated (period)</p>
                </div>
              </div>
            </DashboardCard>
          </div>

          {/* ── Category pie + Aging bar ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DashboardCard variant="glass">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" /> By Category
                </h3>
                <Badge variant="outline" className="text-[10px]">{categoryData.length}</Badge>
              </div>
              {categoryData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name"
                      innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {categoryData.map((d, i) => (
                        <Cell key={i} fill={d.color} stroke="hsl(var(--background))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name?: string) => {
                      const unit = name && name.includes("Liquid") ? "Ltr" : "kg";
                      return [`${fmtNum(v)} ${unit}`, name?.split(" (")[0] ?? ""];
                    }} />
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
              <Activity className="h-3.5 w-3.5" /> Generation Trend (12 weeks)
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
        </>
      )}
    </div>
  );
}
