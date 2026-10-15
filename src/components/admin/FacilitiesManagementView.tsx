import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Loader2, Globe, MapPin } from "lucide-react";
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
import { useSite } from "@/contexts/SiteContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Site, Region } from "@/types";
import LocationMasterView from "./LocationMasterView";

interface Props {
  sites: Site[];
  onChanged: () => Promise<void>;
}

const COMMON_STATES = [
  "Maharashtra",
  "Gujarat",
  "Karnataka",
  "Tamil Nadu",
  "Telangana",
  "Andhra Pradesh",
  "Uttar Pradesh",
  "Rajasthan",
  "Haryana",
  "West Bengal",
];

export default function FacilitiesManagementView({ sites, onChanged }: Props) {
  const { setCurrentSite, regions, refresh } = useSite();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("none");
  const [selectedState, setSelectedState] = useState<string>("Maharashtra");
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Site | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);

  // Region Creation State
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [regionName, setRegionName] = useState("");
  const [regionState, setRegionState] = useState("Maharashtra");
  const [regionCode, setRegionCode] = useState("");
  const [regionBusy, setRegionBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast.error("Site name is required");
    setBusy(true);

    const reg = regions.find((r) => r.id === selectedRegionId);
    const locationString = loc.trim() || (reg ? `${reg.name}, ${reg.state}` : `${selectedState} Region`);

    // Primary insert payload with fallback
    let insertPayload: Record<string, unknown> = {
      name: n,
      location: locationString,
    };
    if (reg) {
      insertPayload = {
        ...insertPayload,
        region_id: reg.id.startsWith("inferred-") ? null : reg.id,
        state: reg.state,
      };
    } else if (selectedState) {
      insertPayload.state = selectedState;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await supabase.from("sites").insert(insertPayload as any).select().single();

    // If region_id or state column not yet present on remote DB, retry with core schema
    if (error && (error.message.includes("column") || error.code === "42703")) {
      const retry = await supabase.from("sites").insert({ name: n, location: locationString }).select().single();
      data = retry.data;
      error = retry.error;
    }

    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to create facility");
    toast.success(`Facility "${data.name}" created`);
    setName("");
    setLoc("");
    setSelectedRegionId("none");
    setShowAddSite(false);
    await onChanged();
    setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  const createRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    const rName = regionName.trim();
    if (!rName) return toast.error("Region name is required");
    setRegionBusy(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("regions").insert({
      name: rName,
      state: regionState,
      code: regionCode.trim().toUpperCase() || rName.slice(0, 4).toUpperCase(),
    });

    setRegionBusy(false);
    if (error) {
      if (error.code === "42P01") {
        toast.info("Regions table not yet deployed in database. Run the 20261016 migration in Supabase SQL editor.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success(`Region "${rName}" created`);
    setRegionName("");
    setRegionCode("");
    setShowAddRegion(false);
    await refresh();
  };

  const openRename = (s: Site) => {
    setRenameTarget(s);
    setRenameValue(s.name);
  };

  const commitRename = async () => {
    if (!renameTarget) return;
    const v = renameValue.trim();
    if (!v || v === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const { error } = await supabase.from("sites").update({ name: v }).eq("id", renameTarget.id).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Site renamed");
    setRenameTarget(null);
    onChanged();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (sites.length <= 1) {
      toast.error("Cannot archive the only remaining facility. Create another facility first.");
      setDeleteTarget(null);
      return;
    }
    let { error } = await supabase
      .from("sites")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", deleteTarget.id)
      .select("id")
      .single();

    // If archived_at column does not exist, fall back to deletion
    if (error && (error.message.includes("archived_at") || error.code === "42703")) {
      const res = await supabase.from("sites").delete().eq("id", deleteTarget.id);
      error = res.error;
    }

    if (error) return toast.error(error.message);
    toast.success("Site archived");
    setDeleteTarget(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* ── Section: Regional & State Clusters ── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                State & Regional Clusters ({regions.length})
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 px-2.5 rounded-lg font-medium"
              onClick={() => setShowAddRegion(!showAddRegion)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddRegion ? "Cancel" : "New Region"}</span>
            </Button>
          </div>

          {/* Add Region Drawer */}
          {showAddRegion && (
            <form onSubmit={createRegion} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" /> Create Regional Cluster
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="Region name (e.g. Pune & Chakan Cluster)"
                  className="h-8 text-xs rounded-lg"
                  required
                />
                <Select value={regionState} onValueChange={setRegionState}>
                  <SelectTrigger className="h-8 text-xs rounded-lg">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_STATES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  placeholder="Code (e.g. MH-PUNE)"
                  className="h-8 text-xs rounded-lg uppercase"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={regionBusy}
              >
                {regionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Create Regional Cluster
              </Button>
            </form>
          )}

          {/* Regions Badge Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {regions.map((r) => {
              const count = sites.filter(
                (s) => s.region_id === r.id || (s.location && s.location.includes(r.state))
              ).length;
              return (
                <div key={r.id} className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between gap-1 shadow-2xs">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                      {r.code ?? r.state.slice(0, 3).toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" /> {r.state}
                    </span>
                    <span className="font-mono">{count} {count === 1 ? "site" : "sites"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section: Facilities & Location Tags ── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facilities & Storage Location Tags ({sites.length})
              </h3>
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1 px-2.5 rounded-lg font-medium"
              onClick={() => setShowAddSite(!showAddSite)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddSite ? "Cancel" : "Add Facility"}</span>
            </Button>
          </div>

          {/* Add Site Drawer */}
          {showAddSite && (
            <form onSubmit={create} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Register Facility
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Facility name (e.g. Pune Plant 1)"
                  className="h-8 text-xs rounded-lg"
                  required
                />
                <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                  <SelectTrigger className="h-8 text-xs rounded-lg">
                    <SelectValue placeholder="Assign Region (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific region</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.state} — {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder="Specific address / city (optional)"
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={busy}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Create Facility
              </Button>
            </form>
          )}

          {/* Sites list with Location Tag Manager */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {sites.map((s) => (
              <div key={s.id} className="p-3 rounded-lg border border-border/70 bg-background space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                    {s.location && <p className="text-[10px] text-muted-foreground font-mono truncate">{s.location}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] rounded-md"
                      onClick={() => openRename(s)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md"
                      onClick={() => setDeleteTarget(s)}
                      aria-label="Archive site"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <LocationMasterView siteId={s.id} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <AlertDialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Rename facility</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Enter a new name for &ldquo;{renameTarget?.name}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-9 text-xs rounded-lg my-1"
            autoFocus
          />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                commitRename();
              }}
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete/Archive dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">
              Archive facility &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This hides the facility from active lists. Its members, roles, entries, and disposal records are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive Facility
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
