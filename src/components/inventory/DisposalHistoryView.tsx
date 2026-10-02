import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, CheckCircle, X, Download } from "lucide-react";
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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
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
        <EmptyState
          icon={History}
          title="No Disposal Batches Recorded"
          description="When waste is dispatched to an authorized TSDF or recycler, tap 'Record Disposal' to generate a batch and Form 10 manifest."
        />
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
                        <p className="text-sm font-semibold text-foreground">{formatDateDDMMYYYY(b.disposed_date)}</p>
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
                          onClick={() => exportDisposalBatchPdf(b, inBatch, currentSiteName)}
                        >
                          <Download className="h-3.5 w-3.5 text-primary" /> Form 10 Manifest
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
