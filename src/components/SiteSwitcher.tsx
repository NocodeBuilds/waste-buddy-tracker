import { useState } from "react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, ChevronDown, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AllSite { id: string; name: string; location: string | null }

export default function SiteSwitcher() {
  const { sites, currentSite, setCurrentSite } = useSite();
  const { user } = useAuth();
  const [reqOpen, setReqOpen] = useState(false);
  const [allSites, setAllSites] = useState<AllSite[]>([]);
  const [myPending, setMyPending] = useState<Set<string>>(new Set());
  const [loadingSites, setLoadingSites] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openRequest = async () => {
    setReqOpen(true);
    setLoadingSites(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from("sites").select("id, name, location").order("name"),
      supabase
        .from("site_access_requests")
        .select("site_id, status")
        .eq("user_id", user!.id)
        .in("status", ["pending", "approved"]),
    ]);
    setAllSites(s ?? []);
    setMyPending(new Set((r ?? []).map((x: any) => x.site_id)));
    setLoadingSites(false);
  };

  const submit = async () => {
    if (!siteId || !user) return;
    setBusy(true);
    const { error } = await supabase.from("site_access_requests").insert({
      user_id: user.id, site_id: siteId, note: note.trim() || null, status: "pending",
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("You've already requested this site");
      else toast.error(error.message);
      return;
    }
    toast.success("Request submitted — an admin will review it");
    setReqOpen(false);
    setSiteId(""); setNote("");
  };

  const currentIds = new Set(sites.map((s) => s.id));
  const availableSites = allSites.filter((s) => !currentIds.has(s.id) && !myPending.has(s.id));

  if (sites.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-primary-foreground/90 hover:text-primary-foreground bg-primary-foreground/10 rounded-md px-2 py-1">
          <Building2 className="h-3.5 w-3.5" />
          <span className="font-semibold truncate max-w-[120px]">{currentSite?.name ?? "Select site"}</span>
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Your sites</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sites.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setCurrentSite(s)}
              className={currentSite?.id === s.id ? "bg-accent/10" : ""}
            >
              <Building2 className="h-4 w-4 mr-2" />
              <div className="flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openRequest}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-sm">Request another site</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request site access</DialogTitle>
            <DialogDescription>
              Choose a site you travel to. An admin of that site will approve your access.
            </DialogDescription>
          </DialogHeader>
          {loadingSites ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableSites.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No other sites are available to request right now.
            </p>
          ) : (
            <div className="space-y-3">
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
                  value={note} onChange={(e) => setNote(e.target.value)}
                  maxLength={300} rows={2}
                  placeholder="Why you need access…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!siteId || busy || availableSites.length === 0}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
