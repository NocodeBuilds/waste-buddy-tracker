import { useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WasteEntry, DisposalBatch } from "@/lib/wasteTypes";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { compressImages } from "@/lib/imageCompress";
import { toast } from "sonner";
import { saveToPendingQueue, getPendingQueue, syncPendingEntries } from "@/lib/offlineSync";

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
type CreateDisposalInput = { disposed_date: string; notes?: string; siteId: string; entry_ids?: string[] };
type ApproveDisposalInput = { batchId: string; siteId: string; action: "approve" | "reject"; reason?: string };

export function useWasteEntries() {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const qc = useQueryClient();
  const siteId = currentSite?.id;

  // Refs for current site/user so mutations always see the latest values
  const siteIdRef = useRef(siteId);
  const userRef = useRef(user);
  siteIdRef.current = siteId;
  userRef.current = user;

  // Auto-sync pending offline mutations when coming back online
  useEffect(() => {
    const handleOnline = () => {
      void syncPendingEntries(qc);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [qc]);

  const entriesQuery = useQuery({
    queryKey: ["waste_entries", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<WasteEntry[]> => {
      const cacheKey = `wastebuddy_entries_${siteId}`;
      try {
        const { data, error } = await supabase
          .from("waste_entries")
          .select("*")
          .eq("site_id", siteId!)
          .order("generated_date", { ascending: false });
        if (error) throw new Error(error.message);
        const entries = (data ?? []) as WasteEntry[];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(entries));
          } catch {}
        }
        const pending = getPendingQueue()
          .filter((p) => p.siteId === siteId)
          .map((p) => ({
            id: p.tempId,
            site_id: p.siteId,
            waste_type_id: p.data.waste_type_id,
            waste_category: p.data.waste_category,
            weight_kg: p.data.weight_kg,
            piece_count: p.data.piece_count ?? null,
            generated_date: p.data.generated_date,
            activity_type: p.data.activity_type,
            location: p.data.location ?? null,
            notes: p.data.notes ?? null,
            created_by: p.userId,
            created_at: new Date(p.timestamp).toISOString(),
            quantity: p.data.weight_kg,
          } as WasteEntry));

        return [...pending, ...entries];
      } catch (err) {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as WasteEntry[];
              const pending = getPendingQueue()
                .filter((p) => p.siteId === siteId)
                .map((p) => ({
                  id: p.tempId,
                  site_id: p.siteId,
                  waste_type_id: p.data.waste_type_id,
                  waste_category: p.data.waste_category,
                  weight_kg: p.data.weight_kg,
                  piece_count: p.data.piece_count ?? null,
                  generated_date: p.data.generated_date,
                  activity_type: p.data.activity_type,
                  location: p.data.location ?? null,
                  notes: p.data.notes ?? null,
                  created_by: p.userId,
                  created_at: new Date(p.timestamp).toISOString(),
                  quantity: p.data.weight_kg,
                } as WasteEntry));
              return [...pending, ...parsed];
            } catch {}
          }
        }
        throw err;
      }
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["disposal_batches", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<DisposalBatchWithStatus[]> => {
      const cacheKey = `wastebuddy_batches_${siteId}`;
      try {
        const { data, error } = await supabase
          .from("disposal_batches")
          .select("*")
          .eq("site_id", siteId!)
          .order("disposed_date", { ascending: false });
        if (error) throw new Error(error.message);
        const batches = (data ?? []) as DisposalBatchWithStatus[];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(batches));
          } catch {}
        }
        return batches;
      } catch (err) {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              return JSON.parse(cached) as DisposalBatchWithStatus[];
            } catch {}
          }
        }
        throw err;
      }
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
  const onMutationError = (label: string) => (err: unknown) => {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    toast.error(message || `${label} failed`);
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

      // Offline check: store in local offline queue
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        saveToPendingQueue({
          tempId,
          siteId: currentSiteId,
          userId: currentUser.id,
          timestamp: Date.now(),
          data: {
            waste_type_id: entryFields.waste_type_id,
            waste_category: entryFields.waste_category,
            weight_kg: entryFields.weight_kg,
            piece_count: entryFields.piece_count,
            generated_date: entryFields.generated_date,
            activity_type: entryFields.activity_type,
            location: entryFields.location,
            notes: entryFields.notes,
          },
        });
        qc.setQueryData<WasteEntry[]>(["waste_entries", currentSiteId], (prev = []) => [
          {
            id: tempId,
            site_id: currentSiteId,
            waste_type_id: entryFields.waste_type_id,
            waste_category: entryFields.waste_category,
            weight_kg: entryFields.weight_kg,
            piece_count: entryFields.piece_count ?? null,
            generated_date: entryFields.generated_date,
            activity_type: entryFields.activity_type,
            location: entryFields.location ?? null,
            notes: entryFields.notes ?? null,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            quantity: entryFields.weight_kg,
          } as WasteEntry,
          ...prev,
        ]);
        toast.info("Saved offline — will automatically sync when back online");
        return tempId;
      }

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
        if (error) throw new Error(error.message);
        const entryId = inserted.id as string;

        if (photos && photos.length > 0) {
          const MAX_FILE_MB = 25;
          const bad = photos.filter((f) => !f.type.startsWith("image/"));
          if (bad.length > 0) {
            throw new Error(`Invalid file type: ${bad.map((f) => f.name).join(", ")}. Only images are allowed.`);
          }
          const tooBig = photos.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
          if (tooBig.length > 0) {
            throw new Error(`File too large (max ${MAX_FILE_MB} MB): ${tooBig.map((f) => f.name).join(", ")}`);
          }
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
            if (upErr) throw new Error(upErr.message);
            const { error: rowErr } = await supabase.from("waste_entry_photos").insert({
              waste_entry_id: entryId,
              site_id: currentSiteId,
              storage_path: path,
              uploaded_by: currentUser.id,
            });
            if (rowErr) throw new Error(rowErr.message);
          }
        }
        return entryId;
      } catch (err) {
        // Fallback to offline queue if network fails
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          saveToPendingQueue({
            tempId,
            siteId: currentSiteId,
            userId: currentUser.id,
            timestamp: Date.now(),
            data: {
              waste_type_id: entryFields.waste_type_id,
              waste_category: entryFields.waste_category,
              weight_kg: entryFields.weight_kg,
              piece_count: entryFields.piece_count,
              generated_date: entryFields.generated_date,
              activity_type: entryFields.activity_type,
              location: entryFields.location,
              notes: entryFields.notes,
            },
          });
          qc.setQueryData<WasteEntry[]>(["waste_entries", currentSiteId], (prev = []) => [
            {
              id: tempId,
              site_id: currentSiteId,
              waste_type_id: entryFields.waste_type_id,
              waste_category: entryFields.waste_category,
              weight_kg: entryFields.weight_kg,
              piece_count: entryFields.piece_count ?? null,
              generated_date: entryFields.generated_date,
              activity_type: entryFields.activity_type,
              location: entryFields.location ?? null,
              notes: entryFields.notes ?? null,
              created_by: currentUser.id,
              created_at: new Date().toISOString(),
              quantity: entryFields.weight_kg,
            } as WasteEntry,
            ...prev,
          ]);
          toast.info("Saved offline — will automatically sync when back online");
          return tempId;
        }

        // C3 fix: rollback uploaded photos if entry or photo DB row failed
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("waste-photos").remove(uploadedPaths).catch(() => {});
        }
        throw err;
      }
    },
    onSuccess: (_entryId, _vars) => {
      // Toast is handled by the form (one toast per log, not per entry)
      qc.invalidateQueries({ queryKey: ["waste_entries"] });
    },
    onError: onMutationError("Add entry"),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, siteId: targetSiteId, updates }: UpdateEntryInput) => {
      const payload: typeof updates & { quantity?: number } = { ...updates };
      if (typeof updates.weight_kg === "number") payload.quantity = updates.weight_kg;
      const { error } = await supabase.from("waste_entries").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
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
      if (!targetSiteId) throw new Error("No site selected");
      const { error } = await supabase.from("waste_entries").delete().eq("id", id).eq("site_id", targetSiteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      invalidateSite(vars.siteId);
      toast.success("Entry deleted");
    },
    onError: onMutationError("Delete entry"),
  });

  const createDisposalBatch = useMutation({
    mutationFn: async ({ disposed_date, notes, siteId: targetSiteId, entry_ids }: CreateDisposalInput) => {
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
      if (bErr) throw new Error(bErr.message);

      if (entry_ids && entry_ids.length > 0) {
        const { error: linkErr } = await supabase
          .from("waste_entries")
          .update({ disposal_batch_id: batch.id })
          .in("id", entry_ids);
        if (linkErr) {
          console.error("Failed to link selected entries to batch:", linkErr);
        }
      }

      return batch.id;
    },
    onSuccess: (_batchId, vars) => {
      invalidateSite(vars.siteId);
      toast.success("Disposal request submitted for approval");
    },
    onError: onMutationError("Create disposal"),
  });

  const approveDisposalBatch = useMutation({
    mutationFn: async ({ batchId, siteId: targetSiteId, action, reason }: ApproveDisposalInput) => {
      const result = await supabase.functions.invoke("approve-disposal", {
        body: { batch_id: batchId, site_id: targetSiteId, action, reason },
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