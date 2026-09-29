import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  siteId: string;
}

export default function LocationMasterView({ siteId }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ id: string; code: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_locations")
      .select("id, code, sort_order")
      .eq("site_id", siteId)
      .order("sort_order");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, siteId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from("site_locations")
      .insert({ site_id: siteId, code, sort_order: nextOrder });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Location tag ${code} added`);
    setNewCode("");
    load();
  };

  const del = async (id: string, code: string) => {
    if (!confirm(`Delete location "${code}"?`)) return;
    const { error } = await supabase.from("site_locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Location deleted");
    load();
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-2.5 py-1.5 text-left text-[11px] font-medium flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-foreground font-semibold">
          <Tag className="h-3 w-3 text-primary" />
          Location Tags ({rows.length || "0"})
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/50 pt-2">
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rows.length === 0 && (
                <p className="text-[10px] text-muted-foreground py-0.5">No location tags configured.</p>
              )}
              {rows.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded bg-background border border-border/80 px-1.5 py-0.5 text-[10px] font-mono font-medium shadow-2xs"
                >
                  {r.code}
                  <button
                    onClick={() => del(r.id, r.code)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    aria-label={`Delete ${r.code}`}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={add} className="flex gap-1 pt-0.5">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. WTG-01, BAY-2"
              className="h-7 text-xs rounded-md uppercase"
            />
            <Button type="submit" size="sm" className="h-7 px-2.5 rounded-md" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
