import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

export interface SiteLocation {
  id: string;
  site_id: string | null;
  code: string;
  is_common: boolean;
  sort_order: number;
}

/**
 * Locations the current user can pick from for the current site:
 * site-specific codes + common (Hazardous Shed / PSS / HT Yard).
 */
export function useSiteLocations() {
  const { currentSite } = useSite();
  const siteId = currentSite?.id;

  return useQuery({
    queryKey: ["site_locations", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<SiteLocation[]> => {
      const { data, error } = await supabase
        .from("site_locations")
        .select("id, site_id, code, is_common, sort_order")
        .or(`site_id.eq.${siteId},is_common.eq.true`)
        .order("is_common", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SiteLocation[];
    },
  });
}
