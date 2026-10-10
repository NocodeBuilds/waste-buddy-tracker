import { useState } from "react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, ChevronDown, Plus, Loader2, Check, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ALL_SITES_OBJECT } from "@/contexts/SiteContext";
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
import { cn } from "@/lib/utils";

interface AllSite { id: string; name: string; location: string | null }

export default function SiteSwitcher() {
  const { sites, currentSite, setCurrentSite, isAllSitesMode } = useSite();
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
        <DropdownMenuTrigger className={cn(
          "flex items-center gap-1.5 text-xs font-medium border rounded-lg h-9 px-2.5 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          isAllSitesMode
            ? "bg-primary/10 border-primary/40 text-primary font-semibold hover:bg-primary/15"
            : "bg-card hover:bg-muted/70 border-border/80 text-foreground"
        )}>
          {isAllSitesMode ? (
            <Globe className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <span className="font-semibold truncate max-w-[135px]">
            {isAllSitesMode ? "All Facilities (Regional)" : (currentSite?.name ?? "Select site")}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl p-1 shadow-lg border-border/80">
          {sites.length > 1 && (
            <>
              <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center justify-between">
                <span>Regional Oversight</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                  {sites.length} sites
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setCurrentSite(ALL_SITES_OBJECT)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-xs transition-colors mb-1",
                  isAllSitesMode ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/60"
                )}
              >
                <Globe className={cn("h-4 w-4 shrink-0", isAllSitesMode ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold">All Facilities (Cumulative)</p>
                  <p className="text-[10px] text-muted-foreground truncate">Consolidated regional dashboard</p>
                </div>
                {isAllSitesMode && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Individual Facilities
          </DropdownMenuLabel>
          <div className="space-y-0.5">
            {sites.map((s) => {
              const isSelected = !isAllSitesMode && currentSite?.id === s.id;
              return (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setCurrentSite(s)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-xs transition-colors",
                    isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <Building2 className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    {s.location && <p className="text-[10px] text-muted-foreground truncate">{s.location}</p>}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openRequest} className="flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>Request access to another site</span>
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
