import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed } from "@/lib/wasteTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Bell } from "lucide-react";

interface Props {
  entries: WasteEntry[];
}

export default function AlertsPanel({ entries }: Props) {
  const active = entries.filter((e) => !isDisposed(e));
  const overdue = active.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS);
  const warnings = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
  });

  if (overdue.length === 0 && warnings.length === 0) return null;

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;
  const getUnit = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.unit || "";

  return (
    <Card className="border-overdue/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-overdue text-base">
          <Bell className="h-5 w-5" />
          Disposal Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {overdue.map((e) => (
          <div key={e.id} className="flex items-start gap-2 bg-overdue/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-overdue mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">{e.wtg_id}</span> — {getWasteName(e.waste_type_id)} ({e.quantity} {getUnit(e.waste_type_id)}) stored for <span className="font-bold text-overdue">{getDaysStored(e.generated_date)} days</span>. Exceeded {DISPOSAL_LIMIT_DAYS}-day limit!
            </div>
          </div>
        ))}
        {warnings.map((e) => (
          <div key={e.id} className="flex items-start gap-2 bg-warning/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">{e.wtg_id}</span> — {getWasteName(e.waste_type_id)} stored for <span className="font-semibold text-warning">{getDaysStored(e.generated_date)} days</span>. Approaching disposal deadline.
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
