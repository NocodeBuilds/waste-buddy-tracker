import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WasteEntry, DisposalBatch } from "@/lib/wasteTypes";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { compressImages } from "@/lib/imageCompress";
import { toast } from "sonner";

// Extend DisposalBatch with status fields from DB
interface DisposalBatchWithStatus extends DisposalBatch {
  status: "pending" | "approved" | "rejected";
  requested_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

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

type UpdateEntryInput = {
  id: string;
  siteId: string;
  updates: Partial<Pick<WasteEntry, "waste_type_id" | "waste_category" | "weight_kg" | "piece_count" | "generated_date" | "activity_type" | "location" | "notes">>;
};

type DeleteEntryInput = { id: string; siteId: string };
type CreateDisposalInput = { disposed_date: string; notes?: string; siteId: string };
type ApproveDisposalInput = { batchId: string; siteId: string; action: "approve" | "reject"; reason?: string };

export function useWasteEntries() {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const qc = useQueryClient();
  const siteId = currentSite?.id;

  // Refs for current site/user so mutations always see the latest values
  // C1 fix: prevents stale-closure bug when switching sites mid-mutation
  const siteIdRef = useRef(siteId);
  const userRef = useRef(user);
  siteIdRef.current = siteId;
  userRef.current = user;

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
    queryFn: async (): Promise<DisposalBatchWithStatus[]> => {
      const { data, error } = await supabase
        .from("disposal_batches")
        .select("*")
        .eq("site_id", siteId!)
        .order("disposed_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DisposalBatchWithStatus[];
    },
  });

  // Helper: invalidate caches for a specific site (uses passed siteId, not closure)
  const invalidateSite = (targetSiteId: string) => {
    qc.invalidateQueries({ queryKey: ["waste_entries", targetSiteId] });
    qc.invalidateQueries({ queryKey: ["disposal_batches", targetSiteId] });
    qc.invalidateQueries({ queryKey: ["waste_entry_photos"] });
    qc.invalidateQueries({ queryKey: ["waste_entry_photo_counts"] });
  };

  // H1 fix: added onError to all mutations
  const onMutationError = (label: string) => (err: Error) => {
    toast.error(err.message || `${label} failed`);
    console.error(`[useWasteEntries] ${label}:`, err);
  };

  const addEntry = useMutation({
    mutationFn: async (entry: NewEntryInput): Promise<string> => {
      // C1 fix: read siteId/user from refs (latest values)
      const currentSiteId = siteIdRef.current;
      const currentUser = userRef.current;
      if (!currentSiteId || !currentUser) throw new Error("No site/user");

      const { photos, ...entryFields } = entry;
      const uploadedPaths: string[] = [];

      try {
        const { data: inserted, error } = await supabase
          .from("waste_entries")
          .insert({
            ...entryFields,
            quantity: entryFields.weight_kg,
            site_id: currentSiteId,
            created_by: currentUser.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        const entryId = inserted.id as string;

        if (photos && photos.length > 0) {
          const compressed = await compressImages(photos);
          for (const file of compressed) {
            const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
            const id = (typeof crypto !== "undefined" && crypto.randomUUID)
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const path = `${currentSiteId}/${entryId}/${id}.${ext}`;
            uploadedPaths.push(path);
            const { error: upErr } = await supabase.storage
              .from("waste-photos")
              .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
            if (upErr) throw upErr;
            const { error: rowErr } = await supabase.from("waste_entry_photos").insert({
              waste_entry_id: entryId,
              site_id: currentSiteId,
              storage_path: path,
              uploaded_by: currentUser.id,
            });
            if (rowErr) throw rowErr;
          }
        }
        return entryId;
      } catch (err) {
        // C3 fix: rollback uploaded photos if entry or photo DB row failed
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("waste-photos").remove(uploadedPaths).catch(() => {});
        }
        throw err;
      }
    },
    onSuccess: (entryId, _vars) => {
      toast.success("Waste entry logged");
      qc.invalidateQueries({ queryKey: ["waste_entries"] });
    },
    onError: onMutationError("Add entry"),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, siteId: targetSiteId, updates }: UpdateEntryInput) => {
      const payload: typeof updates & { quantity?: number } = { ...updates };
      if (typeof updates.weight_kg === "number") payload.quantity = updates.weight_kg;
      const { error } = await supabase.from("waste_entries").update(payload).eq("id", id);
      if (error) throw error;
      void targetSiteId;
    },
    onSuccess: (_d, vars) => {
      invalidateSite(vars.siteId);
      toast.success("Entry updated");
    },
    onError: onMutationError("Update entry"),
  });

  const deleteEntry = useMutation({
    mutationFn: async ({ id, siteId: targetSiteId }: DeleteEntryInput) => {
      const { error } = await supabase.from("waste_entries").delete().eq("id", id);
      if (error) throw error;
      void targetSiteId;
    },
    onSuccess: (_d, vars) => {
      invalidateSite(vars.siteId);
      toast.success("Entry deleted");
    },
    onError: onMutationError("Delete entry"),
  });

  const createDisposalBatch = useMutation({
    mutationFn: async ({ disposed_date, notes, siteId: targetSiteId }: CreateDisposalInput) => {
      const currentUser = userRef.current;
      if (!currentUser) throw new Error("No user");
      const { data: batch, error: bErr } = await supabase
        .from("disposal_batches")
        .insert({
          site_id: targetSiteId,
          disposed_date,
          disposed_by: currentUser.id,
          notes: notes ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      if (bErr) throw bErr;
      return batch.id;
    },
    onSuccess: (_batchId, vars) => {
      invalidateSite(vars.siteId);
      toast.success("Disposal request submitted for approval");
    },
    onError: onMutationError("Create disposal"),
  });

  const approveDisposalBatch = useMutation({
    mutationFn: async ({ batchId, action, reason }: ApproveDisposalInput) => {
      const result = await supabase.functions.invoke("approve-disposal", {
        body: { batch_id: batchId, action, reason },
      });
      if (result.error) {
        const msg = result.error.message || result.error.context?.message || JSON.stringify(result.error);
        throw new Error(msg);
      }
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
    },
    onSuccess: (_d, vars) => {
      invalidateSite(vars.siteId);
      toast.success(`Disposal ${vars.action}d`);
    },
    onError: onMutationError("Approval"),
  });

  return {
    entries: entriesQuery.data ?? [],
    batches: batchesQuery.data ?? [],
    // M1 fix: expose individual loading states
    isLoading: entriesQuery.isLoading || batchesQuery.isLoading,
    entriesIsLoading: entriesQuery.isLoading,
    batchesIsLoading: batchesQuery.isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    createDisposalBatch,
    approveDisposalBatch,
  };
}