import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ShieldAlert,
  Leaf,
  Droplets,
  Cpu,
  Battery,
  Recycle,
  Scale,
  Calendar as CalendarIcon,
  RotateCcw,
  X,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  fmtNum,
  formatDateDDMMYYYY,
  PeriodKind,
  AnalyticsPeriod,
} from "@/lib/wasteTypes";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface StorageBreakdownMetrics {
  hazKg: number;
  nonHazKg: number;
  totals: { kg: number; litres: number };
  eWasteKg: number;
  batteryKg: number;
  otherKg: number;
  byType: Array<{
    id: string;
    name: string;
    total: number;
    measureUnit: string;
    wasteCategory: string;
  }>;
}

interface Props {
  // Primary metrics (active in storage for the selected period)
  hazKg: number;
  nonHazKg: number;
  totals: { kg: number; litres: number };
  eWasteKg: number;
  batteryKg: number;
  otherKg: number;
  byType: Array<{
    id: string;
    name: string;
    total: number;
    measureUnit: string;
    wasteCategory: string;
  }>;

  // Period filter state and handlers
  period: AnalyticsPeriod;
  periodKind: PeriodKind;
  onPeriodKindChange: (kind: PeriodKind) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  rangeStart: string;
  onRangeStartChange: (date: string) => void;
  rangeEnd: string;
  onRangeEndChange: (date: string) => void;
  rangeOpenStart: boolean;
  onRangeOpenStartChange: (open: boolean) => void;
  rangeOpenEnd: boolean;
  onRangeOpenEndChange: (open: boolean) => void;
  selectedFy: number;
  onFyChange: (fy: number) => void;
  years: number[];
  monthOpts: Array<{ year: number; monthIndex: number; label: string }>;
  fyOpts: number[];

  // Context counts
  periodActiveCount: number;
  periodDisposedCount: number;
  periodTotalCount: number;
  allActiveCount: number;

  // Secondary metrics for comparison toggling
  allTimeMetrics?: StorageBreakdownMetrics;
  periodTotalMetrics?: StorageBreakdownMetrics;
}

export default function StorageBreakdownView({
  hazKg,
  nonHazKg,
  totals,
  eWasteKg,
  batteryKg,
  otherKg,
  byType,
  period,
  periodKind,
  onPeriodKindChange,
  selectedYear,
  onYearChange,
  selectedMonth,
  onMonthChange,
  rangeStart,
  onRangeStartChange,
  rangeEnd,
  onRangeEndChange,
  rangeOpenStart,
  onRangeOpenStartChange,
  rangeOpenEnd,
  onRangeOpenEndChange,
  selectedFy,
  onFyChange,
  years,
  monthOpts,
  fyOpts,
  periodActiveCount,
  periodDisposedCount,
  periodTotalCount,
  allActiveCount,
  allTimeMetrics,
  periodTotalMetrics,
}: Props) {
  // Focus mode: "active" (period active in storage), "generated" (total period output), or "all_yard" (all-time active)
  const [focusMode, setFocusMode] = useState<"active" | "generated" | "all_yard">("active");

  // Determine active dataset to display based on focusMode
  const activeDisplayMetrics =
    focusMode === "all_yard" && allTimeMetrics
      ? allTimeMetrics
      : focusMode === "generated" && periodTotalMetrics
      ? periodTotalMetrics
      : {
          hazKg,
          nonHazKg,
          totals,
          eWasteKg,
          batteryKg,
          otherKg,
          byType,
        };

  const currentCount =
    focusMode === "all_yard"
      ? allActiveCount
      : focusMode === "generated"
      ? periodTotalCount
      : periodActiveCount;

  return (
    <div className="space-y-3.5">
      {/* ── Period Filter & Perspective Toolbar ── */}
      <div className="rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-xs space-y-2 sm:space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-2.5">
          {/* Period selector dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <Select value={periodKind} onValueChange={(v) => onPeriodKindChange(v as PeriodKind)}>
              <SelectTrigger className="h-7 sm:h-8 text-xs w-[115px] sm:w-[130px] rounded-lg bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="range">Custom Range</SelectItem>
                <SelectItem value="fy">Financial Year</SelectItem>
              </SelectContent>
            </Select>

            {periodKind !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 sm:px-2 text-xs text-muted-foreground hover:text-foreground gap-1 ml-auto sm:ml-0"
                onClick={() => onPeriodKindChange("all")}
                title="Reset filter to All Time"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span> All Time
              </Button>
            )}
          </div>

          {/* Perspective Focus Selector (Active vs Generated vs Entire Yard) */}
          <div className="grid grid-cols-3 sm:flex p-0.5 bg-muted/70 rounded-lg gap-0.5 text-xs w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFocusMode("active")}
              className={cn(
                "px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all text-center truncate",
                focusMode === "active"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="sm:hidden">Storage ({periodActiveCount})</span>
              <span className="hidden sm:inline">In Storage ({periodActiveCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusMode("generated")}
              className={cn(
                "px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all text-center truncate",
                focusMode === "generated"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="sm:hidden">Output ({periodTotalCount})</span>
              <span className="hidden sm:inline">Period Output ({periodTotalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusMode("all_yard")}
              className={cn(
                "px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all text-center truncate",
                focusMode === "all_yard"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="sm:hidden">Yard ({allActiveCount})</span>
              <span className="hidden sm:inline">Entire Yard Active ({allActiveCount})</span>
            </button>
          </div>
        </div>

        {/* ── Sub-Filters for Month / Custom Range / FY ── */}
        {periodKind === "month" && (
          <div className="flex items-center gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-border/50">
            <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground">Select Month:</span>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 flex-1 sm:flex-initial">
              <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-full sm:w-20 rounded-md bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.slice(-6).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-full sm:w-28 rounded-md bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOpts
                    .filter((o) => o.year === selectedYear)
                    .map((o) => (
                      <SelectItem key={o.monthIndex} value={String(o.monthIndex)}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
              Filtering waste records generated in {period.label}
            </span>
          </div>
        )}

        {periodKind === "range" && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-border/50">
            <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground">Custom Date Range:</span>
            <div className="grid grid-cols-2 gap-1.5 items-center flex-1 sm:flex-initial">
              <Popover open={rangeOpenStart} onOpenChange={onRangeOpenStartChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-normal px-2 rounded-md bg-background justify-start truncate">
                    <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{rangeStart ? formatDateDDMMYYYY(rangeStart) : "From Date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        onRangeStartChange(format(d, "yyyy-MM-dd"));
                        onRangeOpenStartChange(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={rangeOpenEnd} onOpenChange={onRangeOpenEndChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-normal px-2 rounded-md bg-background justify-start truncate">
                    <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{rangeEnd ? formatDateDDMMYYYY(rangeEnd) : "To Date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        onRangeEndChange(format(d, "yyyy-MM-dd"));
                        onRangeOpenEndChange(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(rangeStart || rangeEnd) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground self-end sm:self-auto"
                onClick={() => {
                  onRangeStartChange("");
                  onRangeEndChange("");
                }}
                title="Clear date range"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Range
              </Button>
            )}

            <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
              Dates formatted in DD-MM-YYYY
            </span>
          </div>
        )}

        {periodKind === "fy" && (
          <div className="flex items-center gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-border/50">
            <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground">Select Financial Year:</span>
            <Select value={String(selectedFy)} onValueChange={(v) => onFyChange(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-full sm:w-32 rounded-md bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOpts.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    FY {y}-{String(y + 1).slice(-2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
              Statutory 1 April → 31 March reporting window
            </span>
          </div>
        )}

        {/* ── Period Summary Context Chips: Desktop full view ── */}
        <div className="hidden sm:flex items-center gap-3 pt-2 border-t border-border/40 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">Showing:</span>
            <span className="text-foreground">
              {focusMode === "all_yard"
                ? "Entire Yard Active Inventory (All Time)"
                : focusMode === "generated"
                ? `Total Output Generated in ${period.label}`
                : `Currently In Storage from ${period.label}`}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto text-[11px]">
            <span className="font-mono text-muted-foreground">
              Total Weight: <strong className="text-foreground">{fmtNum(activeDisplayMetrics.totals.kg)} kg</strong>
            </span>
            <span>·</span>
            <span className="font-mono text-muted-foreground">
              Liquids: <strong className="text-foreground">{fmtNum(activeDisplayMetrics.totals.litres)} L</strong>
            </span>
            <span>·</span>
            <span className="font-mono text-muted-foreground">
              Entries: <strong className="text-foreground">{currentCount}</strong>
            </span>
          </div>
        </div>

        {/* Mobile ultra-compact 1-line mini metric indicator */}
        <div className="sm:hidden flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40 px-0.5">
          <span>{fmtNum(activeDisplayMetrics.totals.kg)} kg solids</span>
          <span>·</span>
          <span>{fmtNum(activeDisplayMetrics.totals.litres)} L liquids</span>
          <span>·</span>
          <span>{currentCount} items</span>
        </div>
      </div>

      {/* ── 6 Statutory Category Cards ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>
              {focusMode === "all_yard"
                ? "Yard Active Storage by Statutory Category"
                : focusMode === "generated"
                ? `Total Waste Generated in ${period.label} by Statutory Category`
                : `Active Storage from ${period.label} by Statutory Category`}
            </span>
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground">
            {currentCount} {currentCount === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Card className="border-border/90 hover:border-rose-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.hazKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Hazardous Solids</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-emerald-600/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.nonHazKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Non-Hazardous</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-cyan-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.totals.litres)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">L</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Liquid Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-violet-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.eWasteKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">E-Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-amber-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Battery className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.batteryKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Battery Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-slate-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Recycle className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(activeDisplayMetrics.otherKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Other Wastes</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Waste Type Progress Breakdown ── */}
      {activeDisplayMetrics.byType.length > 0 ? (
        <Card className="border-border/90 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-primary" />
                <span>
                  {focusMode === "all_yard"
                    ? "Active Yard Waste Type Breakdown"
                    : focusMode === "generated"
                    ? `Waste Streams Generated in ${period.label}`
                    : `Active Streams in Storage from ${period.label}`}{" "}
                  ({activeDisplayMetrics.byType.length} streams)
                </span>
              </h3>
            </div>

            <div className="space-y-2 py-1">
              {activeDisplayMetrics.byType.map((w) => {
                const max = Math.max(...activeDisplayMetrics.byType.map((x) => x.total));
                const suffix = w.measureUnit === "litres" ? "L" : "kg";
                const isOil = w.id === "waste-oil" || w.id === "waste-grease";
                const barColor = isOil
                  ? "bg-rose-500"
                  : w.measureUnit === "litres"
                  ? "bg-cyan-500"
                  : w.wasteCategory === "hazardous"
                  ? "bg-rose-500"
                  : w.wasteCategory === "other_wastes"
                  ? "bg-amber-500"
                  : "bg-emerald-600";
                return (
                  <div key={w.id} className="flex items-center gap-2.5 text-xs">
                    <span className="flex-1 truncate font-medium text-foreground">{w.name}</span>
                    <div className="flex-[2] bg-muted/80 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${barColor} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${max > 0 ? (w.total / max) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold w-24 text-right text-foreground">
                      {fmtNum(w.total)} {suffix}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 border-dashed bg-muted/20">
          <CardContent className="p-6 text-center space-y-2">
            <Package className="h-8 w-8 text-muted-foreground/60 mx-auto" />
            <p className="text-xs font-semibold text-foreground">
              No waste records match the selected period filter ({period.label})
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              There are currently no waste items stored or logged during this timeframe. You can select another month, adjust the custom date range, or view all-time active yard storage.
            </p>
            {periodKind !== "all" && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => onPeriodKindChange("all")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  View All-Time Yard Storage ({allActiveCount} items)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
