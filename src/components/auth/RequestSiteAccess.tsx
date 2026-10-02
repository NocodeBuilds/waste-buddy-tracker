import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Clock,
  Loader2,
  LogOut,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Site, AccessRequestRow as Req } from "@/types";
import { formatDateDDMMYYYY } from "@/lib/wasteTypes";
import { Badge } from "@/components/ui/badge";

export default function RequestSiteAccess({ onApproved }: { onApproved: () => void }) {
  const { user, signOut } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from("sites").select("id, name, location").order("name"),
      supabase
        .from("site_access_requests")
        .select("id, site_id, status, note, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setSites(s ?? []);
    setReqs((r ?? []) as Req[]);
    setLoading(false);

    // If approved, hand off
    if ((r ?? []).some((x: any) => x.status === "approved")) {
      onApproved();
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const submit = async () => {
    if (!siteId || !user) return;
    setBusy(true);
    const { error } = await supabase.from("site_access_requests").insert({
      user_id: user.id,
      site_id: siteId,
      note: note.trim() || null,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("You've already requested access for this site");
      else toast.error(error.message);
      return;
    }
    toast.success("Access request submitted — site admin will be notified");
    setSiteId("");
    setNote("");
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("site_access_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request cancelled");
    load();
  };

  const requestedIds = new Set(reqs.filter((r) => r.status !== "rejected").map((r) => r.site_id));
  const availableSites = sites.filter((s) => !requestedIds.has(s.id));
  const pending = reqs.filter((r) => r.status === "pending");
  const decided = reqs.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30 px-4 py-12">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header card */}
        <Card className="rounded-2xl border border-border/80 shadow-md bg-card/95 backdrop-blur-xs">
          <CardContent className="p-6 text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 mb-1">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Facility Access Request</h1>
            <p className="text-xs font-semibold text-primary">{user?.email}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account requires site administrator authorization before you can view or record hazardous waste logs.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {availableSites.length > 0 && (
              <Card className="rounded-xl border border-border/80 shadow-xs">
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-primary" /> Request Access to Facility
                  </h2>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Facility Site</Label>
                    <Select value={siteId} onValueChange={setSiteId}>
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue placeholder="Choose a facility site" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.location ? `(${s.location})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Reason / Technician Note (optional)</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      rows={2}
                      placeholder="e.g., Assigned to turbine maintenance PM crew..."
                      className="text-xs rounded-lg resize-none"
                    />
                  </div>
                  <Button
                    className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg"
                    disabled={!siteId || busy}
                    onClick={submit}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Submit Access Request
                  </Button>
                </CardContent>
              </Card>
            )}

            {pending.length > 0 && (
              <Card className="rounded-xl border border-amber-500/40 bg-amber-500/[0.02] shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending Approval ({pending.length})
                    </h2>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {pending.map((r) => {
                      const s = sites.find((x) => x.id === r.site_id);
                      return (
                        <li key={r.id} className="py-2.5 flex items-center justify-between gap-2 first:pt-1 last:pb-1">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{s?.name ?? r.site_id}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Requested {formatDateDDMMYYYY(r.created_at)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive rounded-lg"
                            onClick={() => cancel(r.id)}
                          >
                            Cancel
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {decided.length > 0 && (
              <Card className="rounded-xl border border-border/80 shadow-xs">
                <CardContent className="p-4 space-y-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Request History
                  </h2>
                  <ul className="divide-y divide-border/60">
                    {decided.map((r) => {
                      const s = sites.find((x) => x.id === r.site_id);
                      const ok = r.status === "approved";
                      return (
                        <li key={r.id} className="py-2.5 flex items-center justify-between gap-2 first:pt-1 last:pb-1">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{s?.name ?? r.site_id}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {r.status} {r.note ? `— "${r.note}"` : ""}
                            </p>
                          </div>
                          {ok ? (
                            <Badge variant="success" className="text-[10px]">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Rejected
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                onClick={load}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Check Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                onClick={signOut}
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
