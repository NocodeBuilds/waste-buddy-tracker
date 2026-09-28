import { useState, useMemo } from "react";
import DashboardCard from "./dashboard/DashboardCard";
import {
  WasteEntry,
  getDaysStored,
  isDisposed,
  DisposalBatch,
  getMeasureUnit,
  sumByUnit,
  fmtNum,
  ALL_TIME_PERIOD,
  monthPeriod,
  rangePeriod,
  fyPeriod,
  currentFyStartYear,
  recentFinancialYears,
  recentMonthOptions,
  filterByPeriod,
  PeriodKind,
  AnalyticsPeriod,
} from "@/lib/wasteTypes";
import {
  BarChart3,
  Calendar as CalendarIcon,
  AlertTriangle,
  Scale,
  Droplets,
  Activity,
  X,
  TrendingUp,
  MapPin,
  CheckCircle,
  Clock,
  Layers,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
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
  const periodTotals = sumByUnit(periodEntries);
  const activeTotals = sumByUnit(periodActive);

  // ── 6-category totals (in active storage) ─────────────────────
  const hazSolidsKg = periodActive
    .filter((e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazSolidsKg = periodActive
    .filter((e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const liquidLitres = periodActive
    .filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const eWasteKg = periodActive
    .filter((e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const batteryKg = periodActive
    .filter((e) => e.waste_type_id === "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const otherWastesKg = periodActive
    .filter((e) => e.waste_category === "other_wastes" && getMeasureUnit(e.waste_type_id) === "kg")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);

  // Activity breakdown
  const activityTotals = (["preventive", "breakdown", "5s", "others"] as const).map((a) => {
    const items = periodEntries.filter((e) => e.activity_type === a);
    const t = sumByUnit(items);
    const label = a === "preventive" ? "Preventive" : a === "breakdown" ? "Breakdown" : a === "5s" ? "5S" : "Others";
    return { activity: a, label, kg: t.kg, litres: t.litres, count: items.length };
  });

  // ── Category pie chart data ─────────────────────────────────
  const categoryData = useMemo(() => {
    return [
      { name: "Hazardous", value: +hazSolidsKg.toFixed(2), unit: "kg", color: "#e11d48" },
      { name: "Non-Hazardous", value: +nonHazSolidsKg.toFixed(2), unit: "kg", color: "#059669" },
      { name: "Liquid", value: +liquidLitres.toFixed(2), unit: "L", color: "#0284c7" },
      { name: "E-Waste", value: +eWasteKg.toFixed(2), unit: "kg", color: "#7c3aed" },
      { name: "Battery", value: +batteryKg.toFixed(2), unit: "kg", color: "#d97706" },
      { name: "Other", value: +otherWastesKg.toFixed(2), unit: "kg", color: "#64748b" },
    ].filter((d) => d.value > 0);
  }, [hazSolidsKg, nonHazSolidsKg, liquidLitres, eWasteKg, batteryKg, otherWastesKg]);

  // ── Aging buckets ────────────────────────────────────────────
  const agingData = useMemo(() => {
    const buckets = [
      { name: "0-30 d", min: 0, max: 30 },
      { name: "31-60 d", min: 31, max: 60 },
      { name: "61-89 d", min: 61, max: 89 },
      { name: "≥ 90 d", min: 90, max: Infinity },
    ];
    return buckets.map((b) => {
      const inBucket = periodActive.filter((e) => {
        const d = getDaysStored(e.generated_date);
        return d >= b.min && d <= b.max;
      });
      const t = sumByUnit(inBucket);
      return { name: b.name, kg: +t.kg.toFixed(2), litres: +t.litres.toFixed(2), count: inBucket.length };
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
    const m = locMap.get(e.location ?? "General") ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "litres") m.litres += v;
    else m.kg += v;
    locMap.set(e.location ?? "General", m);
  });
  const topLocs = Array.from(locMap.entries())
    .sort((a, b) => b[1].kg + b[1].litres - (a[1].kg + a[1].litres))
    .slice(0, 5);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    borderColor: "hsl(var(--border))",
    borderRadius: "0.625rem",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    padding: "8px 12px",
  };

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Analytics & Trends
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generation patterns, statutory aging distribution, and facility performance metrics
          </p>
        </div>
      </div>

      {/* ── Period Selector Toolbar ── */}
      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Period:</span>
          <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
            <SelectTrigger className="h-9 text-xs w-[130px] rounded-lg">
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
            <div className="flex items-center gap-2">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="h-9 text-xs w-24 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.slice(-6).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="h-9 text-xs w-32 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOpts
                    .filter((o) => o.year === selectedYear)
                    .map((o) => (
                      <SelectItem key={o.monthIndex} value={String(o.monthIndex)}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodKind === "range" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={rangeOpenStart} onOpenChange={setRangeOpenStart}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs font-normal px-2.5 rounded-lg">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    {rangeStart || "From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setRangeStart(format(d, "yyyy-MM-dd"));
                        setRangeOpenStart(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={rangeOpenEnd} onOpenChange={setRangeOpenEnd}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs font-normal px-2.5 rounded-lg">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    {rangeEnd || "To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setRangeEnd(format(d, "yyyy-MM-dd"));
                        setRangeOpenEnd(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              {(rangeStart || rangeEnd) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setRangeStart("");
                    setRangeEnd("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          )}

          {periodKind === "fy" && (
            <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
              <SelectTrigger className="h-9 text-xs w-36 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOpts.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    FY {y}-{String(y + 1).slice(-2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {periodEntries.length === 0 ? (
        <Card className="border-border/80 border-dashed p-10 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40 text-amber-500" />
          <p className="text-sm font-semibold text-foreground">No waste records in selected period</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Try adjusting the period filter or log waste entries to view detailed analytics.
          </p>
        </Card>
      ) : (
        <>
          {/* ── Key Metrics Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-3.5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Total Solids</span>
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {fmtNum(periodTotals.kg)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">kg generated in period</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-3.5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Total Liquids</span>
                  <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {fmtNum(periodTotals.litres)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">L generated in period</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-3.5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">In Storage</span>
                  <Layers className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {periodActive.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtNum(activeTotals.kg)} kg · {fmtNum(activeTotals.litres)} L
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-3.5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Disposal Rate</span>
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {periodEntries.length > 0
                      ? `${Math.round(((periodEntries.length - periodActive.length) / periodEntries.length) * 100)}%`
                      : "0%"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {periodEntries.length - periodActive.length} of {periodEntries.length} disposed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Category Breakdown & Aging Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Category Donut */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      In-Storage Categories
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {categoryData.length} active types
                  </Badge>
                </div>

                {categoryData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-10">No active storage data</p>
                ) : (
                  <div className="h-[210px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {categoryData.map((d, i) => (
                            <Cell key={i} fill={d.color} stroke="hsl(var(--card))" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number, name?: string) => {
                            const match = categoryData.find((d) => d.name === name);
                            return [`${fmtNum(v)} ${match?.unit ?? "kg"}`, name ?? ""];
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                          formatter={(val) => <span className="text-xs text-foreground">{val}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aging Distribution */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Statutory Aging Distribution
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    HOWM 90-Day Rule
                  </Badge>
                </div>

                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.6)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: number, name: string) => [
                          `${fmtNum(val)} ${name === "kg" ? "kg" : "L"}`,
                          name === "kg" ? "Solid Waste" : "Liquid Waste",
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                      <Bar dataKey="kg" fill="#059669" name="Solids (kg)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="litres" fill="#0284c7" name="Liquids (L)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── 12-Week Generation Trend Line Chart ── */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    12-Week Generation Trend
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">Weekly batch aggregates</span>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.6)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      name="Solids (kg)"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#059669" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="litres"
                      name="Liquids (L)"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#0284c7" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ── Activity Split & Top Locations ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Activity Split */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Generation by Maintenance Activity
                  </h3>
                </div>

                <div className="space-y-2.5 pt-1">
                  {activityTotals.map((a) => {
                    const totalWeight = a.kg + a.litres;
                    const maxWeight = Math.max(...activityTotals.map((x) => x.kg + x.litres), 1);
                    const pct = Math.round((totalWeight / maxWeight) * 100);
                    return (
                      <div key={a.activity} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{a.label}</span>
                          <span className="font-mono text-muted-foreground">
                            {fmtNum(a.kg)} kg · {fmtNum(a.litres)} L ({a.count} entries)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Top Locations */}
            {topLocs.length > 0 && (
              <Card className="border-border/80 shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top Waste Generating Locations
                    </h3>
                  </div>

                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topLocs.map(([loc, v]) => ({
                          loc,
                          kg: +v.kg.toFixed(2),
                          litres: +v.litres.toFixed(2),
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border)/0.6)" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="loc"
                          width={75}
                          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar dataKey="kg" stackId="a" fill="#059669" name="Solids (kg)" />
                        <Bar
                          dataKey="litres"
                          stackId="a"
                          fill="#0284c7"
                          name="Liquids (L)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Recent Disposals ── */}
          {batches.length > 0 && (
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent Disposal Batches
                  </h3>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {batches.length} total batches
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {batches.slice(0, 5).map((b) => {
                    const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
                    const t = sumByUnit(inBatch);
                    const status = (b as any).status ?? "approved";
                    return (
                      <div key={b.id} className="flex items-center justify-between py-2.5 text-xs first:pt-1 last:pb-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{b.disposed_date}</span>
                            {status === "approved" ? (
                              <Badge variant="success" className="text-[10px]">
                                Approved
                              </Badge>
                            ) : status === "pending" ? (
                              <Badge variant="warning" className="text-[10px]">
                                Pending
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Rejected
                              </Badge>
                            )}
                          </div>
                          {b.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{b.notes}</p>}
                        </div>
                        <div className="text-right font-mono">
                          <p className="font-semibold text-foreground">
                            {fmtNum(t.kg)} kg · {fmtNum(t.litres)} L
                          </p>
                          <p className="text-[10px] text-muted-foreground">{inBatch.length} entries</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
