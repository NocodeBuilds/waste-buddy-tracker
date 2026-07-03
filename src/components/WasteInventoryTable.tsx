import { useState } from "react";
import { WasteEntry, WASTE_TYPES, getDaysStored, getStatus, DISPOSAL_LIMIT_DAYS, isDisposed, DisposalBatch } from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle, Loader2, FileSpreadsheet, FileText, Pencil, Download } from "lucide-react";
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
  const getUnit = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.unit || "";

  const statusBadge = (entry: WasteEntry) => {
    if (isDisposed(entry)) return <Badge className="bg-success text-success-foreground">Disposed</Badge>;
    const status = getStatus(entry);
    if (status === "overdue") return <Badge className="bg-overdue text-overdue-foreground">Overdue!</Badge>;
    if (status === "warning") return <Badge className="bg-warning text-warning-foreground">Warning</Badge>;
    return <Badge className="bg-success/20 text-success border border-success/30">Safe</Badge>;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-lg">Waste Inventory</h3>
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
              <TableHead>Location</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Waste Type</TableHead>
              <TableHead>Cat.</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Photos</TableHead>
              {isManagerOrAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                    <TableCell className="text-xs">{entry.activity_type === "preventive" ? "PM" : "BM"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{getWasteName(entry.waste_type_id)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={entry.waste_category === "hazardous" ? "border-overdue/40 text-overdue" : "border-success/40 text-success"}>
                        {entry.waste_category === "hazardous" ? "HAZ" : "NON"}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.quantity} {getUnit(entry.waste_type_id)}</TableCell>
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
                <CardContent className="p-3">
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
