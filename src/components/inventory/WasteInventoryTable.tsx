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
  getStatutoryCode,
  isEntryOverdue,
  isEntryWarning,
  getStorageLimitDays,
} from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tag,
  MapPin,
  Wrench,
  Camera,
  SlidersHorizontal,
} from "lucide-react";
import {
  exportInventoryToExcel,
  exportForm3Pdf,
  exportDisposalBatchPdf,
  exportForm8ContainerLabelsPdf,
  exportForm4AnnualReturnPdf,
} from "@/lib/wasteExports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import ExportOptionsDialog, { ExportFormat } from "./ExportOptionsDialog";
import StorageBreakdownView from "./StorageBreakdownView";
import DisposalHistoryView from "./DisposalHistoryView";
import EmptyState from "@/components/ui/empty-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (entry: WasteEntry) => void;
  onCreateDisposal: (params: { disposed_date: string; notes?: string; entry_ids?: string[] }) => Promise<void>;
  onApproveDisposal?: (batchId: string) => Promise<void>;
  onRejectDisposal?: (batchId: string, reason?: string) => Promise<void>;
}

interface HeaderSortButtonProps {
  col: string;
  label: string;
  align?: "left" | "center" | "right";
  sortColumn: string | null;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}

function HeaderSortButton({
  col,
  label,
  align = "center",
  sortColumn,
  sortDir,
  onSort,
}: HeaderSortButtonProps) {
  const isActive = sortColumn === col;
  return (
    <div
      className={cn(
        "flex items-center w-full",
        align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          isActive
            ? "text-primary bg-primary/10 ring-1 ring-primary/25 shadow-xs font-extrabold"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        )}
        aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        title={`Sort by ${label} (${isActive ? (sortDir === "asc" ? "Ascending — click for Descending" : "Descending — click for Ascending") : "Click to sort"})`}
      >
        <span>{label}</span>
        <span className="inline-flex items-center justify-center shrink-0">
          {isActive ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-primary stroke-[2.5]" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </button>
    </div>
  );
}

interface HeaderStaticCellProps {
  label: string;
  align?: "left" | "center" | "right";
}

function HeaderStaticCell({
  label,
  align = "center",
}: HeaderStaticCellProps) {
  return (
    <div
      className={cn(
        "flex items-center w-full",
        align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
      )}
    >
      <span className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
        {label}
      </span>
    </div>
  );
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
  const [sortColumn, setSortColumn] = useState<string | null>("generated_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [selectedForDisposal, setSelectedForDisposal] = useState<Set<string>>(new Set());
  const [disposalScope, setDisposalScope] = useState<"all" | "selected">("all");
  const [byTypeOpen, setByTypeOpen] = useState(true);

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
            return dir * getWasteName(a.waste_type_id).localeCompare(getWasteName(b.waste_type_id));
          case "category":
            return dir * (a.waste_category ?? "").localeCompare(b.waste_category ?? "");
          case "weight":
            return dir * (Number(a.weight_kg ?? 0) - Number(b.weight_kg ?? 0));
          case "days":
            return dir * (getDaysStored(a.generated_date) - getDaysStored(b.generated_date));
          case "status": {
            const getStatusRank = (e: WasteEntry) => {
              if (isDisposed(e)) return 4;
              const s = getStatus(e);
              if (s === "overdue") return 1;
              if (s === "warning") return 2;
              return 3;
            };
            return dir * (getStatusRank(a) - getStatusRank(b));
          }
          case "generated_date":
          default:
            return dir * (new Date(a.generated_date).getTime() - new Date(b.generated_date).getTime());
        }
      });
  }, [periodFiltered, filter, searchQuery, sortColumn, sortDir]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      if (col === "location" || col === "activity" || col === "waste_type" || col === "category") {
        setSortDir("asc");
      } else {
        setSortDir("desc");
      }
    }
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
      const chosenIds = disposalScope === "selected" ? Array.from(selectedForDisposal) : undefined;
      if (disposalScope === "selected" && (!chosenIds || chosenIds.length === 0)) {
        toast.error("Please select at least one entry to dispose");
        setDisposing(false);
        return;
      }
      await onCreateDisposal({
        disposed_date: disposalDate,
        notes: disposalNotes || undefined,
        entry_ids: chosenIds,
      });
      toast.success("Disposal request submitted — pending approval");
      setDialogOpen(false);
      setDisposalNotes("");
      setSelectedForDisposal(new Set());
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record disposal");
    } finally {
      setDisposing(false);
    }
  };

  const openExport = (fmt: ExportFormat) => {
    setExportFormat(fmt);
    setExportOpen(true);
  };

  const handleExport = (opts: {
    format: ExportFormat;
    filteredEntries: WasteEntry[];
    chosenBatch: DisposalBatch | null;
    periodLabel: string;
    selectedFy: number;
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
    } else if (opts.format === "pdf") {
      if (opts.filteredEntries.length === 0) {
        toast.error("No data to export");
        return;
      }
      try {
        exportForm3Pdf(opts.filteredEntries, currentSite?.name ?? "Site", {
          label: opts.periodLabel,
          kind: "all",
        });
        toast.success(`Form 3 PDF exported — ${opts.periodLabel}`);
      } catch (err: any) {
        toast.error(err.message ?? "Export failed");
      }
    } else if (opts.format === "form8") {
      if (opts.filteredEntries.length === 0) {
        toast.error("No entries to generate labels for");
        return;
      }
      try {
        exportForm8ContainerLabelsPdf(opts.filteredEntries, currentSite?.name ?? "Site");
        toast.success(`Form 8 Labels exported (${opts.filteredEntries.length} items)`);
      } catch (err: any) {
        toast.error(err.message ?? "Export failed");
      }
    } else if (opts.format === "form4") {
      try {
        const fy = opts.selectedFy ?? selectedFy;
        exportForm4AnnualReturnPdf(entries, batches, currentSite?.name ?? "Site", fy);
        toast.success(`Form 4 Annual Return exported for FY ${fy}-${String(fy + 1).slice(-2)}`);
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
            <>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedForDisposal(new Set(activeEntries.map((e) => e.id)));
                  setDisposalScope("all");
                  setDialogOpen(true);
                }}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Record Disposal
              </Button>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl p-0">
                  <DialogHeader className="p-4 pb-3 border-b border-border/60">
                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Record Waste Disposal Batch
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Create an official disposal batch record and generate Form 10 manifest for site:{" "}
                      <strong className="text-foreground">{currentSite?.name ?? "Site"}</strong>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Disposal Scope Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Disposal Scope</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDisposalScope("all")}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            disposalScope === "all"
                              ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                              : "border-border hover:bg-muted/70 text-muted-foreground"
                          }`}
                        >
                          <div className="font-semibold text-foreground text-xs">All Active Inventory</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {activeEntries.length} entries · {fmtNum(totals.kg)} kg / {fmtNum(totals.litres)} L
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDisposalScope("selected");
                            if (selectedForDisposal.size === 0) {
                              setSelectedForDisposal(new Set(activeEntries.map((e) => e.id)));
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            disposalScope === "selected"
                              ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                              : "border-border hover:bg-muted/70 text-muted-foreground"
                          }`}
                        >
                          <div className="font-semibold text-foreground text-xs">Select Specific Items</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {selectedForDisposal.size} items selected
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Selective Items Checklist */}
                    {disposalScope === "selected" && (
                      <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Select Drums / Items to Dispose ({selectedForDisposal.size} of {activeEntries.length})
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setSelectedForDisposal(new Set(activeEntries.map((e) => e.id)))}
                            >
                              All
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                setSelectedForDisposal(
                                  new Set(activeEntries.filter((e) => isEntryOverdue(e)).map((e) => e.id))
                                )
                              }
                            >
                              Overdue Only
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setSelectedForDisposal(new Set())}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto divide-y divide-border/60 border border-border/70 rounded-lg bg-card shadow-inner">
                          {activeEntries.map((e) => {
                            const checked = selectedForDisposal.has(e.id);
                            const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
                            const statCode = getStatutoryCode(e.waste_type_id);
                            const isOvd = isEntryOverdue(e);
                            return (
                              <label
                                key={e.id}
                                className="flex items-center gap-2.5 p-2 text-xs hover:bg-muted/40 cursor-pointer select-none transition-colors"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    const next = new Set(selectedForDisposal);
                                    if (val) next.add(e.id);
                                    else next.delete(e.id);
                                    setSelectedForDisposal(next);
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground truncate">
                                      {wt?.name ?? e.waste_type_id}
                                    </span>
                                    {statCode !== "—" && (
                                      <span className="text-[10px] font-mono px-1 py-0.2 bg-muted text-muted-foreground rounded">
                                        {statCode}
                                      </span>
                                    )}
                                    {isOvd && (
                                      <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                        Overdue
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>{e.location || "General"}</span>
                                    <span>·</span>
                                    <span>{e.generated_date}</span>
                                    <span>·</span>
                                    <span>{getDaysStored(e.generated_date)}d stored</span>
                                  </div>
                                </div>
                                <div className="font-mono font-bold text-xs text-right whitespace-nowrap text-foreground">
                                  {fmtNum(Number(e.weight_kg ?? 0))} {unitLabel(getMeasureUnit(e.waste_type_id))}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Date picker */}
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

                    {/* Notes / Transporter / Manifest # */}
                    <div className="space-y-1.5">
                      <Label htmlFor="dn" className="text-xs font-semibold">
                        Transporter Name / Vehicle # / Manifest # (Optional)
                      </Label>
                      <Textarea
                        id="dn"
                        placeholder="e.g., TSDF Transporter name, vehicle #, Form 10 manifest #..."
                        value={disposalNotes}
                        onChange={(e) => setDisposalNotes(e.target.value)}
                        className="text-xs min-h-[70px] rounded-lg"
                      />
                    </div>
                  </div>

                  <DialogFooter className="p-3 border-t border-border/60 gap-2 bg-muted/20">
                    <DialogClose asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs" disabled={disposing}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      size="sm"
                      disabled={disposing || (disposalScope === "selected" && selectedForDisposal.size === 0)}
                      onClick={handleDispose}
                      className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      {disposing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Confirm Disposal (
                      {disposalScope === "all" ? activeEntries.length : selectedForDisposal.size} items)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
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

          {/* ── Waste Inventory Records Table (Unified Responsive Desktop & Mobile Layout) ── */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
            {/* Mobile Horizontal Scroll Indicator Banner */}
            <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] text-muted-foreground select-none">
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowUpDown className="h-3 w-3 rotate-90 text-primary" />
                <span>Swipe table horizontally to view all columns</span>
              </span>
              <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border border-border/60">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="overflow-x-auto w-full touch-pan-x scrollbar-thin">
              <Table className="min-w-[960px] w-full text-xs">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[110px] min-w-[100px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="location"
                        label="Location"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[90px] min-w-[85px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="activity"
                        label="Activity"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="min-w-[220px] max-w-[280px] h-10 px-4 text-left">
                      <HeaderSortButton
                        col="waste_type"
                        label="Waste Type"
                        align="left"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[105px] min-w-[95px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="category"
                        label="Category"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[125px] min-w-[115px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="weight"
                        label="Quantity"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[120px] min-w-[110px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="generated_date"
                        label="Generated"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[90px] min-w-[85px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="days"
                        label="Days"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[120px] min-w-[110px] h-10 px-3 text-center">
                      <HeaderSortButton
                        col="status"
                        label="Status"
                        align="center"
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-[80px] min-w-[75px] h-10 px-3 text-center">
                      <HeaderStaticCell
                        label="Photos"
                        align="center"
                      />
                    </TableHead>
                    {isManagerOrAdmin && (
                      <TableHead className="w-[120px] min-w-[110px] h-10 px-3 text-center">
                        <HeaderStaticCell
                          label="Actions"
                          align="center"
                        />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManagerOrAdmin ? 10 : 9} className="text-center py-10">
                        <EmptyState
                          icon={Package}
                          title="No Waste Entries Found"
                          description="Try adjusting your filters, date range, or search query."
                          className="border-none bg-transparent"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((entry) => {
                      const days = getDaysStored(entry.generated_date);
                      const isDisp = isDisposed(entry);
                      const status = getStatus(entry);
                      return (
                        <TableRow
                          key={entry.id}
                          className={cn(
                            "transition-colors border-b border-border/50 hover:bg-muted/30 group",
                            status === "overdue" && !isDisp && "bg-rose-500/[0.04] dark:bg-rose-500/[0.08]"
                          )}
                        >
                          {/* Location - Centered */}
                          <TableCell className="text-center font-mono font-bold text-xs px-3 py-2.5 sm:py-3 text-foreground whitespace-nowrap">
                            {entry.location ?? "—"}
                          </TableCell>

                          {/* Activity - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap">
                            <span className="inline-block font-semibold bg-muted/80 text-foreground px-2 py-0.5 rounded text-[11px] border border-border/40">
                              {entry.activity_type === "preventive"
                                ? "PM"
                                : entry.activity_type === "breakdown"
                                ? "BM"
                                : entry.activity_type === "5s"
                                ? "5S"
                                : "OTH"}
                            </span>
                          </TableCell>

                          {/* Waste Type - Left-aligned matching px-4 */}
                          <TableCell className="min-w-[220px] max-w-[280px] px-4 py-2.5 sm:py-3 text-left">
                            <div className="text-xs font-semibold text-foreground truncate" title={getWasteName(entry.waste_type_id)}>
                              {getWasteName(entry.waste_type_id)}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {getStatutoryCode(entry.waste_type_id) !== "—" && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 py-0.2 rounded border border-border/40">
                                  {getStatutoryCode(entry.waste_type_id)}
                                </span>
                              )}
                              {entry.notes && (
                                <span className="text-[10px] text-muted-foreground/80 italic truncate max-w-[180px]" title={entry.notes}>
                                  • {entry.notes}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Category - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap">
                            <div className="flex justify-center items-center">
                              {renderCategoryBadge(entry.waste_category)}
                            </div>
                          </TableCell>

                          {/* Quantity - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap">
                            <div className="inline-flex flex-col items-center justify-center">
                              <div className="font-mono font-bold text-xs text-foreground">
                                {fmtNum(Number(entry.weight_kg ?? 0))}{" "}
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  {unitLabel(getMeasureUnit(entry.waste_type_id))}
                                </span>
                              </div>
                              {entry.piece_count != null && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {entry.piece_count} pcs
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Generated Date - Centered */}
                          <TableCell className="text-center text-xs font-mono px-3 py-2.5 sm:py-3 text-muted-foreground whitespace-nowrap">
                            {entry.generated_date}
                          </TableCell>

                          {/* Days - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap font-mono text-xs">
                            <span
                              className={cn(
                                "inline-block font-mono text-xs",
                                isEntryOverdue(entry) && !isDisp
                                  ? "text-rose-600 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full text-[11px]"
                                  : isEntryWarning(entry) && !isDisp
                                  ? "text-amber-600 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full text-[11px]"
                                  : "text-muted-foreground"
                              )}
                            >
                              {isDisp ? "—" : `${days}d`}
                            </span>
                          </TableCell>

                          {/* Status - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap">
                            <div className="flex justify-center items-center">
                              {statusBadge(entry)}
                            </div>
                          </TableCell>

                          {/* Photos - Centered */}
                          <TableCell className="text-center px-3 py-2.5 sm:py-3 whitespace-nowrap">
                            <div className="flex justify-center items-center">
                              <EntryPhotosButton
                                entryId={entry.id}
                                count={photoCounts[entry.id] ?? 0}
                                canDelete={isManagerOrAdmin}
                              />
                            </div>
                          </TableCell>

                          {/* Actions - Centered */}
                          {isManagerOrAdmin && (
                            <TableCell className="text-center whitespace-nowrap px-3 py-2.5 sm:py-3">
                              {!isDisp && (
                                <div className="inline-flex items-center justify-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                    onClick={() => {
                                      exportForm8ContainerLabelsPdf([entry], currentSite?.name ?? "Site");
                                      toast.success("Form 8 Container Label downloaded");
                                    }}
                                    title="Print Form 8 Drum Label"
                                    aria-label="Print Form 8 Drum Label"
                                  >
                                    <Tag className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => onEdit(entry)}
                                    title="Edit Record"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => onDelete(entry.id)}
                                    title="Delete Record"
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
        <StorageBreakdownView
          hazKg={hazKg}
          nonHazKg={nonHazKg}
          totals={totals}
          eWasteKg={eWasteKg}
          batteryKg={batteryKg}
          otherKg={otherKg}
          byType={byType}
        />
      )}

      {/* ────────────────────────── VIEW 3: DISPOSALS & MANIFESTS ────────────────────────── */}
      {activeView === "disposals" && (
        <DisposalHistoryView
          batches={batches}
          entries={entries}
          allActiveEntries={allActiveEntries}
          isManagerOrAdmin={isManagerOrAdmin}
          currentSiteName={currentSite?.name ?? "Site"}
          onApproveDisposal={onApproveDisposal}
          onRejectDisposal={onRejectDisposal}
        />
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
