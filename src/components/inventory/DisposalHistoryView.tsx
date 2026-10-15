import { errorMessage } from "@/lib/validation";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, CheckCircle, X, Download, Search, Filter, Building2 } from "lucide-react";
import { toast } from "sonner";
import { DisposalBatch, WasteEntry, formatDateDDMMYYYY } from "@/lib/wasteTypes";

import EmptyState from "@/components/ui/empty-state";

interface Props {
  batches: DisposalBatch[];
  entries: WasteEntry[];
  allActiveEntries: WasteEntry[];
  isManagerOrAdmin: boolean;
  currentSiteName: string;
  onApproveDisposal?: (batchId: string) => Promise<void>;
  onRejectDisposal?: (batchId: string, reason?: string) => Promise<void>;
}

export default function DisposalHistoryView({
  batches,
  entries,
  allActiveEntries,
  isManagerOrAdmin,
  currentSiteName,
  onApproveDisposal,
  onRejectDisposal,
}: Props) {
  const { user } = useAuth();
  const { sites, rolesBySite, isAdmin, isRegionalCoordinator } = useSite();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBatches = batches.filter((b) => {
    const status = b.status ?? "approved";
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const notes = (b.notes ?? "").toLowerCase();
      const dateStr = formatDateDDMMYYYY(b.disposed_date).toLowerCase();
      const idMatch = b.id.toLowerCase().includes(q);
      if (!notes.includes(q) && !dateStr.includes(q) && !idMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Official Disposal Batches & Manifests
        </h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          {filteredBatches.length} of {batches.length} {batches.length === 1 ? "batch" : "batches"}
        </span>
      </div>

      {batches.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search batches by date, notes, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs rounded-lg bg-background"
            />
          </div>
          <div className="grid grid-cols-4 sm:flex items-center gap-1">
            {(
              [
                { id: "all", label: "All" },
                { id: "approved", label: "Approved" },
                { id: "pending", label: "Pending" },
                { id: "rejected", label: "Rejected" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.id}
                size="sm"
                variant={statusFilter === opt.id ? "default" : "outline"}
                className={`h-7 px-1.5 sm:px-2.5 text-[11px] rounded-lg justify-center ${
                  statusFilter === opt.id ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                }`}
                onClick={() => setStatusFilter(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Disposal Batches Recorded"
          description="When waste is dispatched to an authorized TSDF or recycler, tap 'Record Disposal' to generate a batch and Form 10 manifest."
        />
      ) : filteredBatches.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Matching Batches Found"
          description="No disposal batches match your current filter and search criteria."
        />
      ) : (
        <div className="space-y-2.5">
          {filteredBatches.map((b) => {
            const batchSiteName = sites.find(s => s.id === b.site_id)?.name ?? currentSiteName;
            const isAuthorized = isAdmin || isRegionalCoordinator || (rolesBySite[b.site_id] ?? []).some(role => role === "admin" || role === "manager");
            const mayDecide = isAuthorized && b.disposed_by !== user?.id;
            const inBatch = entries.filter((e) => e.disposal_batch_id === b.id);
            const status = b.status ?? "approved";
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
                        <p className="text-sm font-semibold text-foreground">{formatDateDDMMYYYY(b.disposed_date)}</p>
                        {batchSiteName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
                            <Building2 className="h-3 w-3 text-primary" />
                            <span>{batchSiteName}</span>
                          </span>
                        )}
                        {isPending && <Badge variant="warning">Pending Approval</Badge>}
                        {isRejected && <Badge variant="destructive">Rejected</Badge>}
                        {!isPending && !isRejected && <Badge variant="success">Approved</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inBatch.length > 0
                          ? `${inBatch.length} entries in batch`
                          : "No entries selected — this batch cannot be approved"}
                      </p>
                      {b.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic break-words bg-muted/40 p-2 rounded-lg">
                          {b.notes}
                        </p>
                      )}
                      {isRejected && b.rejection_reason && (
                        <p className="text-xs text-destructive mt-1.5 font-medium break-words">
                          Reason: {b.rejection_reason}
                        </p>
                      )}
                      {isPending && !mayDecide && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 italic flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-1 rounded">
                          {b.disposed_by === user?.id
                            ? "Awaiting approval by another Facility Manager or Regional Coordinator (Segregation of Duties: Submitter cannot self-approve)."
                            : "Awaiting approval from an authorized Facility Manager or Regional Coordinator."}
                        </p>
                      )}
                      {isPending && mayDecide && onApproveDisposal && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            onClick={async () => {
                              try {
                                await onApproveDisposal(b.id);
                                toast.success("Disposal approved — entries marked as disposed");
                              } catch (err: unknown) {
                                toast.error(errorMessage(err));
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
                                  } catch (err: unknown) {
                                    toast.error(errorMessage(err));
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
                          className="h-8 text-xs gap-1 sm:gap-1.5 shadow-xs rounded-lg px-2 sm:px-3"
                          onClick={async () => { const { exportDisposalBatchPdf } = await import("@/lib/wasteExports"); exportDisposalBatchPdf(b, inBatch, batchSiteName); }}
                        >
                          <Download className="h-3.5 w-3.5 text-primary" />
                          <span className="sm:hidden">Form 10</span>
                          <span className="hidden sm:inline">Form 10 Manifest</span>
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
  );
}
