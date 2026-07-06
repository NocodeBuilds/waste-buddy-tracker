import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, getStatus, isDisposed,
  getMeasureUnit, unitLabel, sumByUnit, fmtNum,
} from "@/lib/wasteTypes";
import DashboardStats from "./DashboardStats";
import {
  AlertTriangle, Clock, Activity, Zap, Droplets, MapPin,
} from "lucide-react";

interface Props { entries: WasteEntry[]; }

const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  overdue: "hsl(var(--overdue))",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_PALETTE = [
  "hsl(180 90% 55%)",
  "hsl(280 80% 65%)",
  "hsl(40 95% 60%)",
  "hsl(150 70% 50%)",
  "hsl(340 80% 60%)",
  "hsl(220 85% 65%)",
  "hsl(20 90% 60%)",
  "hsl(100 60% 55%)",
  "hsl(260 70% 60%)",
  "hsl(190 80% 55%)",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--popover-foreground))",
};

export default function FuturisticDashboard({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));

  // Category split by weight (kg) — hazardous vs non-hazardous solids.
  // Liquids charted separately since litres and kg can't be mixed.
  const categoryData = useMemo(() => {
    const solids = active.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
    const haz = solids.filter((e) => e.waste_category === "hazardous")
      .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
    const non = solids.filter((e) => e.waste_category === "non_hazardous")
      .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
    return [
      { name: "Hazardous (kg)", value: +haz.toFixed(2), color: COLORS.overdue },
      { name: "Non-hazardous (kg)", value: +non.toFixed(2), color: COLORS.success },
    ].filter((d) => d.value > 0);
  }, [active]);

  // Weight by waste type — solids (kg) only.
  const solidTypeData = useMemo(() => {
    return WASTE_TYPES
      .filter((wt) => wt.measureUnit === "kg")
      .map((wt, i) => {
        const items = active.filter((e) => e.waste_type_id === wt.id);
        const qty = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
        return {
          name: wt.name.length > 18 ? wt.name.slice(0, 16) + "…" : wt.name,
          fullName: wt.name,
          qty: +qty.toFixed(2),
          color: PIE_PALETTE[i % PIE_PALETTE.length],
        };
      })
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [active]);

  // Liquids (litres) — separate chart.
  const liquidTypeData = useMemo(() => {
    return WASTE_TYPES
      .filter((wt) => wt.measureUnit === "litres")
      .map((wt, i) => {
        const items = active.filter((e) => e.waste_type_id === wt.id);
        const qty = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
        return {
          name: wt.name,
          qty: +qty.toFixed(2),
          color: PIE_PALETTE[(i + 3) % PIE_PALETTE.length],
        };
      })
      .filter((d) => d.qty > 0);
  }, [active]);

  // Top locations by kg (solids only).
  const locationData = useMemo(() => {
    const map = new Map<string, { kg: number; litres: number; maxDays: number }>();
    active.forEach((e) => {
      const loc = e.location || "Unspecified";
      const m = map.get(loc) ?? { kg: 0, litres: 0, maxDays: 0 };
      const u = getMeasureUnit(e.waste_type_id);
      const v = Number(e.weight_kg ?? 0);
      if (u === "kg") m.kg += v; else m.litres += v;
      m.maxDays = Math.max(m.maxDays, getDaysStored(e.generated_date));
      map.set(loc, m);
    });
    return Array.from(map.entries())
      .map(([loc, v]) => ({ loc, ...v, kg: +v.kg.toFixed(2), litres: +v.litres.toFixed(2) }))
      .sort((a, b) => (b.kg + b.litres) - (a.kg + a.litres))
      .slice(0, 10);
  }, [active]);

  // Aging buckets by total weight per unit.
  const agingData = useMemo(() => {
    const buckets = [
      { name: "0–30 d", min: 0, max: 30, color: COLORS.success },
      { name: "31–60 d", min: 31, max: 60, color: "hsl(60 80% 55%)" },
      { name: "61–89 d", min: 61, max: 89, color: COLORS.warning },
      { name: "≥ 90 d", min: 90, max: Infinity, color: COLORS.overdue },
    ];
    return buckets.map((b) => {
      const inBucket = active.filter((e) => {
        const d = getDaysStored(e.generated_date);
        return d >= b.min && d <= b.max;
      });
      const t = sumByUnit(inBucket);
      return { name: b.name, kg: +t.kg.toFixed(2), litres: +t.litres.toFixed(2), color: b.color };
    });
  }, [active]);

  // Upcoming disposal (top 6 by soonest deadline).
  const upcoming = useMemo(() => {
    return active
      .map((e) => ({ ...e, daysLeft: DISPOSAL_LIMIT_DAYS - getDaysStored(e.generated_date) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 6);
  }, [active]);

  // 12-week generation trend split into kg + litres lines.
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

  return (
    <div className="space-y-4">
      {/* Two-section summary (cumulative + this month) */}
      <DashboardStats entries={entries} />

      {/* Category + Aging */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
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
                    {categoryData.map((d, i) => <Cell key={i} fill={d.color} stroke="hsl(var(--background))" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmtNum(v)} kg`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Aging (kg + L)
              </h3>
            </div>
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
          </CardContent>
        </Card>
      </div>

      {/* Solid weight by waste type (kg) */}
      {solidTypeData.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Weight by Waste Type (kg)
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(180, solidTypeData.length * 28)}>
              <BarChart data={solidTypeData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={110}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: any, _n, p: any) => [`${v} kg`, p.payload.fullName]} />
                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                  {solidTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Liquid volume by waste type (L) */}
      {liquidTypeData.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5" /> Volume by Waste Type (L)
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(140, liquidTypeData.length * 40)}>
              <BarChart data={liquidTypeData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={110}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} L`, ""]} />
                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                  {liquidTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* By location */}
      {locationData.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Top Locations (kg + L)
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(180, locationData.length * 32)}>
              <BarChart data={locationData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="loc" type="category" width={80}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: any, name: any, p: any) => [`${v} ${name === "kg" ? "kg" : "L"} · max ${p.payload.maxDays}d`, name]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="kg" stackId="a" fill={COLORS.primary} radius={[0, 0, 0, 0]} />
                <Bar dataKey="litres" stackId="a" fill={COLORS.accent} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Generation trend */}
      <Card className="border-border/50 bg-card/70 backdrop-blur">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> 12-Week Generation Trend
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="kg" stroke={COLORS.primary} strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="litres" stroke={COLORS.accent} strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Upcoming disposal */}
      {upcoming.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Disposal Due
            </h3>
            <ul className="divide-y divide-border/50">
              {upcoming.map((e) => {
                const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
                const status = getStatus(e);
                const tone = status === "overdue"
                  ? "text-overdue border-overdue/40 bg-overdue/10"
                  : status === "warning"
                  ? "text-warning border-warning/40 bg-warning/10"
                  : "text-success border-success/40 bg-success/10";
                return (
                  <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {wt?.name ?? e.waste_type_id} · <span className="font-mono text-muted-foreground">{e.location ?? "—"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtNum(Number(e.weight_kg ?? 0))} {unitLabel(getMeasureUnit(e.waste_type_id))} · gen {e.generated_date}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-mono ${tone}`}>
                      {e.daysLeft >= 0 ? `${e.daysLeft}d left` : `${Math.abs(e.daysLeft)}d over`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {upcoming.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 opacity-40" /> No active entries.
        </div>
      )}
    </div>
  );
}
