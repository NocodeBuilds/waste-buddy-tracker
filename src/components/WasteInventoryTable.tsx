import { WasteEntry, WASTE_TYPES, getDaysStored, getStatus, DISPOSAL_LIMIT_DAYS } from "@/lib/wasteTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  entries: WasteEntry[];
  onDispose: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function WasteInventoryTable({ entries, onDispose, onDelete }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "disposed">("active");

  const filtered = entries.filter((e) => {
    if (filter === "active") return !e.disposed;
    if (filter === "disposed") return e.disposed;
    if (filter === "overdue") return !e.disposed && getDaysStored(e.generatedDate) >= DISPOSAL_LIMIT_DAYS;
    return true;
  }).sort((a, b) => {
    if (!a.disposed && !b.disposed) return getDaysStored(b.generatedDate) - getDaysStored(a.generatedDate);
    if (a.disposed && !b.disposed) return 1;
    if (!a.disposed && b.disposed) return -1;
    return 0;
  });

  const getWasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name || id;
  const getUnit = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.unit || "";

  const statusBadge = (entry: WasteEntry) => {
    if (entry.disposed) return <Badge className="bg-success text-success-foreground">Disposed</Badge>;
    const status = getStatus(entry);
    if (status === "overdue") return <Badge className="bg-overdue text-overdue-foreground animate-pulse-warning">Overdue!</Badge>;
    if (status === "warning") return <Badge className="bg-warning text-warning-foreground">Warning</Badge>;
    return <Badge className="bg-success/20 text-success border border-success/30">Safe</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Waste Inventory</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="active">In Storage</SelectItem>
            <SelectItem value="overdue">Overdue Only</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>WTG</TableHead>
              <TableHead>Waste Type</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Days Stored</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No entries found</TableCell></TableRow>
            ) : (
              filtered.map((entry) => {
                const days = getDaysStored(entry.generatedDate);
                return (
                  <TableRow key={entry.id} className={getStatus(entry) === "overdue" ? "bg-overdue/5" : ""}>
                    <TableCell className="font-mono font-semibold">{entry.wtgId}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{getWasteName(entry.wasteTypeId)}</TableCell>
                    <TableCell>{entry.quantity} {getUnit(entry.wasteTypeId)}</TableCell>
                    <TableCell className="capitalize text-xs">{entry.activityType}</TableCell>
                    <TableCell className="text-sm">{entry.generatedDate}</TableCell>
                    <TableCell>
                      <span className={days >= DISPOSAL_LIMIT_DAYS ? "text-overdue font-bold" : days >= 70 ? "text-warning font-semibold" : ""}>
                        {entry.disposed ? "—" : `${days} days`}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(entry)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {!entry.disposed && (
                        <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => onDispose(entry.id)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Dispose
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-overdue hover:bg-overdue/10" onClick={() => onDelete(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
