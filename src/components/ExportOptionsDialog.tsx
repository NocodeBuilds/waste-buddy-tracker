import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileSpreadsheet, FileText } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DisposalBatch, fmtNum, getLocalDate, WASTE_TYPES } from "@/lib/wasteTypes";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import MultiSelect from "./MultiSelect";

type PeriodKind = "all" | "month" | "range" | "fy" | "batch";
type Format = "excel" | "pdf";

const CATEGORIES = [
  { value: "hazardous", label: "Hazardous" },
  { value: "non_hazardous", label: "Non-Hazardous" },
  { value: "e_waste", label: "E-Waste" },
  { value: "other_wastes", label: "Other Wastes" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "excel" or "pdf" — pre-selected based on which button was clicked */
  initialFormat: Format;
  siteName: string;
  entries: any[];
  batches: DisposalBatch[];
  onExport: (opts: {
    format: Format;
    filteredEntries: any[];
    chosenBatch: DisposalBatch | null;
    periodLabel: string;
  }) => void;
}

export default function ExportOptionsDialog({
  open, onOpenChange, initialFormat, siteName, entries, batches, onExport,
}: Props) {
  const [format, setFormat] = useState<Format>(initialFormat);
  const [periodKind, setPeriodKind] = useState<PeriodKind>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedFy, setSelectedFy] = useState<number>(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  const [batchId, setBatchId] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [wasteTypeIds, setWasteTypeIds] = useState<string[]>([]);

  // Calendar popover open states
  const [rangeStartOpen, setRangeStartOpen] = useState(false);
  const [rangeEndOpen, setRangeEndOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setFormat(initialFormat);
      setPeriodKind("all");
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

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  }, [entries, periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy, batchId, categories, wasteTypeIds]);

  const chosenBatch = periodKind === "batch" && batchId
    ? batches.find((b) => b.id === batchId) ?? null
    : null;

  const periodLabel = useMemo(() => {
    if (periodKind === "all") return "All Time";
    if (periodKind === "month") return `${monthLabels[selectedMonth]} ${selectedYear}`;
    if (periodKind === "range" && rangeStart && rangeEnd) return `${rangeStart} → ${rangeEnd}`;
    if (periodKind === "fy") return `FY ${selectedFy}-${String(selectedFy + 1).slice(-2)}`;
    if (periodKind === "batch" && chosenBatch) return `Batch ${chosenBatch.disposed_date}`;
    return "All Time";
  }, [periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy, batchId, chosenBatch]);

  const totals = useMemo(() => {
    let kg = 0, litres = 0, count = 0;
    for (const e of filteredEntries) {
      const w = Number(e.weight_kg ?? 0);
      const u = e.measureUnit ?? (["any-liquid", "waste-oil", "waste-chemical", "waste-water", "waste-gas", "liquid-chemical"].includes(e.waste_type_id) ? "litres" : "kg");
      if (u === "litres") litres += w; else kg += w;
      count += 1;
    }
    return { kg, litres, count };
  }, [filteredEntries]);

  const approvedBatches = batches.filter((b) => (b as any).status === "approved" || !(b as any).status);

  const handleExport = () => {
    onExport({ format, filteredEntries, chosenBatch, periodLabel });
    onOpenChange(false);
  };

  const fmtDate = (s: string) => s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Choose what to export for {siteName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Format ── */}
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("excel")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-colors ${
                  format === "excel"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-colors ${
                  format === "pdf"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>

          {/* ── Period ── */}
          <div className="space-y-1.5">
            <Label className="text-xs">Period</Label>
            <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
              <SelectTrigger className="h-9 text-sm">
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
                <Label className="text-xs">Year</Label>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Month</Label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthLabels.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {periodKind === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Popover open={rangeStartOpen} onOpenChange={setRangeStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rangeStart ? fmtDate(rangeStart) : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeStart ? new Date(rangeStart + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          setRangeStart(`${y}-${m}-${day}`);
                        }
                        setRangeStartOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Popover open={rangeEndOpen} onOpenChange={setRangeEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rangeEnd ? fmtDate(rangeEnd) : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rangeEnd ? new Date(rangeEnd + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          setRangeEnd(`${y}-${m}-${day}`);
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
              <Label className="text-xs">Financial Year</Label>
              <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>FY {y}-{String(y + 1).slice(-2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodKind === "batch" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Disposal Batch</Label>
              {approvedBatches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No approved disposal batches yet.</p>
              ) : (
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick a batch" /></SelectTrigger>
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
            <Label className="text-xs">Waste Category</Label>
            <MultiSelect
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={categories}
              onChange={setCategories}
              placeholder="All categories"
            />
          </div>

          {/* ── Waste type filter (multi, cascades from category) ── */}
          <div className="space-y-1.5">
            <Label className="text-xs">Waste Type</Label>
            <MultiSelect
              options={filteredWasteTypes.map((w) => ({ value: w.id, label: w.name }))}
              value={wasteTypeIds}
              onChange={setWasteTypeIds}
              placeholder={categories.length > 0 ? "All types in selected categories" : "All types"}
            />
          </div>

          {/* ── Preview summary ── */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Period:</span>
              <Badge variant="outline" className="text-[10px]">{periodLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Entries:</span>
              <span className="font-mono font-semibold">{totals.count}</span>
            </div>
            {totals.kg > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Weight:</span>
                <span className="font-mono font-semibold">{fmtNum(totals.kg)} kg</span>
              </div>
            )}
            {totals.litres > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-mono font-semibold">{fmtNum(totals.litres)} L</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={filteredEntries.length === 0 || (periodKind === "batch" && !batchId)}
            onClick={handleExport}
          >
            {format === "excel" ? <FileSpreadsheet className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Export {format === "excel" ? "Excel" : "PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
