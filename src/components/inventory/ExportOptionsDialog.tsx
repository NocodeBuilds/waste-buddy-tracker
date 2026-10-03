import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, FileSpreadsheet, FileText, Download, Tag, FileCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DisposalBatch, fmtNum, WASTE_TYPES, formatDateDDMMYYYY, getMeasureUnit } from "@/lib/wasteTypes";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import MultiSelect from "./MultiSelect";

type PeriodKind = "all" | "month" | "range" | "fy" | "batch";
export type ExportFormat = "excel" | "pdf" | "form8" | "form4";

const CATEGORIES = [
  { value: "hazardous", label: "Hazardous" },
  { value: "non_hazardous", label: "Non-Hazardous" },
  { value: "e_waste", label: "E-Waste" },
  { value: "other_wastes", label: "Other Wastes" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "excel", "pdf" or "form8" — pre-selected based on which button was clicked */
  initialFormat: ExportFormat;
  siteName: string;
  entries: any[];
  batches: DisposalBatch[];
  onExport: (opts: {
    format: ExportFormat;
    filteredEntries: any[];
    chosenBatch: DisposalBatch | null;
    periodLabel: string;
    selectedFy: number;
  }) => void;
}

export default function ExportOptionsDialog({
  open,
  onOpenChange,
  initialFormat,
  siteName,
  entries,
  batches,
  onExport,
}: Props) {
  const [formatType, setFormatType] = useState<ExportFormat>(initialFormat);
  const [periodKind, setPeriodKind] = useState<PeriodKind>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedFy, setSelectedFy] = useState<number>(
    new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
  );
  const [batchId, setBatchId] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [wasteTypeIds, setWasteTypeIds] = useState<string[]>([]);

  // Calendar popover open states
  const [rangeStartOpen, setRangeStartOpen] = useState(false);
  const [rangeEndOpen, setRangeEndOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setFormatType(initialFormat);
      setPeriodKind(initialFormat === "form4" ? "fy" : "all");
      setCategories([]);
      setWasteTypeIds([]);
      setRangeStart("");
      setRangeEnd("");
      setBatchId("");
      setRangeStartOpen(false);
      setRangeEndOpen(false);
    }
  }, [open, initialFormat]);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur - 2019 }, (_, i) => 2020 + i);
  }, []);

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // ── Cascading waste types based on selected categories ─────────
  const filteredWasteTypes = useMemo(() => {
    if (categories.length === 0) return WASTE_TYPES;
    return WASTE_TYPES.filter((w) => categories.includes(w.wasteCategory));
  }, [categories]);

  // Reset waste type selection if types are no longer in scope
  useEffect(() => {
    if (wasteTypeIds.length > 0) {
      const valid = wasteTypeIds.filter((id) => filteredWasteTypes.find((w) => w.id === id));
      if (valid.length !== wasteTypeIds.length) setWasteTypeIds(valid);
    }
  }, [categories, filteredWasteTypes]);

  // ── Compute filtered entries ──────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = entries;

    // Period
    if (periodKind === "month") {
      list = list.filter((e) => {
        const d = new Date(e.generated_date);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      });
    } else if (periodKind === "range" && rangeStart && rangeEnd) {
      const s = new Date(rangeStart + "T00:00:00").getTime();
      const e = new Date(rangeEnd + "T23:59:59").getTime();
      list = list.filter((x) => {
        const t = new Date(x.generated_date + "T00:00:00").getTime();
        return t >= s && t <= e;
      });
    } else if (periodKind === "fy") {
      const fyStart = `${selectedFy}-04-01`;
      const fyEnd = `${selectedFy + 1}-03-31`;
      const s = new Date(fyStart + "T00:00:00").getTime();
      const e = new Date(fyEnd + "T23:59:59").getTime();
      list = list.filter((x) => {
        const t = new Date(x.generated_date + "T00:00:00").getTime();
        return t >= s && t <= e;
      });
    } else if (periodKind === "batch" && batchId) {
      list = list.filter((x) => x.disposal_batch_id === batchId);
    }

    // Category (multi)
    if (categories.length > 0) {
      list = list.filter((e) => categories.includes(e.waste_category));
    }

    // Waste type (multi)
    if (wasteTypeIds.length > 0) {
      list = list.filter((e) => wasteTypeIds.includes(e.waste_type_id));
    }

    return list;
  }, [
    entries,
    periodKind,
    selectedYear,
    selectedMonth,
    rangeStart,
    rangeEnd,
    selectedFy,
    batchId,
    categories,
    wasteTypeIds,
  ]);

  const chosenBatch =
    periodKind === "batch" && batchId ? batches.find((b) => b.id === batchId) ?? null : null;

  const periodLabel = useMemo(() => {
    if (periodKind === "all") return "All Time";
    if (periodKind === "month") return `${monthLabels[selectedMonth]} ${selectedYear}`;
    if (periodKind === "range" && rangeStart && rangeEnd) return `${formatDateDDMMYYYY(rangeStart)} → ${formatDateDDMMYYYY(rangeEnd)}`;
    if (periodKind === "fy") return `FY ${selectedFy}-${String(selectedFy + 1).slice(-2)}`;
    if (periodKind === "batch" && chosenBatch) return `Batch ${formatDateDDMMYYYY(chosenBatch.disposed_date)}`;
    return "All Time";
  }, [periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy, batchId, chosenBatch]);

  const totals = useMemo(() => {
    let kg = 0,
      litres = 0,
      count = 0;
    for (const e of filteredEntries) {
      const w = Number(e.weight_kg ?? 0);
      const u = e.measureUnit ?? getMeasureUnit(e.waste_type_id);
      if (u === "litres") litres += w;
      else kg += w;
      count += 1;
    }
    return { kg, litres, count };
  }, [filteredEntries]);

  const approvedBatches = batches.filter((b) => (b as any).status === "approved" || !(b as any).status);

  const handleExport = () => {
    onExport({ format: formatType, filteredEntries, chosenBatch, periodLabel, selectedFy });
    onOpenChange(false);
  };

  const fmtDate = (s: string) => (s ? formatDateDDMMYYYY(s) : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Export Compliance Records
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate statutory reports or spreadsheets for facility: <strong className="text-foreground">{siteName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* ── Format selection ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Report Format</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormatType("excel")}
                className={`flex flex-col items-center justify-center text-center p-2 rounded-lg border text-xs transition-all ${
                  formatType === "excel"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 mb-1" />
                <span className="font-semibold text-foreground text-[11px]">Excel (.xlsx)</span>
                <span className="text-[10px] text-muted-foreground">Full data register</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatType("pdf")}
                className={`flex flex-col items-center justify-center text-center p-2 rounded-lg border text-xs transition-all ${
                  formatType === "pdf"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <FileText className="h-4 w-4 text-rose-600 mb-1" />
                <span className="font-semibold text-foreground text-[11px]">Form 3 PDF</span>
                <span className="text-[10px] text-muted-foreground">HOWM Passbook</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatType("form8")}
                className={`flex flex-col items-center justify-center text-center p-2 rounded-lg border text-xs transition-all ${
                  formatType === "form8"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <Tag className="h-4 w-4 text-amber-600 mb-1" />
                <span className="font-semibold text-foreground text-[11px]">Form 8 Labels</span>
                <span className="text-[10px] text-muted-foreground">Rule 17 Drum Signs</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormatType("form4");
                  setPeriodKind("fy");
                }}
                className={`flex flex-col items-center justify-center text-center p-2 rounded-lg border text-xs transition-all ${
                  formatType === "form4"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <FileCheck className="h-4 w-4 text-blue-600 mb-1" />
                <span className="font-semibold text-foreground text-[11px]">Form 4 Return</span>
                <span className="text-[10px] text-muted-foreground">Rule 20(2) Annual</span>
              </button>
            </div>
          </div>

          {/* ── Period ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reporting Period</Label>
            <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="month">Specific Month</SelectItem>
                <SelectItem value="range">Custom Date Range</SelectItem>
                <SelectItem value="fy">Financial Year</SelectItem>
                <SelectItem value="batch">Specific Disposal Batch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodKind === "month" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Year</Label>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Month</Label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthLabels.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {periodKind === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">From</Label>
                <Popover open={rangeStartOpen} onOpenChange={setRangeStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-xs rounded-lg">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {rangeStart ? fmtDate(rangeStart) : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          setRangeStart(format(d, "yyyy-MM-dd"));
                        }
                        setRangeStartOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">To</Label>
                <Popover open={rangeEndOpen} onOpenChange={setRangeEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-xs rounded-lg">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {rangeEnd ? fmtDate(rangeEnd) : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          setRangeEnd(format(d, "yyyy-MM-dd"));
                        }
                        setRangeEndOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {periodKind === "fy" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Financial Year</Label>
              <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      FY {y}-{String(y + 1).slice(-2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodKind === "batch" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Disposal Batch</Label>
              {approvedBatches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No approved disposal batches yet.</p>
              ) : (
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Pick a batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.disposed_date} {b.notes ? ` — ${b.notes.slice(0, 30)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ── Category filter (multi) ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Filter by Category</Label>
            <MultiSelect
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={categories}
              onChange={setCategories}
              placeholder="All categories"
            />
          </div>

          {/* ── Waste type filter (multi, cascades from category) ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Filter by Waste Type</Label>
            <MultiSelect
              options={filteredWasteTypes.map((w) => ({ value: w.id, label: w.name }))}
              value={wasteTypeIds}
              onChange={setWasteTypeIds}
              placeholder={categories.length > 0 ? "All types in selected categories" : "All waste types"}
            />
          </div>

          {/* ── Preview summary card ── */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-1.5 text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scope:</span>
              <Badge variant="outline" className="text-[10px] font-medium">
                {periodLabel}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Matching Records:</span>
              <span className="font-mono font-semibold text-foreground">{totals.count} entries</span>
            </div>
            {totals.kg > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Weight:</span>
                <span className="font-mono font-semibold text-foreground">{fmtNum(totals.kg)} kg</span>
              </div>
            )}
            {totals.litres > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Volume:</span>
                <span className="font-mono font-semibold text-foreground">{fmtNum(totals.litres)} L</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={
              formatType === "form4"
                ? false
                : filteredEntries.length === 0 || (periodKind === "batch" && !batchId)
            }
            onClick={handleExport}
            className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {formatType === "excel" ? (
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            ) : formatType === "pdf" ? (
              <FileText className="h-4 w-4 mr-1.5" />
            ) : formatType === "form8" ? (
              <Tag className="h-4 w-4 mr-1.5" />
            ) : (
              <FileCheck className="h-4 w-4 mr-1.5" />
            )}
            Generate{" "}
            {formatType === "excel"
              ? "Excel"
              : formatType === "pdf"
              ? "Form 3 PDF"
              : formatType === "form8"
              ? "Form 8 Labels"
              : "Form 4 Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
