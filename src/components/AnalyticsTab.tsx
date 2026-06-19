import { Card, CardContent } from "@/components/ui/card";
import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch } from "@/lib/wasteTypes";
import { BarChart3, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
}

export default function AnalyticsTab({ entries, batches }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const disposed = entries.filter((e) => isDisposed(e));

  // Avg days to disposal (entry.generated_date → batch.disposed_date)
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

  // Category split
  const hazardous = active.filter((e) => e.waste_category === "hazardous");
  const nonHazardous = active.filter((e) => e.waste_category === "non_hazardous");

  // Activity split
  const breakdownEntries = entries.filter((e) => e.activity_type === "breakdown");
  const preventiveEntries = entries.filter((e) => e.activity_type === "preventive");

  // Top WTGs
  const wtgCounts: Record<string, number> = {};
  entries.forEach((e) => {
    wtgCounts[e.location] = (wtgCounts[e.location] || 0) + 1;
  });
  const topWtgs = Object.entries(wtgCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Bar chart data: cumulative qty per waste type (active only)
  const wasteChartData = WASTE_TYPES.map((wt) => {
    const items = active.filter((e) => e.waste_type_id === wt.id);
    const qty = items.reduce((s, e) => s + Number(e.quantity), 0);
    return { name: wt.name.split(" ").slice(0, 2).join(" "), unit: wt.unit, qty };
  }).filter((d) => d.qty > 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-accent" /> Analytics
      </h2>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xl font-bold">{avgDays || "—"}</p>
              <p className="text-[10px] text-muted-foreground">Avg days to disposal</p>
            </div>
          </CardContent>
        </Card>
        <Card className={daysToNextDisposal !== null && daysToNextDisposal <= 20 ? "border-overdue/40" : ""}>
          <CardContent className="p-3 flex items-center gap-2">
            <Calendar className={`h-5 w-5 shrink-0 ${daysToNextDisposal !== null && daysToNextDisposal <= 20 ? "text-overdue" : "text-warning"}`} />
            <div>
              <p className="text-xl font-bold">{daysToNextDisposal ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">Days to next disposal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{batches.length}</p>
            <p className="text-[10px] text-muted-foreground">Disposals tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-[10px] text-muted-foreground">Total entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardContent className="p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Active Waste by Category
          </h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-overdue/10 rounded-lg p-3">
              <p className="text-2xl font-bold text-overdue">{hazardous.length}</p>
              <p className="text-xs text-muted-foreground">Hazardous</p>
            </div>
            <div className="bg-success/10 rounded-lg p-3">
              <p className="text-2xl font-bold text-success">{nonHazardous.length}</p>
              <p className="text-xs text-muted-foreground">Non-Hazardous</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2 text-center text-xs">
            <div>
              <p className="font-bold">{breakdownEntries.length}</p>
              <p className="text-muted-foreground">Breakdown</p>
            </div>
            <div>
              <p className="font-bold">{preventiveEntries.length}</p>
              <p className="text-muted-foreground">Preventive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar chart by waste type */}
      {wasteChartData.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Cumulative Quantity by Waste Type
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(180, wasteChartData.length * 32)}>
              <BarChart data={wasteChartData} layout="vertical" margin={{ left: 0, right: 24 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, _name, props) => [`${value} ${props.payload.unit}`, "Qty"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {wasteChartData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top WTGs */}
      {topWtgs.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Top WTGs by Waste Count
            </h3>
            <div className="space-y-2">
              {topWtgs.map(([wtg, count]) => {
                const maxCount = topWtgs[0][1];
                return (
                  <div key={wtg} className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold w-16 shrink-0">{wtg}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disposal history */}
      {batches.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Recent Disposals
            </h3>
            <div className="space-y-2">
              {batches.slice(0, 5).map((b) => {
                const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
                return (
                  <div key={b.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0">
                    <div>
                      <p className="font-medium">{b.disposed_date}</p>
                      <p className="text-xs text-muted-foreground">{inBatch.length} entries</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No data yet — log waste entries to see analytics.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
