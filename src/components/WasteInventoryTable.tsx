import { useState, useMemo } from "react";
import { WasteEntry, WASTE_TYPES, getDaysStored, getStatus, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch, getMeasureUnit, unitLabel, sumByUnit, fmtNum } from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle, Loader2, FileSpreadsheet, FileText, Pencil, Download, Scale, ShieldAlert, Leaf, Beaker } from "lucide-react";
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
import EntryPhotosButton from "./EntryPhotosButton";
import { toast } from "sonner";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (entry: WasteEntry) => void;
  onCreateDisposal: (params: { disposed_date: string; notes?: string }) => Promise<void>;
}

export default function WasteInventoryTable({ entries, batches, onDelete, onEdit, onCreateDisposal }: Props) {
  const { isManagerOrAdmin, currentSite } = useSite();
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "disposed">("active");
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split("T")[0]);
  const [disposalNotes, setDisposalNotes] = useState("");
  const [disposing, setDisposing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeEntries = entries.filter((e) => !isDisposed(e));
  const { data: photoCounts = {} } = useEntryPhotoCounts(entries.map((e) => e.id));

  const filtered = entries.filter((e) => {
    if (filter === "active") return !isDisposed(e);
    if (filter === "disposed") return isDisposed(e);
    if (filter === "overdue") return !isDisposed(e) && getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS;
    return true;
  }).sort((a, b) => {
    const aD = isDisposed(a), bD = isDisposed(b);
    if (!aD && !bD) return getDaysStored(b.generated_date) - getDaysStored(a.generated_date);
    if (aD && !bD) return 1;
    if (!aD && bD) return -1;
    return 0;
  });

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
      toast.success(`Marked ${activeEntries.length} entries as disposed`);
      setDialogOpen(false);
      setDisposalNotes("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record disposal");
    } finally {
      setDisposing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">Waste Inventory</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="active">In Storage</SelectItem>
            <SelectItem value="overdue">Overdue Only</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Storage summary — themed cards matching analytics tab */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          In storage by Category
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-overdue/30 bg-overdue/10">
            <CardContent className="p-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-overdue shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight text-overdue">{fmtNum(hazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                <p className="text-[10px] text-muted-foreground">Hazardous</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30 bg-success/10">
            <CardContent className="p-4 flex items-center gap-2">
              <Leaf className="h-5 w-5 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight text-success">{fmtNum(nonHazKg)} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                <p className="text-[10px] text-muted-foreground">Non-Hazardous</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Beaker className="h-5 w-5 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(totals.litres)} <span className="text-xs font-normal text-muted-foreground">L</span></p>
                <p className="text-[10px] text-muted-foreground">Liquid in storage</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{fmtNum(solids.filter((e) => e.waste_category === "e_waste").reduce((s, e) => s + Number(e.weight_kg ?? 0), 0))} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                <p className="text-[10px] text-muted-foreground">E-waste in storage</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weight / volume by waste type (in storage) */}
      {byType.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> In storage by waste type
            </h3>
            {byType.map((w) => {
              const max = Math.max(...byType.map((x) => x.total));
              const suffix = w.measureUnit === "litres" ? "L" : "kg";
              const barColor = w.measureUnit === "litres"
                ? "bg-accent"
                : w.wasteCategory === "hazardous" ? "bg-overdue" : "bg-success";
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


      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline" size="sm"
          disabled={activeEntries.length === 0}
          onClick={() => exportInventoryToExcel(entries, currentSite?.name ?? "Site")}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={activeEntries.length === 0}
          onClick={() => exportForm3Pdf(entries, currentSite?.name ?? "Site")}
        >
          <FileText className="h-4 w-4 mr-2" /> Form 3 (PDF)
        </Button>
      </div>

      {/* Quarterly disposal action */}
      {isManagerOrAdmin && activeEntries.length > 0 && (
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button className="w-full bg-primary hover:bg-primary/90">
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Quarterly Disposal ({activeEntries.length} entries)
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
                <Input id="dd" type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
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

      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Waste Type</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cat.</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Generated</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Days</TableHead>
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
                    <TableCell className="text-xs">{entry.activity_type === "preventive" ? "PM" : entry.activity_type === "breakdown" ? "BM" : "5S"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{getWasteName(entry.waste_type_id)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={entry.waste_category === "hazardous" ? "border-overdue/40 text-overdue" : "border-success/40 text-success"}>
                        {entry.waste_category === "hazardous" ? "HAZ" : "NON"}
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
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(entry)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-overdue hover:bg-overdue/10" onClick={() => onDelete(entry.id)} aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Disposal history */}
      {batches.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Disposal History
          </h3>
          {batches.map((b) => {
            const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{b.disposed_date}</p>
                      <p className="text-xs text-muted-foreground">{inBatch.length} entries disposed</p>
                      {b.notes && <p className="text-xs text-muted-foreground mt-1 italic break-words">{b.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => exportDisposalBatchPdf(b, inBatch, currentSite?.name ?? "Site")}
                      >
                        <Download className="h-3 w-3" /> Manifest
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
