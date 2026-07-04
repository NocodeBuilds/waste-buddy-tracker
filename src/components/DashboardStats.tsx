import { Card, CardContent } from "@/components/ui/card";
import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, getStatus, isDisposed } from "@/lib/wasteTypes";
import { Package, AlertTriangle, CheckCircle, Clock, Droplets, Recycle, Scale, Beaker, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  entries: WasteEntry[];
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const disposed = entries.filter((e) => isDisposed(e));
  const overdue = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const warning = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  const stats = [
    { label: "In Storage", value: active.length, icon: Package, color: "text-primary" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, color: "text-overdue" },
    { label: "Warning", value: warning.length, icon: Clock, color: "text-warning" },
    { label: "Disposed", value: disposed.length, icon: CheckCircle, color: "text-success" },
  ];

  // Cumulative by waste type (active only)
  const cumulative = WASTE_TYPES.map((wt) => {
    const items = active.filter((e) => e.waste_type_id === wt.id);
    const totalQty = items.reduce((s, e) => s + Number(e.quantity), 0);
    const maxDays = items.length > 0 ? Math.max(...items.map((e) => getDaysStored(e.generated_date))) : 0;
    const overdueCount = items.filter((e) => getStatus(e) === "overdue").length;
    const warningCount = items.filter((e) => getStatus(e) === "warning").length;
    const hazardous = items.some((e) => e.waste_category === "hazardous");
    return { ...wt, totalQty, count: items.length, maxDays, overdueCount, warningCount, hazardous };
  }).filter((w) => w.count > 0);

  // Cumulative by category
  const hazardousTotal = active.filter((e) => e.waste_category === "hazardous").length;
  const nonHazardousTotal = active.filter((e) => e.waste_category === "non_hazardous").length;

  // Totals grouped by measurement unit (kg / litres / nos)
  const unitTotals = active.reduce<Record<string, number>>((acc, e) => {
    const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
    if (!wt) return acc;
    acc[wt.unit] = (acc[wt.unit] ?? 0) + Number(e.quantity);
    return acc;
  }, {});
  const fmt = (n: number) => n.toFixed(2).replace(/\.00$/, "");

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`h-6 w-6 ${s.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category split */}
      {(hazardousTotal + nonHazardousTotal) > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-overdue/30">
            <CardContent className="p-3 flex items-center gap-2">
              <Droplets className="h-6 w-6 text-overdue shrink-0" />
              <div>
                <p className="text-xl font-bold">{hazardousTotal}</p>
                <p className="text-[10px] text-muted-foreground">Hazardous</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-3 flex items-center gap-2">
              <Recycle className="h-6 w-6 text-success shrink-0" />
              <div>
                <p className="text-xl font-bold">{nonHazardousTotal}</p>
                <p className="text-[10px] text-muted-foreground">Non-Hazardous</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cumulative available waste */}
      {cumulative.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Cumulative Available Waste
          </h3>
          <div className="space-y-2">
            {cumulative.map((w) => (
              <Card key={w.id} className={w.overdueCount > 0 ? "border-overdue/40" : w.warningCount > 0 ? "border-warning/40" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight truncate">{w.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{w.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold leading-tight text-primary">
                        {w.totalQty.toFixed(2).replace(/\.00$/, "")} <span className="text-xs font-normal text-muted-foreground">{w.unit}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{w.count} entries</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs font-medium ${w.maxDays >= DISPOSAL_LIMIT_DAYS ? "text-overdue" : w.maxDays >= 70 ? "text-warning" : "text-muted-foreground"}`}>
                      Max: {w.maxDays} days
                    </span>
                    {w.overdueCount > 0 && (
                      <Badge className="bg-overdue text-overdue-foreground text-[10px] px-1.5 py-0">
                        {w.overdueCount} overdue
                      </Badge>
                    )}
                    {w.warningCount > 0 && (
                      <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">
                        {w.warningCount} warning
                      </Badge>
                    )}
                    {w.overdueCount === 0 && w.warningCount === 0 && (
                      <Badge className="bg-success/20 text-success border border-success/30 text-[10px] px-1.5 py-0">
                        All safe
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
