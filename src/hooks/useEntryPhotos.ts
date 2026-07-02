import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EntryPhoto {
  id: string;
  storage_path: string;
  signedUrl: string;
  created_at: string;
}

export function useEntryPhotos(entryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["waste_entry_photos", entryId],
    enabled: !!entryId && enabled,
    queryFn: async (): Promise<EntryPhoto[]> => {
      const { data, error } = await supabase
        .from("waste_entry_photos")
        .select("id, storage_path, created_at")
        .eq("waste_entry_id", entryId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const paths = data.map((r) => r.storage_path);
      const { data: signed, error: sErr } = await supabase.storage
        .from("waste-photos")
        .createSignedUrls(paths, 3600);
      if (sErr) throw sErr;

      return data.map((r, i) => ({
        id: r.id,
        storage_path: r.storage_path,
        created_at: r.created_at,
        signedUrl: signed?.[i]?.signedUrl ?? "",
      }));
    },
  });
}

export function useEntryPhotoCounts(entryIds: string[]) {
  return useQuery({
    queryKey: ["waste_entry_photo_counts", entryIds.slice().sort().join(",")],
    enabled: entryIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("waste_entry_photos")
        .select("waste_entry_id")
        .in("waste_entry_id", entryIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.waste_entry_id] = (counts[r.waste_entry_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      const { error: sErr } = await supabase.storage.from("waste-photos").remove([photo.storage_path]);
      if (sErr) throw sErr;
      const { error } = await supabase.from("waste_entry_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waste_entry_photos"] }),
  });
}
