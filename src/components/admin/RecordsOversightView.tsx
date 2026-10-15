import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { readAll } from "@/lib/pagination";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WASTE_TYPES, formatDateDDMMYYYY, getMeasureUnit, unitLabel } from "@/lib/wasteTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";

interface Props {
  siteId: string;
}

export default function RecordsOversightView({ siteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["waste_entries", "oversight", user?.id, siteId], enabled: !!user && siteId !== "ALL_SITES",
    queryFn: () => readAll((from,to) => supabase.from("waste_entries").select("*").eq("site_id",siteId).order("created_at", {ascending:false}).order("id").range(from,to)) });
  const rows = records.data ?? [];
  const loading = records.isLoading;
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const del = async (id: string) => {
    setPendingDel(null);
    const { error } = await supabase.from("waste_entries").delete().eq("id", id).eq("site_id", siteId).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Record deleted");
    await qc.invalidateQueries({queryKey:["waste_entries"]});
    await qc.invalidateQueries({queryKey:["audit_log"]});
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const wt = (WASTE_TYPES.find((w) => w.id === r.waste_type_id)?.name ?? r.waste_type_id).toLowerCase();
    const loc = (r.location ?? "").toLowerCase();
    return wt.includes(q) || loc.includes(q);
  });

  return (
    <>
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Records Oversight
            </h3>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          </div>

          {records.error && <p role="alert">{records.error.message}</p>}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Matching Records"
              description="No entries matched your search term across this facility."
              compact
            />
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Location / Tag</th>
                      <th className="py-2.5 px-3">Waste Type</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Activity</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtered.map((r) => {
                      const wt = WASTE_TYPES.find((w) => w.id === r.waste_type_id);
                      return (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                            {formatDateDDMMYYYY(r.generated_date)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 text-[11px]">
                              {r.location || "General"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-foreground max-w-[200px] truncate">
                            {wt?.name ?? r.waste_type_id}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {r.weight_kg ?? r.quantity ?? "—"}{" "}
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {unitLabel(getMeasureUnit(r.waste_type_id))}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase bg-secondary/80 px-1.5 py-0.5 rounded">
                              {r.activity_type || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {r.disposal_batch_id ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                Disposed
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md"
                              onClick={() => setPendingDel(r.id)}
                              aria-label="Delete entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="sm:hidden divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
                {filtered.map((r) => {
                  const wt = WASTE_TYPES.find((w) => w.id === r.waste_type_id);
                  return (
                    <div key={r.id} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          <span className="font-mono bg-muted/60 px-1 py-0.2 rounded border border-border/40 mr-1.5">
                            {r.location || "General"}
                          </span>
                          {wt?.name ?? r.waste_type_id}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDateDDMMYYYY(r.generated_date)} · {r.weight_kg ?? r.quantity ?? "—"} {unitLabel(getMeasureUnit(r.waste_type_id))} · {r.activity_type}
                          {r.disposal_batch_id ? " · (Disposed)" : ""}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                        onClick={() => setPendingDel(r.id)}
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDel} onOpenChange={(open) => !open && setPendingDel(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">Permanently delete record?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will remove the entry from inventory totals and statutory reports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setPendingDel(null)} className="h-9 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDel) await del(pendingDel);
              }}
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
