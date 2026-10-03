import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";
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
import { Site } from "@/types";
import LocationMasterView from "./LocationMasterView";

interface Props {
  sites: Site[];
  onChanged: () => Promise<void>;
}

export default function FacilitiesManagementView({ sites, onChanged }: Props) {
  const { setCurrentSite } = useSite();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Site | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast.error("Site name is required");
    setBusy(true);
    const { data, error } = await supabase
      .from("sites")
      .insert({ name: n, location: loc.trim() || null })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Facility "${data.name}" created`);
    setName("");
    setLoc("");
    setShowAddSite(false);
    await onChanged();
    setCurrentSite({ id: data.id, name: data.name, location: data.location });
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
    const { error } = await supabase.from("sites").update({ name: v }).eq("id", renameTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Site renamed");
    setRenameTarget(null);
    onChanged();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("sites").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Site deleted");
    setDeleteTarget(null);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facilities & Location Tags ({sites.length})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary/90 gap-1 px-2"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Facility name"
                  className="h-8 text-xs rounded-lg"
                  required
                />
                <Input
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder="Location region (optional)"
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={busy}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Create Site
              </Button>
            </form>
          )}

          {/* Sites list with Location Tag Manager */}
          <div className="space-y-2.5">
            {sites.map((s) => (
              <div key={s.id} className="p-3 rounded-lg border border-border/70 bg-background space-y-2">
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
                      aria-label="Delete site"
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
              Enter a new name for "{renameTarget?.name}".
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

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">
              Delete facility "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This permanently removes all members, entries, and disposal records associated with this site.
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
              Delete Facility
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
