import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { WasteEntry, fmtNum, getLocalDate, WASTE_TYPES } from "@/lib/wasteTypes";
import DashboardStats from "./DashboardStats";
import { format } from "date-fns";
import { Clock, Inbox, ShieldAlert, Leaf, Droplets, Trash2, Battery, Recycle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return getLocalDate(monday);
}

function getWeekEnd(): string {
  const monday = new Date(getWeekStart() + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return getLocalDate(sunday);
}

function isThisWeek(dateStr: string): boolean {
  return dateStr >= getWeekStart() && dateStr <= getWeekEnd();
}

function weekLabel(): string {
  const s = new Date(getWeekStart() + "T00:00:00");
  const e = new Date(getWeekEnd() + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-IN", opts)} – ${e.toLocaleDateString("en-IN", opts)}`;
}

export default function FuturisticDashboard({ entries }: Props) {
  // Filter entries from this week (Mon–Sun), newest first
  const weekEntries = useMemo(() => {
    return entries
      .filter((e) => isThisWeek(e.generated_date))
      .sort((a, b) => b.generated_date.localeCompare(a.generated_date));
  }, [entries]);

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case "hazardous":
        return { label: "Hazardous", icon: ShieldAlert, variant: "destructive" as const };
      case "non_hazardous":
        return { label: "Non-Haz", icon: Leaf, variant: "success" as const };
      case "e_waste":
        return { label: "E-Waste", icon: Trash2, variant: "info" as const };
      case "other_wastes":
        return { label: "Other", icon: Recycle, variant: "warning" as const };
      default:
        return { label: "Waste", icon: Recycle, variant: "secondary" as const };
    }
  };

  return (
    <div className="space-y-4">
      {/* Two-section summary (cumulative + this month) */}
      <DashboardStats entries={entries} />

      {/* This Week at a Glance */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Recent Entries ({weekLabel()})
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {weekEntries.length} {weekEntries.length === 1 ? "entry" : "entries"} this week
            </span>
          </div>

          {weekEntries.length > 0 ? (
            <div>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto max-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur-xs text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Waste Type</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-center">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-xs">
                    {weekEntries.map((entry) => {
                      const cat = getCategoryDetails(entry.waste_category);
                      const isLiquid = ["any-liquid","waste-oil","waste-chemical","waste-water","waste-gas","liquid-chemical"].includes(entry.waste_type_id);
                      return (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground text-[11px]">
                            {format(new Date(entry.generated_date + "T00:00:00"), "dd MMM")}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {entry.location || "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">
                            {getWasteName(entry.waste_type_id)}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={cat.variant} className="text-[10px] px-1.5 py-0">
                              {cat.label}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                            {fmtNum(Number(entry.weight_kg ?? 0))} <span className="text-[10px] text-muted-foreground font-normal">{isLiquid ? "L" : "kg"}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase bg-secondary/80 px-1.5 py-0.5 rounded">
                              {entry.activity_type === "preventive" ? "PM" : entry.activity_type === "breakdown" ? "BM" : entry.activity_type === "5s" ? "5S" : "OTH"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="sm:hidden divide-y divide-border/50 max-h-[340px] overflow-y-auto">
                {weekEntries.map((entry) => {
                  const cat = getCategoryDetails(entry.waste_category);
                  const isLiquid = ["any-liquid","waste-oil","waste-chemical","waste-water","waste-gas","liquid-chemical"].includes(entry.waste_type_id);
                  return (
                    <div key={entry.id} className="p-3 space-y-1 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{entry.location || "Facility Area"}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {format(new Date(entry.generated_date + "T00:00:00"), "dd MMM")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {getWasteName(entry.waste_type_id)}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {fmtNum(Number(entry.weight_kg ?? 0))} {isLiquid ? "L" : "kg"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Badge variant={cat.variant} className="text-[9px] px-1.5 py-0">
                          {cat.label}
                        </Badge>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase bg-secondary/80 px-1 py-0.5 rounded">
                          {entry.activity_type === "preventive" ? "PM" : entry.activity_type === "breakdown" ? "BM" : entry.activity_type === "5s" ? "5S" : "OTH"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-xs text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-30" />
              <span>No waste entries recorded this week.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}