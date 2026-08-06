import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { WasteEntry, WASTE_TYPES, getDaysStored, getStatus, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch, getMeasureUnit, unitLabel, sumByUnit, fmtNum, getLocalDate, filterByPeriod, ALL_TIME_PERIOD, monthPeriod, rangePeriod, fyPeriod, currentFyStartYear, recentFinancialYears, recentMonthOptions, PeriodKind, AnalyticsPeriod } from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle, Loader2, FileSpreadsheet, Pencil, Download, Scale, ShieldAlert, Leaf, Beaker, Droplets, Battery, Recycle, CalendarIcon, X } from "lucide-react";
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

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (entry: WasteEntry) => void;
  onCreateDisposal: (params: { disposed_date: string; notes?: string }) => Promise<void>;
  onApproveDisposal?: (batchId: string) => Promise<void>;
  onRejectDisposal?: (batchId: string, reason?: string) => Promise<void>;
}

export default function WasteInventoryTable({ entries, batches, onDelete, onEdit, onCreateDisposal, onApproveDisposal, onRejectDisposal }: Props) {
  const { isManagerOrAdmin, currentSite } = useSite();
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "disposed">("active");
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>("generated_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf">("excel");

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

  const filtered = periodFiltered.filter((e) => {
    if (filter === "active") return !isDisposed(e);
    if (filter === "disposed") return isDisposed(e);
    if (filter === "overdue") return !isDisposed(e) && getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS;
    return true;
  }).sort((a, b) => {
    const aD = isDisposed(a), bD = isDisposed(b);
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

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) return <span className="text-muted-foreground/40 ml-0.5">↕</span>;
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;
  const totals = sumByUnit(activeEntries);

  const solids = activeEntries.filter((e) => getMeasureUnit(e.waste_type_id) === "kg");
  const hazKg = solids.filter((e) => e.waste_category === "hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  const nonHazKg = solids.filter((e) => e.waste_category === "non_hazardous")
    .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);

  // Weight/volume grouped by waste type across active storage.
  const byType = useMemo(() => {
    return WASTE_TYPES.map((wt) => {
      const items = activeEntries.filter((e) => e.waste_type_id === wt.id);
      const total = items.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
      return { ...wt, total };
    }).filter((w) => w.total > 0).sort((a, b) => b.total - a.total);
  }, [activeEntries]);

  const statusBadge = (entry: WasteEntry) => {
    if (isDisposed(entry)) return <Badge variant="outline" className="border-success/40 text-success">Disposed</Badge>;
    const status = getStatus(entry);
    if (status === "overdue") return <Badge variant="outline" className="border-overdue/40 text-overdue">Overdue!</Badge>;
    if (status === "warning") return <Badge variant="outline" className="border-warning/40 text-warning">Warning</Badge>;
    return <Badge variant="outline" className="border-success/40 text-success">Safe</Badge>;
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
        exportInventoryToExcel(opts.filteredEntries, currentSite?.name ?? "Site", { label: opts.periodLabel, kind: "all" });
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
        exportForm3Pdf(opts.filteredEntries, currentSite?.name ?? "Site", { label: opts.periodLabel, kind: "all" });
        toast.success(`PDF exported — ${opts.periodLabel}`);
      } catch (err: any) {
        toast.error(err.message ?? "Export failed");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2 whitespace-nowrap">Waste Inventory</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-7 text-[11px] w-auto min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entries</SelectItem>
              <SelectItem value="active">In Storage</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="disposed">Disposed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
            <SelectTrigger className="h-7 text-[11px] w-auto min-w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="range">Custom Range</SelectItem>
              <SelectItem value="fy">Financial Year</SelectItem>
            </SelectContent>
          </Select>

          {periodKind === "month" && (
            <>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="h-7 text-[11px] w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.slice(-6).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="h-7 text-[11px] w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOpts.filter((o) => o.year === selectedYear).map((o) => (
                    <SelectItem key={o.monthIndex} value={String(o.monthIndex)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {periodKind === "range" && (
            <>
              <Popover open={rangeOpenStart} onOpenChange={setRangeOpenStart}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] font-normal px-2">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeStart || "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined} onSelect={(d) => { if (d) { setRangeStart(format(d, "yyyy-MM-dd")); setRangeOpenStart(false); }}} />
                </PopoverContent>
              </Popover>
              <Popover open={rangeOpenEnd} onOpenChange={setRangeOpenEnd}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] font-normal px-2">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeEnd || "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined} onSelect={(d) => { if (d) { setRangeEnd(format(d, "yyyy-MM-dd")); setRangeOpenEnd(false); }}} />
                </PopoverContent>
              </Popover>
              {(rangeStart || rangeEnd) && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setRangeStart(""); setRangeEnd(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          )}

          {periodKind === "fy" && (
            <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
              <SelectTrigger className="h-7 text-[11px] w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOpts.map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {y}-{String(y + 1).slice(-2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Storage summary — matches "This Month" cards theme on home */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            In storage by Category
          </h3>
          <Button variant="outline" size="sm" onClick={() => openExport("excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-overdue/30">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(hazKg)} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-success shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(nonHazKg)} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Non-Hazardous Solids</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-cyan-500 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(totals.litres)} <span className="text-[10px] font-normal text-muted-foreground">L</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Liquid Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-orange-500 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(solids.filter((e) => e.waste_category === "e_waste" && e.waste_type_id !== "used-batteries").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">E-Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-yellow-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(solids.filter((e) => e.waste_type_id === "used-batteries").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Battery Waste</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-2">
                <Recycle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xl font-bold leading-tight">{fmtNum(solids.filter((e) => e.waste_category === "other_wastes").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0))} <span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
              </div>
              <p className="text-[10px] text-muted-foreground">Other Wastes</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weight / volume by waste type (in storage) */}
      {byType.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> In storage by waste type
              </h3>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-7 text-[11px] w-auto min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hazardous">Hazardous</SelectItem>
                  <SelectItem value="non_hazardous">Non-Hazardous</SelectItem>
                  <SelectItem value="e_waste">E-Waste</SelectItem>
                  <SelectItem value="other_wastes">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(typeFilter === "all" ? byType : byType.filter((w) => w.wasteCategory === typeFilter)).map((w) => {
              const visible = typeFilter === "all" ? byType : byType.filter((x) => x.wasteCategory === typeFilter);
              const max = Math.max(...visible.map((x) => x.total));
              const suffix = w.measureUnit === "litres" ? "Ltr" : "kg";
              const isOil = w.id === "waste-oil" || w.id === "waste-grease";
              const barColor = isOil
                ? "bg-overdue"
                : w.measureUnit === "litres"
                  ? "bg-accent"
                  : w.wasteCategory === "hazardous"
                    ? "bg-overdue"
                    : w.wasteCategory === "other_wastes"
                      ? "bg-amber-500"
                      : "bg-success";
              return (
                <div key={w.id} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate">{w.name}</span>
                  <div className="flex-[2] bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`${barColor} h-full rounded-full`} style={{ width: `${(w.total / max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono font-semibold w-20 text-right">
                    {fmtNum(w.total)} {suffix}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
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

      {/* Quarterly disposal action */}
      {isManagerOrAdmin && activeEntries.length > 0 && (
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button className="w-full bg-primary hover:bg-primary/90">
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Quarterly Disposal ({allActiveEntries.length} entries)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Quarterly Disposal</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark all {activeEntries.length} active entries at this site as disposed in a single batch.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dd">Disposal Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {disposalDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={new Date(disposalDate + "T00:00:00")} onSelect={(d) => { if (d) { setDisposalDate(format(d, "yyyy-MM-dd")); setDateOpen(false); }}} disabled={(date) => date > new Date()} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dn">Notes (optional)</Label>
                <Textarea id="dn" placeholder="Vendor, manifest #, etc." value={disposalNotes} onChange={(e) => setDisposalNotes(e.target.value)} />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disposing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDispose(); }} disabled={disposing}>
                {disposing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Disposal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Disposal history — placed below Mark Quarterly button */}
      {batches.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Disposal History
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {batches.length} {batches.length === 1 ? "batch" : "batches"}
            </span>
          </div>
          {batches.map((b) => {
            const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
            const status = (b as any).status ?? "approved";
            const isPending = status === "pending";
            const isRejected = status === "rejected";
            return (
              <Card key={b.id} className={
                isPending ? "border-warning/40 bg-warning/5" :
                isRejected ? "border-destructive/40 bg-destructive/5" :
                "border-success/30"
              }>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{b.disposed_date}</p>
                        {isPending && <Badge variant="outline" className="border-warning/40 text-warning">Pending approval</Badge>}
                        {isRejected && <Badge variant="outline" className="border-destructive/40 text-destructive">Rejected</Badge>}
                        {!isPending && !isRejected && <Badge variant="outline" className="border-success/40 text-success">Approved</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inBatch.length > 0 ? `${inBatch.length} entries disposed` : `All active entries (${allActiveEntries.length}) pending`}
                      </p>
                      {b.notes && <p className="text-xs text-muted-foreground mt-1 italic break-words">{b.notes}</p>}
                      {isRejected && (b as any).rejection_reason && (
                        <p className="text-xs text-destructive mt-1 italic break-words">Reason: {(b as any).rejection_reason}</p>
                      )}
                      {isPending && isManagerOrAdmin && onApproveDisposal && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs gap-1 bg-success hover:bg-success/90"
                            onClick={async () => {
                              try {
                                await onApproveDisposal(b.id);
                                toast.success("Disposal approved — entries marked as disposed");
                              } catch (err: any) {
                                toast.error(err.message ?? "Failed to approve");
                              }
                            }}
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </Button>
                          {rejectingId === b.id ? (
                            <div className="flex gap-2 items-center w-full">
                              <Input
                                placeholder="Reason for rejection…"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="h-8 text-xs"
                                maxLength={200}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs"
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
                              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1 border-destructive/40 text-destructive"
                              onClick={() => setRejectingId(b.id)}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!isPending && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                      {inBatch.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => exportDisposalBatchPdf(b, inBatch, currentSite?.name ?? "Site")}
                        >
                          <Download className="h-3 w-3" /> Manifest
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

      {/* All entries — at the bottom */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            All Entries
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("location")}>
                Location <SortIcon col="location" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("activity")}>
                Activity <SortIcon col="activity" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("waste_type")}>
                Waste Type <SortIcon col="waste_type" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("category")}>
                Cat. <SortIcon col="category" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("weight")}>
                Qty <SortIcon col="weight" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("generated_date")}>
                Generated <SortIcon col="generated_date" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("days")}>
                Days <SortIcon col="days" />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Photos</TableHead>
              {isManagerOrAdmin && <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isManagerOrAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">No entries found</TableCell></TableRow>
            ) : (
              filtered.map((entry) => {
                const days = getDaysStored(entry.generated_date);
                return (
                  <TableRow key={entry.id} className={getStatus(entry) === "overdue" && !isDisposed(entry) ? "bg-overdue/5" : ""}>
                    <TableCell className="font-mono font-semibold">{entry.location ?? "—"}</TableCell>
                    <TableCell className="text-xs">{entry.activity_type === "preventive" ? "PM" : entry.activity_type === "breakdown" ? "BM" : entry.activity_type === "5s" ? "5S" : "OTH"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{getWasteName(entry.waste_type_id)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={entry.waste_category === "hazardous" ? "border-overdue/40 text-overdue" : entry.waste_category === "other_wastes" ? "border-amber-500/40 text-amber-600" : "border-success/40 text-success"}>
                        {entry.waste_category === "hazardous" ? "HAZ" : entry.waste_category === "other_wastes" ? "OTHER" : "NON"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="whitespace-nowrap">
                        <span className="font-semibold">{fmtNum(Number(entry.weight_kg ?? 0))}</span>{" "}
                        <span className="text-xs text-muted-foreground">{unitLabel(getMeasureUnit(entry.waste_type_id))}</span>
                      </div>
                      {entry.piece_count != null && (
                        <div className="text-[10px] text-muted-foreground">{entry.piece_count} pcs</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{entry.generated_date}</TableCell>
                    <TableCell>
                      <span className={days >= DISPOSAL_LIMIT_DAYS && !isDisposed(entry) ? "text-overdue font-bold" : days >= 70 && !isDisposed(entry) ? "text-warning font-semibold" : ""}>
                        {isDisposed(entry) ? "—" : `${days}d`}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(entry)}</TableCell>
                    <TableCell className="text-center">
                      <EntryPhotosButton entryId={entry.id} count={photoCounts[entry.id] ?? 0} canDelete={isManagerOrAdmin} />
                    </TableCell>
                    {isManagerOrAdmin && (
                      <TableCell className="text-right whitespace-nowrap">
                        {!isDisposed(entry) && (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(entry)} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-overdue hover:bg-overdue/10" onClick={() => onDelete(entry.id)} aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
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
  );
}
