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

  type NewEntryInput = {
    waste_type_id: string;
    waste_category: WasteEntry["waste_category"];
    weight_kg: number;
    piece_count?: number | null;
    generated_date: string;
    activity_type: WasteEntry["activity_type"];
    location?: string | null;
    notes?: string | null;
    photos?: File[];
  };

  const addEntry = useMutation({
    mutationFn: async (entry: NewEntryInput) => {
      if (!siteId || !user) throw new Error("No site/user");
      const { photos, ...entryFields } = entry;

      const { data: inserted, error } = await supabase
        .from("waste_entries")
        .insert({
          ...entryFields,
          // Keep legacy `quantity` in sync with weight for older readers.
          quantity: entryFields.weight_kg,
          site_id: siteId,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const entryId = inserted.id as string;

      if (photos && photos.length > 0) {
        for (const file of photos) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${siteId}/${entryId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("waste-photos")
            .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
          if (upErr) throw upErr;
          const { error: rowErr } = await supabase.from("waste_entry_photos").insert({
            waste_entry_id: entryId,
            site_id: siteId,
            storage_path: path,
            uploaded_by: user.id,
          });
          if (rowErr) throw rowErr;
        }
      }
      return entryId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste_entries", siteId] });
      qc.invalidateQueries({ queryKey: ["waste_entry_photos"] });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async (
      params: { id: string } & Partial<Pick<WasteEntry, "waste_type_id" | "waste_category" | "weight_kg" | "piece_count" | "generated_date" | "activity_type" | "location" | "notes">>,
    ) => {
      const { id, ...updates } = params;
      const payload: typeof updates & { quantity?: number } = { ...updates };
      if (typeof updates.weight_kg === "number") payload.quantity = updates.weight_kg;
      const { error } = await supabase.from("waste_entries").update(payload).eq("id", id);
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
    updateEntry,
    deleteEntry,
    createDisposalBatch,
  };
}
