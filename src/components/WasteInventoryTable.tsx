import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  WasteEntry,
  WASTE_TYPES,
  getDaysStored,
  getStatus,
  DISPOSAL_LIMIT_DAYS,
  isDisposed,
  DisposalBatch,
  getMeasureUnit,
  unitLabel,
  sumByUnit,
  fmtNum,
  getLocalDate,
  filterByPeriod,
  ALL_TIME_PERIOD,
  monthPeriod,
  rangePeriod,
  fyPeriod,
  currentFyStartYear,
  recentFinancialYears,
  recentMonthOptions,
  PeriodKind,
  AnalyticsPeriod,
} from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Pencil,
  Download,
  Scale,
  ShieldAlert,
  Leaf,
  Droplets,
  Battery,
  Recycle,
  Calendar as CalendarIcon,
  X,
  ChevronDown,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  Cpu,
  Package,
  Layers,
  History,
} from "lucide-react";
import { exportInventoryToExcel, exportForm3Pdf, exportDisposalBatchPdf } from "@/lib/wasteExports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSite } from "@/contexts/SiteContext";
import { useEntryPhotoCounts } from "@/hooks/useEntryPhotos";
import { format } from "date-fns";
import EntryPhotosButton from "./EntryPhotosButton";
import { toast } from "sonner";
import ExportOptionsDialog from "./ExportOptionsDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (entry: WasteEntry) => void;
  onCreateDisposal: (params: { disposed_date: string; notes?: string }) => Promise<void>;
  onApproveDisposal?: (batchId: string) => Promise<void>;
  onRejectDisposal?: (batchId: string, reason?: string) => Promise<void>;
}

export default function WasteInventoryTable({
  entries,
  batches,
  onDelete,
  onEdit,
  onCreateDisposal,
  onApproveDisposal,
  onRejectDisposal,
}: Props) {
  const { isManagerOrAdmin, currentSite } = useSite();
  const [activeView, setActiveView] = useState<"records" | "summary" | "disposals">("records");
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "disposed">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeOpenStart, setRangeOpenStart] = useState(false);
  const [rangeOpenEnd, setRangeOpenEnd] = useState(false);
  const [selectedFy, setSelectedFy] = useState<number>(currentFyStartYear());
  const [disposalDate, setDisposalDate] = useState(getLocalDate());
  const [disposalNotes, setDisposalNotes] = useState("");
  const [disposing, setDisposing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>("generated_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf">("excel");
  const [byTypeOpen, setByTypeOpen] = useState(true);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur - 2019 }, (_, i) => 2020 + i);
  }, []);

  const monthOpts = useMemo(() => recentMonthOptions(24), []);
  const fyOpts = useMemo(() => recentFinancialYears(5), []);

  const period = useMemo<AnalyticsPeriod>(() => {
    if (periodKind === "all") return ALL_TIME_PERIOD;
    if (periodKind === "month") return monthPeriod(selectedYear, selectedMonth);
    if (periodKind === "range" && rangeStart && rangeEnd) return rangePeriod(rangeStart, rangeEnd);
    if (periodKind === "fy") return fyPeriod(selectedFy);
    return ALL_TIME_PERIOD;
  }, [periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy]);

  const periodFiltered = useMemo(() => filterByPeriod(entries, period), [entries, period]);

  const allActiveEntries = entries.filter((e) => !isDisposed(e));
  const activeEntries = periodFiltered.filter((e) => !isDisposed(e));
  const { data: photoCounts = {} } = useEntryPhotoCounts(entries.map((e) => e.id));

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;

  const filtered = useMemo(() => {
    return periodFiltered
      .filter((e) => {
        if (filter === "active" && isDisposed(e)) return false;
        if (filter === "disposed" && !isDisposed(e)) return false;
        if (filter === "overdue" && (isDisposed(e) || getDaysStored(e.generated_date) < DISPOSAL_LIMIT_DAYS)) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const wasteName = getWasteName(e.waste_type_id).toLowerCase();
          const loc = (e.location ?? "").toLowerCase();
          const notes = (e.notes ?? "").toLowerCase();
          if (!wasteName.includes(q) && !loc.includes(q) && !notes.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aD = isDisposed(a);
        const bD = isDisposed(b);
        // Disposed entries always go to the bottom
        if (aD && !bD) return 1;
        if (!aD && bD) return -1;
        if (aD && bD) return 0;

        if (!sortColumn) return 0;
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortColumn) {
          case "location":
            return dir * (a.location ?? "").localeCompare(b.location ?? "");
          case "activity":
            return dir * (a.activity_type ?? "").localeCompare(b.activity_type ?? "");
          case "waste_type":
            return dir * (a.waste_type_id ?? "").localeCompare(b.waste_type_id ?? "");
          case "category":
            return dir * (a.waste_category ?? "").localeCompare(b.waste_category ?? "");
          case "weight":
            return dir * (Number(b.weight_kg ?? 0) - Number(a.weight_kg ?? 0));
          case "days":
            return dir * (getDaysStored(b.generated_date) - getDaysStored(a.generated_date));
          case "generated_date":
          default:
            return dir * (new Date(b.generated_date).getTime() - new Date(a.generated_date).getTime());
        }
      });
  }, [periodFiltered, filter, searchQuery, sortColumn, sortDir]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline shrink-0" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary ml-1 inline shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary ml-1 inline shrink-0" />
    );
  };

  const totals = sumByUnit(activeEntries);

  const solids = activeEntries.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const hazKg = solids
    .filter((e) => e.waste_category === "hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazKg = solids
    .filter((e) => e.waste_category === "non_hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const eWasteKg = solids
    .filter((e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const batteryKg = solids
    .filter((e) => e.waste_type_id === "used-batteries")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const otherKg = solids
    .filter((e) => e.waste_category === "other_wastes")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);

  // Weight/volume grouped by waste type across active storage.
  const byType = useMemo(() => {
    return WASTE_TYPES.map((wt) => {
      const items = activeEntries.filter((e) => e.waste_type_id === wt.id);
      const total = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
      return { ...wt, total };
    })
      .filter((w) => w.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [activeEntries]);

  const overdueCount = allActiveEntries.filter((e) => getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS).length;

  const statusBadge = (entry: WasteEntry) => {
    if (isDisposed(entry)) {
      return (
        <Badge variant="neutral" className="text-[10px] font-medium">
          Disposed
        </Badge>
      );
    }
    const days = getDaysStored(entry.generated_date);
    const status = getStatus(entry);
    if (status === "overdue") {
      return (
        <Badge variant="overdue" className="text-[10px] font-semibold gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          Overdue ({days}d)
        </Badge>
      );
    }
    if (status === "warning") {
      return (
        <Badge variant="warning" className="text-[10px] font-semibold gap-1">
          <Clock className="h-2.5 w-2.5" />
          Warn ({days}d)
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-[10px] font-semibold">
        Safe ({days}d)
      </Badge>
    );
  };

  const renderCategoryBadge = (category: string) => {
    if (category === "hazardous") {
      return (
        <Badge variant="destructive" className="text-[10px] uppercase font-mono px-1.5 py-0.5">
          HAZ
        </Badge>
      );
    }
    if (category === "other_wastes") {
      return (
        <Badge variant="warning" className="text-[10px] uppercase font-mono px-1.5 py-0.5">
          OTHER
        </Badge>
      );
    }
    if (category === "e_waste") {
      return (
        <Badge variant="info" className="text-[10px] uppercase font-mono px-1.5 py-0.5">
          E-WASTE
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0.5">
        NON-HAZ
      </Badge>
    );
  };

  const handleDispose = async () => {
    setDisposing(true);
    try {
      await onCreateDisposal({ disposed_date: disposalDate, notes: disposalNotes || undefined });
      toast.success("Disposal request submitted — pending approval");
      setDialogOpen(false);
      setDisposalNotes("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record disposal");
    } finally {
      setDisposing(false);
    }
  };

  const openExport = (fmt: "excel" | "pdf") => {
    setExportFormat(fmt);
    setExportOpen(true);
  };

  const handleExport = (opts: {
    format: "excel" | "pdf";
    filteredEntries: WasteEntry[];
    chosenBatch: DisposalBatch | null;
    periodLabel: string;
  }) => {
    if (opts.format === "excel") {
      if (periodFiltered.length === 0 && opts.filteredEntries.length === 0) {
        toast.error("No data in the selected period to export");
        return;
      }
      try {
        exportInventoryToExcel(opts.filteredEntries, currentSite?.name ?? "Site", {
          label: opts.periodLabel,
          kind: "all",
        });
        toast.success(`Excel exported — ${opts.periodLabel}`);
      } catch (err: any) {
        toast.error(err.message ?? "Export failed");
      }
    } else {
      if (opts.filteredEntries.length === 0) {
        toast.error("No data to export");
        return;
      }
      try {
        exportForm3Pdf(opts.filteredEntries, currentSite?.name ?? "Site", {
          label: opts.periodLabel,
          kind: "all",
        });
        toast.success(`PDF exported — ${opts.periodLabel}`);
      } catch (err: any) {
        toast.error(err.message ?? "Export failed");
      }
    }
  };

  return (
    <div className="space-y-3.5">
      {/* ── Sub-Navigation Pill Segment Switcher (eliminates vertical scroll overload) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/60 pb-2">
        <div className="inline-flex p-1 bg-muted/70 rounded-xl gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveView("records")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeView === "records"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3.5 w-3.5 text-primary" />
            <span>Records</span>
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded-full">
              {filtered.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("summary")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeView === "summary"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Scale className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Storage Breakdown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("disposals")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeView === "disposals"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5 text-amber-600" />
            <span>Disposal History</span>
            {batches.length > 0 && (
              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded-full">
                {batches.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-xs" onClick={() => openExport("excel")}>
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">Export</span>
          </Button>

          {isManagerOrAdmin && activeEntries.length > 0 && (
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Quarterly Disposal
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base">Confirm Quarterly Disposal</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs">
                    This will mark all {activeEntries.length} active entries at this facility as disposed in a single batch
                    and create an official disposal batch record for Form 3 / Form 4 compliance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-1 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="dd" className="text-xs font-semibold">
                      Disposal Date
                    </Label>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-xs rounded-lg">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {disposalDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(disposalDate + "T00:00:00")}
                          onSelect={(d) => {
                            if (d) {
                              setDisposalDate(format(d, "yyyy-MM-dd"));
                              setDateOpen(false);
                            }
                          }}
                          disabled={(date) => date > new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dn" className="text-xs font-semibold">
                      Notes / Transporter / Manifest # (Optional)
                    </Label>
                    <Textarea
                      id="dn"
                      placeholder="e.g., TSDF Transporter name, vehicle #, manifest #..."
                      value={disposalNotes}
                      onChange={(e) => setDisposalNotes(e.target.value)}
                      className="text-xs min-h-[80px] rounded-lg"
                    />
                  </div>
                </div>
                <AlertDialogFooter className="gap-2 pt-2">
                  <AlertDialogCancel disabled={disposing} className="h-9 text-xs">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDispose();
                    }}
                    disabled={disposing}
                    className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    {disposing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Confirm Disposal Batch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* ────────────────────────── VIEW 1: RECORDS (DEFAULT) ────────────────────────── */}
      {activeView === "records" && (
        <div className="space-y-2.5">
          {/* Streamlined Search & Filter Bar */}
          <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-xs space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Filter records by waste name, turbine/location, or notes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-8 text-xs rounded-lg bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Period Dropdown */}
              <div className="flex items-center gap-1.5">
                <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
                  <SelectTrigger className="h-8 text-xs w-[120px] rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="range">Custom Range</SelectItem>
                    <SelectItem value="fy">Financial Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setFilter("active")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap font-medium",
                  filter === "active"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                In Storage ({allActiveEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("overdue")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap font-medium flex items-center gap-1",
                  filter === "overdue"
                    ? "bg-rose-600 text-white font-semibold shadow-xs"
                    : overdueCount > 0
                    ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                Overdue ({overdueCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap font-medium",
                  filter === "all"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                All Records ({periodFiltered.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("disposed")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap font-medium",
                  filter === "disposed"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                Disposed ({entries.filter(isDisposed).length})
              </button>
            </div>

            {/* Conditional period sub-filters */}
            {periodKind === "month" && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground">Month:</span>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-7 text-xs w-20 rounded-md">
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
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-7 text-xs w-28 rounded-md">
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
            )}

            {periodKind === "range" && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/50 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Range:</span>
                <Popover open={rangeOpenStart} onOpenChange={setRangeOpenStart}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs font-normal px-2 rounded-md">
                      <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                      {rangeStart || "From Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          setRangeStart(format(d, "yyyy-MM-dd"));
                          setRangeOpenStart(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <Popover open={rangeOpenEnd} onOpenChange={setRangeOpenEnd}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs font-normal px-2 rounded-md">
                      <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                      {rangeEnd || "To Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          setRangeEnd(format(d, "yyyy-MM-dd"));
                          setRangeOpenEnd(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>

                {(rangeStart || rangeEnd) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setRangeStart("");
                      setRangeEnd("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {periodKind === "fy" && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground">Financial Year:</span>
                <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
                  <SelectTrigger className="h-7 text-xs w-32 rounded-md">
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
              </div>
            )}
          </div>

          {/* ── Mobile View: High-Density Compact List (Eliminates vertical scroll overload) ── */}
          <div className="md:hidden space-y-1.5">
            {filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-border/80 border-dashed">
                <p className="text-sm font-medium">No waste entries found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try adjusting your filters or search query.
                </p>
              </Card>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card divide-y divide-border/60 overflow-hidden shadow-xs">
                {filtered.map((entry) => {
                  const days = getDaysStored(entry.generated_date);
                  const isDisp = isDisposed(entry);
                  const status = getStatus(entry);
                  const isExpanded = expandedEntryId === entry.id;

                  return (
                    <div key={entry.id} className="transition-colors hover:bg-muted/20">
                      {/* High-density compact row */}
                      <div
                        className="p-2.5 flex items-center justify-between gap-2.5 cursor-pointer select-none active:bg-muted/40"
                        onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      >
                        {/* Status bar + Info */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={cn(
                              "w-1 h-9 rounded-full shrink-0",
                              isDisp
                                ? "bg-muted-foreground/30"
                                : status === "overdue"
                                ? "bg-rose-500 shadow-xs shadow-rose-500/50"
                                : status === "warning"
                                ? "bg-amber-500"
                                : "bg-emerald-600"
                            )}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-foreground bg-muted/70 px-1.5 py-0.2 rounded border border-border/50 shrink-0">
                                {entry.location || "General"}
                              </span>
                              <h4 className="text-xs font-semibold text-foreground truncate">
                                {getWasteName(entry.waste_type_id)}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span>{entry.generated_date}</span>
                              <span>•</span>
                              <span className="uppercase text-[10px] font-semibold text-muted-foreground/80">
                                {entry.activity_type === "preventive"
                                  ? "PM"
                                  : entry.activity_type === "breakdown"
                                  ? "BM"
                                  : entry.activity_type === "5s"
                                  ? "5S"
                                  : "OTH"}
                              </span>
                              {!isDisp && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      "font-mono font-medium",
                                      days >= DISPOSAL_LIMIT_DAYS
                                        ? "text-rose-600 dark:text-rose-400 font-bold"
                                        : days >= 70
                                        ? "text-amber-600 font-semibold"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {days}d
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quantity + Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-foreground leading-tight">
                              {fmtNum(Number(entry.weight_kg ?? 0))}{" "}
                              <span className="text-[10px] font-sans font-normal text-muted-foreground">
                                {unitLabel(getMeasureUnit(entry.waste_type_id))}
                              </span>
                            </div>
                            {entry.piece_count != null && (
                              <div className="text-[10px] text-muted-foreground">
                                {entry.piece_count} pcs
                              </div>
                            )}
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                      </div>

                      {/* Expandable Action Drawer */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 bg-muted/20 border-t border-border/40 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground">Category:</span>
                              {renderCategoryBadge(entry.waste_category)}
                            </div>
                            <div>{statusBadge(entry)}</div>
                          </div>

                          {entry.notes && (
                            <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2 rounded-lg break-words">
                              {entry.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <EntryPhotosButton
                              entryId={entry.id}
                              count={photoCounts[entry.id] ?? 0}
                              canDelete={isManagerOrAdmin}
                            />
                            {isManagerOrAdmin && !isDisp && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 px-2.5 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(entry);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(entry.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Desktop View: Full Data Table ── */}
          <div className="hidden md:block rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3"
                      onClick={() => handleSort("location")}
                    >
                      Location <SortIcon col="location" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3"
                      onClick={() => handleSort("activity")}
                    >
                      Activity <SortIcon col="activity" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3"
                      onClick={() => handleSort("waste_type")}
                    >
                      Waste Type <SortIcon col="waste_type" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3"
                      onClick={() => handleSort("category")}
                    >
                      Category <SortIcon col="category" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3 text-right"
                      onClick={() => handleSort("weight")}
                    >
                      Quantity <SortIcon col="weight" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3"
                      onClick={() => handleSort("generated_date")}
                    >
                      Generated <SortIcon col="generated_date" />
                    </TableHead>
                    <TableHead
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground h-10 px-3 text-center"
                      onClick={() => handleSort("days")}
                    >
                      Days <SortIcon col="days" />
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10 px-3">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center h-10 px-3">
                      Photos
                    </TableHead>
                    {isManagerOrAdmin && (
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right h-10 px-3">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManagerOrAdmin ? 10 : 9} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <p className="text-sm font-medium">No waste entries found</p>
                          <p className="text-xs text-muted-foreground/70">
                            Try adjusting filters, or tap <strong>+ Log Waste</strong> to record a new entry.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((entry) => {
                      const days = getDaysStored(entry.generated_date);
                      const isDisp = isDisposed(entry);
                      return (
                        <TableRow
                          key={entry.id}
                          className={`transition-colors border-b border-border/50 hover:bg-muted/30 ${
                            getStatus(entry) === "overdue" && !isDisp ? "bg-rose-500/[0.04]" : ""
                          }`}
                        >
                          <TableCell className="font-mono font-bold text-xs px-3 py-3 text-foreground">
                            {entry.location ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs px-3 py-3 text-muted-foreground">
                            <span className="font-medium bg-muted px-1.5 py-0.5 rounded text-[11px]">
                              {entry.activity_type === "preventive"
                                ? "PM"
                                : entry.activity_type === "breakdown"
                                ? "BM"
                                : entry.activity_type === "5s"
                                ? "5S"
                                : "OTH"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs font-semibold px-3 py-3 text-foreground">
                            {getWasteName(entry.waste_type_id)}
                          </TableCell>
                          <TableCell className="text-xs px-3 py-3">
                            {renderCategoryBadge(entry.waste_category)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right">
                            <div className="whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-foreground">
                                {fmtNum(Number(entry.weight_kg ?? 0))}
                              </span>{" "}
                              <span className="text-[11px] text-muted-foreground font-medium">
                                {unitLabel(getMeasureUnit(entry.waste_type_id))}
                              </span>
                            </div>
                            {entry.piece_count != null && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {entry.piece_count} pcs
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono px-3 py-3 text-muted-foreground">
                            {entry.generated_date}
                          </TableCell>
                          <TableCell className="text-center px-3 py-3">
                            <span
                              className={
                                days >= DISPOSAL_LIMIT_DAYS && !isDisp
                                  ? "text-rose-600 font-bold font-mono text-xs"
                                  : days >= 70 && !isDisp
                                  ? "text-amber-600 font-semibold font-mono text-xs"
                                  : "text-muted-foreground font-mono text-xs"
                              }
                            >
                              {isDisp ? "—" : `${days}d`}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3">{statusBadge(entry)}</TableCell>
                          <TableCell className="text-center px-3 py-3">
                            <EntryPhotosButton
                              entryId={entry.id}
                              count={photoCounts[entry.id] ?? 0}
                              canDelete={isManagerOrAdmin}
                            />
                          </TableCell>
                          {isManagerOrAdmin && (
                            <TableCell className="text-right whitespace-nowrap px-3 py-3">
                              {!isDisp && (
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => onEdit(entry)}
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => onDelete(entry.id)}
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────── VIEW 2: STORAGE BREAKDOWN ────────────────────────── */}
      {activeView === "summary" && (
        <div className="space-y-3.5">
          {/* 6 Category Cards */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Storage by Statutory Category
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <Card className="border-border/80 hover:border-rose-500/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(hazKg)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Hazardous Solids</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 hover:border-emerald-600/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Leaf className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(nonHazKg)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Non-Hazardous</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 hover:border-cyan-500/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(totals.litres)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">L</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Liquid Waste</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 hover:border-violet-500/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(eWasteKg)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">E-Waste</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 hover:border-amber-500/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Battery className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(batteryKg)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Battery Waste</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 hover:border-slate-500/40 transition-colors">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Recycle className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0" />
                    <p className="text-lg font-bold font-mono text-foreground leading-tight">
                      {fmtNum(otherKg)}
                      <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Other Wastes</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Waste Type Progress Breakdown */}
          {byType.length > 0 && (
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-primary" /> Active Waste Type Weight Breakdown ({byType.length})
                  </h3>
                </div>

                <div className="space-y-2 py-1">
                  {byType.map((w) => {
                    const max = Math.max(...byType.map((x) => x.total));
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
                            style={{ width: `${(w.total / max) * 100}%` }}
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
          )}
        </div>
      )}

      {/* ────────────────────────── VIEW 3: DISPOSALS & MANIFESTS ────────────────────────── */}
      {activeView === "disposals" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Official Disposal Batches & Manifests
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              {batches.length} {batches.length === 1 ? "batch" : "batches"}
            </span>
          </div>

          {batches.length === 0 ? (
            <Card className="border-border/80 border-dashed p-8 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">No disposal batches recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                When waste is dispatched to an authorized TSDF or recycler, tap <strong>Quarterly Disposal</strong> to generate an official batch.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {batches.map((b) => {
                const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
                const status = (b as any).status ?? "approved";
                const isPending = status === "pending";
                const isRejected = status === "rejected";
                return (
                  <Card
                    key={b.id}
                    className={`border transition-all ${
                      isPending
                        ? "border-amber-500/50 bg-amber-500/[0.03]"
                        : isRejected
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border/80 hover:border-primary/40"
                    }`}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{b.disposed_date}</p>
                            {isPending && <Badge variant="warning">Pending Approval</Badge>}
                            {isRejected && <Badge variant="destructive">Rejected</Badge>}
                            {!isPending && !isRejected && <Badge variant="success">Approved</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {inBatch.length > 0
                              ? `${inBatch.length} entries in batch`
                              : `All active entries (${allActiveEntries.length}) pending approval`}
                          </p>
                          {b.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic break-words bg-muted/40 p-2 rounded-lg">
                              {b.notes}
                            </p>
                          )}
                          {isRejected && (b as any).rejection_reason && (
                            <p className="text-xs text-destructive mt-1.5 font-medium break-words">
                              Reason: {(b as any).rejection_reason}
                            </p>
                          )}
                          {isPending && isManagerOrAdmin && onApproveDisposal && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                onClick={async () => {
                                  try {
                                    await onApproveDisposal(b.id);
                                    toast.success("Disposal approved — entries marked as disposed");
                                  } catch (err: any) {
                                    toast.error(err.message ?? "Failed to approve");
                                  }
                                }}
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Approve Batch
                              </Button>
                              {rejectingId === b.id ? (
                                <div className="flex gap-2 items-center w-full">
                                  <Input
                                    placeholder="Reason for rejection…"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="h-8 text-xs rounded-lg"
                                    maxLength={200}
                                  />
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 text-xs rounded-lg"
                                    onClick={async () => {
                                      try {
                                        await onRejectDisposal?.(b.id, rejectReason);
                                        toast.success("Disposal rejected");
                                        setRejectingId(null);
                                        setRejectReason("");
                                      } catch (err: any) {
                                        toast.error(err.message ?? "Failed to reject");
                                      }
                                    }}
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs rounded-lg"
                                    onClick={() => {
                                      setRejectingId(null);
                                      setRejectReason("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg"
                                  onClick={() => setRejectingId(b.id)}
                                >
                                  <X className="h-3.5 w-3.5" /> Reject
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {!isPending && !isRejected && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                          {inBatch.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 shadow-xs rounded-lg"
                              onClick={() => exportDisposalBatchPdf(b, inBatch, currentSite?.name ?? "Site")}
                            >
                              <Download className="h-3.5 w-3.5 text-primary" /> Manifest
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Export options dialog */}
      <ExportOptionsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        initialFormat={exportFormat}
        siteName={currentSite?.name ?? "Site"}
        entries={entries}
        batches={batches}
        onExport={handleExport}
      />
    </div>
  );
}
