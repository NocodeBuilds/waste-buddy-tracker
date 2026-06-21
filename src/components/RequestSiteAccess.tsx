import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Clock, Loader2, LogOut, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Site { id: string; name: string; location: string | null }
interface Req {
  id: string;
  site_id: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
}

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

  useEffect(() => { load(); }, [user]);

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
      if (error.code === "23505") toast.error("You've already requested this site");
      else toast.error(error.message);
      return;
    }
    toast.success("Request submitted — an admin will review it");
    setSiteId(""); setNote("");
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            <div className="bg-primary text-primary-foreground rounded-xl p-3 w-fit mx-auto mb-2">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold">Request site access</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              Choose a site below. An admin will approve your access.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {availableSites.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h2 className="text-sm font-semibold">New request</h2>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Site</Label>
                    <Select value={siteId} onValueChange={setSiteId}>
                      <SelectTrigger><SelectValue placeholder="Pick a site" /></SelectTrigger>
                      <SelectContent>
                        {availableSites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{s.location ? ` — ${s.location}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Message (optional)</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      rows={2}
                      placeholder="Why you need access…"
                    />
                  </div>
                  <Button className="w-full" disabled={!siteId || busy} onClick={submit}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Submit request
                  </Button>
                </CardContent>
              </Card>
            )}

            {pending.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" /> Pending ({pending.length})
                  </h2>
                  <ul className="divide-y">
                    {pending.map((r) => {
                      const s = sites.find((x) => x.id === r.site_id);
                      return (
                        <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{s?.name ?? r.site_id}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Requested {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => cancel(r.id)}>
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
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h2 className="text-sm font-semibold">History</h2>
                  <ul className="divide-y">
                    {decided.map((r) => {
                      const s = sites.find((x) => x.id === r.site_id);
                      const ok = r.status === "approved";
                      return (
                        <li key={r.id} className="py-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-start gap-2">
                            {ok ? <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{s?.name ?? r.site_id}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{r.status}{r.note ? ` — ${r.note}` : ""}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={load}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
