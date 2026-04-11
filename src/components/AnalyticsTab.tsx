import { Card, CardContent } from "@/components/ui/card";
import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS } from "@/lib/wasteTypes";
import { BarChart3 } from "lucide-react";

interface Props {
  entries: WasteEntry[];
}

export default function AnalyticsTab({ entries }: Props) {
  const active = entries.filter((e) => !e.disposed);
  const disposed = entries.filter((e) => e.disposed);

  // Waste by activity type
  const breakdownEntries = entries.filter((e) => e.activityType === "breakdown");
  const preventiveEntries = entries.filter((e) => e.activityType === "preventive");

  // Top WTGs by waste count
  const wtgCounts: Record<string, number> = {};
  entries.forEach((e) => {
    wtgCounts[e.wtgId] = (wtgCounts[e.wtgId] || 0) + 1;
  });
  const topWtgs = Object.entries(wtgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Average days to disposal
  const disposedWithDates = disposed.filter((e) => e.disposedDate);
  const avgDays = disposedWithDates.length > 0
    ? Math.round(
        disposedWithDates.reduce((s, e) => {
          const gen = new Date(e.generatedDate).getTime();
          const dis = new Date(e.disposedDate!).getTime();
          return s + (dis - gen) / (1000 * 60 * 60 * 24);
        }, 0) / disposedWithDates.length
      )
    : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-accent" /> Analytics
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{avgDays}</p>
            <p className="text-[10px] text-muted-foreground">Avg Days to Dispose</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{breakdownEntries.length}</p>
            <p className="text-[10px] text-muted-foreground">Breakdown</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{preventiveEntries.length}</p>
            <p className="text-[10px] text-muted-foreground">Preventive</p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
