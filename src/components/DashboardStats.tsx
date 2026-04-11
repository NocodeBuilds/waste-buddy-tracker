import { Card, CardContent } from "@/components/ui/card";
import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS } from "@/lib/wasteTypes";
import { Package, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface Props {
  entries: WasteEntry[];
}

export default function DashboardStats({ entries }: Props) {
  const active = entries.filter((e) => !e.disposed);
  const disposed = entries.filter((e) => e.disposed);
  const overdue = active.filter((e) => getDaysStored(e.generatedDate) >= DISPOSAL_LIMIT_DAYS);
  const warning = active.filter((e) => {
    const d = getDaysStored(e.generatedDate);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  const wasteTypeSummary = WASTE_TYPES.map((wt) => {
    const items = active.filter((e) => e.wasteTypeId === wt.id);
    const total = items.reduce((s, e) => s + e.quantity, 0);
    return { ...wt, total, count: items.length };
  }).filter((w) => w.count > 0);

  const stats = [
    { label: "Total in Storage", value: active.length, icon: Package, color: "text-primary" },
    { label: "Overdue (≥90 days)", value: overdue.length, icon: AlertTriangle, color: "text-overdue" },
    { label: "Warning (70-89 days)", value: warning.length, icon: Clock, color: "text-warning" },
    { label: "Disposed", value: disposed.length, icon: CheckCircle, color: "text-success" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {wasteTypeSummary.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Current Storage by Waste Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {wasteTypeSummary.map((w) => (
                <div key={w.id} className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{w.total} <span className="text-xs font-normal text-muted-foreground">{w.unit}</span></p>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">{w.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
