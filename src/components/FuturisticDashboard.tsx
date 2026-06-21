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
} from "@/lib/wasteTypes";
import {
  Package, AlertTriangle, Clock, CheckCircle, Activity, Zap, Droplets, MapPin,
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

function StatTile({ icon: Icon, label, value, accent, sub }: {
  icon: any; label: string; value: number | string; accent: string; sub?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/70 backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold leading-tight mt-0.5 font-mono tabular-nums">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground/70" />
        </div>
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--popover-foreground))",
};

export default function FuturisticDashboard({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const disposed = entries.filter((e) => isDisposed(e));

  const overdue = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const warning = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  // By category (Hazardous vs Non-hazardous)
  const categoryData = useMemo(() => {
    const haz = active.filter((e) => e.waste_category === "hazardous")
      .reduce((s, e) => s + Number(e.quantity), 0);
    const non = active.filter((e) => e.waste_category === "non_hazardous")
      .reduce((s, e) => s + Number(e.quantity), 0);
    return [
      { name: "Hazardous", value: +haz.toFixed(2), color: COLORS.overdue },
      { name: "Non-hazardous", value: +non.toFixed(2), color: COLORS.success },
    ].filter((d) => d.value > 0);
  }, [active]);

  // By waste type
  const typeData = useMemo(() => {
    return WASTE_TYPES.map((wt, i) => {
      const items = active.filter((e) => e.waste_type_id === wt.id);
      const qty = items.reduce((s, e) => s + Number(e.quantity), 0);
      return {
        name: wt.name.length > 18 ? wt.name.slice(0, 16) + "…" : wt.name,
        fullName: wt.name,
        qty: +qty.toFixed(2),
        unit: wt.unit,
        count: items.length,
        color: PIE_PALETTE[i % PIE_PALETTE.length],
      };
    }).filter((d) => d.qty > 0).sort((a, b) => b.qty - a.qty);
  }, [active]);

  // By location
  const locationData = useMemo(() => {
    const map = new Map<string, { qty: number; count: number; maxDays: number }>();
    active.forEach((e) => {
      const loc = e.location || "Unspecified";
      const m = map.get(loc) ?? { qty: 0, count: 0, maxDays: 0 };
      m.qty += Number(e.quantity);
      m.count += 1;
      m.maxDays = Math.max(m.maxDays, getDaysStored(e.generated_date));
      map.set(loc, m);
    });
    return Array.from(map.entries())
      .map(([loc, v]) => ({ loc, ...v, qty: +v.qty.toFixed(2) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [active]);

  // Aging buckets
  const agingData = useMemo(() => {
    const buckets = [
      { name: "0–30 d", min: 0, max: 30, color: COLORS.success },
      { name: "31–60 d", min: 31, max: 60, color: "hsl(60 80% 55%)" },
      { name: "61–89 d", min: 61, max: 89, color: COLORS.warning },
      { name: "≥ 90 d", min: 90, max: Infinity, color: COLORS.overdue },
    ];
    return buckets.map((b) => ({
      name: b.name,
      count: active.filter((e) => {
        const d = getDaysStored(e.generated_date);
        return d >= b.min && d <= b.max;
      }).length,
      color: b.color,
    }));
  }, [active]);

  // Disposal-due timeline (next 30 days)
  const upcoming = useMemo(() => {
    return active
      .map((e) => {
        const days = getDaysStored(e.generated_date);
        const daysLeft = DISPOSAL_LIMIT_DAYS - days;
        return { ...e, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 6);
  }, [active]);

  // 12-week trend of generation
  const trendData = useMemo(() => {
    const weeks: { week: string; qty: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const qty = entries
        .filter((e) => {
          const d = new Date(e.generated_date);
          return d >= start && d < end;
        })
        .reduce((s, e) => s + Number(e.quantity), 0);
      weeks.push({
        week: `${end.getMonth() + 1}/${end.getDate()}`,
        qty: +qty.toFixed(2),
      });
    }
    return weeks;
  }, [entries]);

  const totalQty = active.reduce((s, e) => s + Number(e.quantity), 0);

  return (
    <div className="space-y-4">
      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={Package} label="In Storage" value={active.length}
          accent="bg-gradient-to-r from-primary to-accent" sub={`${totalQty.toFixed(1)} total units`} />
        <StatTile icon={AlertTriangle} label="Overdue" value={overdue.length}
          accent="bg-overdue" sub="> 90 days" />
        <StatTile icon={Clock} label="Warning" value={warning.length}
          accent="bg-warning" sub="70–89 days" />
        <StatTile icon={CheckCircle} label="Disposed" value={disposed.length}
          accent="bg-success" sub="lifetime" />
      </div>

      {/* Category + Type pie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5" /> By Category
              </h3>
              <Badge variant="outline" className="text-[10px]">{categoryData.length}</Badge>
            </div>
            {categoryData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No active waste</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name"
                    innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {categoryData.map((d, i) => <Cell key={i} fill={d.color} stroke="hsl(var(--background))" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
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
                <Activity className="h-3.5 w-3.5" /> Aging
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agingData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {agingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quantity by waste type */}
      {typeData.length > 0 && (
        <Card className="border-border/50 bg-card/70 backdrop-blur">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Quantity by Waste Type
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(180, typeData.length * 28)}>
              <BarChart data={typeData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={110}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: any, _n, p: any) => [`${v} ${p.payload.unit}`, p.payload.fullName]} />
                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                  {typeData.map((d, i) => <Cell key={i} fill={d.color} />)}
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
              <MapPin className="h-3.5 w-3.5" /> Top Locations
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(180, locationData.length * 28)}>
              <BarChart data={locationData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="loc" type="category" width={80}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: any, _n, p: any) => [`${v} units · ${p.payload.count} entries · max ${p.payload.maxDays}d`, p.payload.loc]} />
                <Bar dataKey="qty" fill={COLORS.primary} radius={[0, 6, 6, 0]} />
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
              <Line type="monotone" dataKey="qty" stroke={COLORS.accent} strokeWidth={2}
                dot={{ r: 3, fill: COLORS.accent }} activeDot={{ r: 5 }} />
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
                        {Number(e.quantity)} {wt?.unit} · gen {e.generated_date}
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
    </div>
  );
}
