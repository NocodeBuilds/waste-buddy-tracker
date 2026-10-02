import { useEffect, useState } from "react";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, DISPOSAL_LIMIT_DAYS,
  isDisposed, getMeasureUnit, unitLabel, fmtNum,
  isEntryOverdue, isEntryWarning, formatDateDDMMYYYY,
} from "@/lib/wasteTypes";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, X, EyeOff } from "lucide-react";

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
  const overdue = active.filter((e) => isEntryOverdue(e) && !dismissed.has(e.id));
  const warnings = active.filter((e) => isEntryWarning(e) && !dismissed.has(e.id));

  if (overdue.length === 0 && warnings.length === 0) return null;

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;
  const formatQty = (e: WasteEntry) => `${fmtNum(Number(e.weight_kg ?? 0))} ${unitLabel(getMeasureUnit(e.waste_type_id))}`;

  const hideAll = () => {
    const next = new Set(dismissed);
    [...overdue, ...warnings].forEach((e) => next.add(e.id));
    persist(next);
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-lg">
      <div className="px-3.5 py-2.5 border-b border-border/80 flex items-center justify-between gap-2 bg-muted/30">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          <Bell className="h-3.5 w-3.5" />
          Disposal Alerts ({overdue.length + warnings.length})
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2"
          onClick={hideAll}
        >
          <EyeOff className="h-3 w-3" /> Hide all
        </Button>
      </div>
      <div className="p-2.5 space-y-2 max-h-[60vh] overflow-y-auto">
        {overdue.map((e) => (
          <div key={e.id} className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 p-2.5 rounded-lg text-foreground">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="text-xs flex-1 min-w-0 leading-relaxed">
              <span className="font-semibold text-rose-950 dark:text-rose-100">{e.location || "Facility"}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium text-foreground">{getWasteName(e.waste_type_id)}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>{formatQty(e)}</span>
                <span>•</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">Stored {getDaysStored(e.generated_date)}d (Since {formatDateDDMMYYYY(e.generated_date)})</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-rose-500/15 rounded-md"
              onClick={() => dismiss(e.id)}
              aria-label="Hide alert"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {warnings.map((e) => (
          <div key={e.id} className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-lg text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs flex-1 min-w-0 leading-relaxed">
              <span className="font-semibold text-amber-950 dark:text-amber-100">{e.location || "Facility"}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium text-foreground">{getWasteName(e.waste_type_id)}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>{formatQty(e)}</span>
                <span>•</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">Stored {getDaysStored(e.generated_date)}d (Since {formatDateDDMMYYYY(e.generated_date)})</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-amber-500/15 rounded-md"
              onClick={() => dismiss(e.id)}
              aria-label="Hide alert"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
