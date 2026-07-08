import { useEffect, useState } from "react";
import { WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS, isDisposed, getMeasureUnit, unitLabel, fmtNum } from "@/lib/wasteTypes";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, X, EyeOff } from "lucide-react";
import DashboardCard from "./dashboard/DashboardCard";

interface Props {
  entries: WasteEntry[];
}

const STORAGE_KEY = "hazwaste-dismissed-alerts";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export default function AlertsPanel({ entries }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  // Prune dismissed IDs that no longer exist so storage doesn't grow forever
  useEffect(() => {
    const valid = new Set(entries.map((e) => e.id));
    const pruned = new Set<string>();
    dismissed.forEach((id) => valid.has(id) && pruned.add(id));
    if (pruned.size !== dismissed.size) {
      setDismissed(pruned);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...pruned]));
    }
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: Set<string>) => {
    setDismissed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  };

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    persist(next);
  };

  const active = entries.filter((e) => !isDisposed(e));
  const overdue = active.filter(
    (e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS && !dismissed.has(e.id)
  );
  const warnings = active.filter((e) => {
    const d = getDaysStored(e.generated_date);
    return d >= 70 && d < DISPOSAL_LIMIT_DAYS && !dismissed.has(e.id);
  });

  if (overdue.length === 0 && warnings.length === 0) return null;

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;
  const formatQty = (e: WasteEntry) => `${fmtNum(Number(e.weight_kg ?? 0))} ${unitLabel(getMeasureUnit(e.waste_type_id))}`;

  const hideAll = () => {
    const next = new Set(dismissed);
    [...overdue, ...warnings].forEach((e) => next.add(e.id));
    persist(next);
  };

  return (
    <DashboardCard variant="alert">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2 text-overdue">
          <Bell className="h-5 w-5" />
          Disposal Alerts
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={hideAll}
        >
          <EyeOff className="h-3.5 w-3.5" /> Hide all
        </Button>
      </div>
      <div className="space-y-2">
        {overdue.map((e) => (
          <div key={e.id} className="flex items-start gap-2 bg-overdue/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-overdue mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <span className="font-semibold">{e.location}</span> — {getWasteName(e.waste_type_id)} ({formatQty(e)}) stored for <span className="font-bold text-overdue">{getDaysStored(e.generated_date)} days</span>. Exceeded {DISPOSAL_LIMIT_DAYS}-day limit!
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => dismiss(e.id)}
              aria-label="Hide alert"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {warnings.map((e) => (
          <div key={e.id} className="flex items-start gap-2 bg-warning/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <span className="font-semibold">{e.location}</span> — {getWasteName(e.waste_type_id)} stored for <span className="font-semibold text-warning">{getDaysStored(e.generated_date)} days</span>. Approaching disposal deadline.
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => dismiss(e.id)}
              aria-label="Hide alert"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
