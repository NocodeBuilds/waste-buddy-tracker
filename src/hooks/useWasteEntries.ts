import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WasteEntry, DisposalBatch } from "@/lib/wasteTypes";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

export function useWasteEntries() {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const qc = useQueryClient();
  const siteId = currentSite?.id;

  const entriesQuery = useQuery({
    queryKey: ["waste_entries", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<WasteEntry[]> => {
      const { data, error } = await supabase
        .from("waste_entries")
        .select("*")
        .eq("site_id", siteId!)
        .order("generated_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WasteEntry[];
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["disposal_batches", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<DisposalBatch[]> => {
      const { data, error } = await supabase
        .from("disposal_batches")
        .select("*")
        .eq("site_id", siteId!)
        .order("disposed_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DisposalBatch[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Omit<WasteEntry, "id" | "site_id" | "created_by" | "disposal_batch_id" | "created_at">) => {
      if (!siteId || !user) throw new Error("No site/user");
      const { error } = await supabase.from("waste_entries").insert({
        ...entry,
        site_id: siteId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waste_entries", siteId] }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waste_entries", siteId] }),
  });

  const createDisposalBatch = useMutation({
    mutationFn: async (params: { disposed_date: string; notes?: string }) => {
      if (!siteId || !user) throw new Error("No site/user");
      // Create batch
      const { data: batch, error: bErr } = await supabase
        .from("disposal_batches")
        .insert({
          site_id: siteId,
          disposed_date: params.disposed_date,
          disposed_by: user.id,
          notes: params.notes ?? null,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      // Mark all active entries with this batch
      const { error: uErr } = await supabase
        .from("waste_entries")
        .update({ disposal_batch_id: batch.id })
        .eq("site_id", siteId)
        .is("disposal_batch_id", null);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste_entries", siteId] });
      qc.invalidateQueries({ queryKey: ["disposal_batches", siteId] });
    },
  });

  return {
    entries: entriesQuery.data ?? [],
    batches: batchesQuery.data ?? [],
    isLoading: entriesQuery.isLoading || batchesQuery.isLoading,
    addEntry,
    deleteEntry,
    createDisposalBatch,
  };
}
