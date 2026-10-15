import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Site, Role, Region } from "@/types";
import { errorMessage } from "@/lib/validation";
import { readAll } from "@/lib/pagination";

export const ALL_SITES_ID = "ALL_SITES";
export const ALL_SITES_OBJECT: Site = {
  id: ALL_SITES_ID,
  name: "All Facilities (Regional Overview)",
  location: "Consolidated Multi-Facility Radar",
};

interface SiteContextValue {
  sites: Site[];
  regions: Region[];
  currentSite: Site | null;
  setCurrentSite: (site: Site) => void;
  selectedRegionId: string | null;
  setSelectedRegionId: (id: string | null) => void;
  isAllSitesMode: boolean;
  isRegionalCoordinator: boolean;
  roles: Role[];
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  loading: boolean;
  error: string|null;
  refresh: () => Promise<void>;
  rolesBySite: Record<string, Role[]>;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<{
    owner: string | null;
    sites: Site[];
    regions: Region[];
    selected: Site | null;
    selectedRegionId: string | null;
    roles: Record<string, Role[]>;
  }>({
    owner: null,
    sites: [],
    regions: [],
    selected: null,
    selectedRegionId: null,
    roles: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const owner = user?.id ?? null;
  const visible = state.owner === owner ? state : { owner, sites: [], regions: [], selected: null, selectedRegionId: null, roles: {} };

  const load = useCallback(async () => {
    const revision = ++generation.current;
    setLoading(true);
    setError(null);
    if (!owner) {
      setState({ owner: null, sites: [], regions: [], selected: null, selectedRegionId: null, roles: {} });
      setLoading(false);
      return;
    }
    const key = "wastebuddy:v2:sites:" + owner;
    try {
      let sites: Site[] = [];
      let regions: Region[] = [];
      const roles: Record<string, Role[]> = {};

      const readOffline = () => {
        const snapshot = localStorage.getItem(key);
        if (!snapshot) throw new Error("No offline facility snapshot. Connect once to load your facilities.");
        return (JSON.parse(snapshot) as { sites: Site[]; regions?: Region[] });
      };

      if (!navigator.onLine) {
        const snap = readOffline();
        sites = snap.sites;
        regions = snap.regions ?? [];
      } else {
        try {
          // Fetch sites for user
          const memberships = await readAll((from, to) =>
            supabase.from("user_sites").select("site_id,sites(id,name,location)").eq("user_id", owner).order("id").range(from, to)
          );
          sites = memberships.flatMap((m) => (m.sites ? [m.sites] : []));

          // Fetch roles
          const rows = await readAll((from, to) =>
            supabase.from("user_roles").select("site_id,role").eq("user_id", owner).order("id").range(from, to)
          );
          for (const row of rows) {
            if (sites.some((s) => s.id === row.site_id)) {
              roles[row.site_id] = [...(roles[row.site_id] ?? []), row.role];
            }
          }

          // Optional: Fetch regions with graceful fallback if table not yet created
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: regionsData } = await (supabase.from as any)("regions").select("*").order("name");
            if (regionsData && Array.isArray(regionsData)) {
              regions = regionsData as unknown as Region[];
            }
          } catch {
            // regions table not yet created on remote instance; fallback gracefully
            regions = [];
          }

          // If regions not populated from table, automatically infer common clusters from site locations
          if (regions.length === 0 && sites.length > 0) {
            const stateSet = new Set<string>();
            sites.forEach((s) => {
              if (s.location && s.location.includes(",")) {
                const parts = s.location.split(",");
                const statePart = parts[parts.length - 1].trim();
                if (statePart) stateSet.add(statePart);
              }
            });
            regions = Array.from(stateSet).map((st, i) => ({
              id: "inferred-" + i,
              name: st + " Regional Zone",
              state: st,
              code: st.slice(0, 3).toUpperCase(),
            }));
          }

          try {
            localStorage.setItem(key, JSON.stringify({ sites, regions }));
          } catch {
            /* Snapshot write failure non-fatal */
          }
        } catch (fetchErr) {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("wastebuddy:network-offline"));
          try {
            const snap = readOffline();
            sites = snap.sites;
            regions = snap.regions ?? [];
          } catch {
            throw fetchErr;
          }
        }
      }

      if (revision !== generation.current) return;

      const selected = localStorage.getItem("hazwaste-current-site:" + owner) ?? localStorage.getItem("hazwaste-current-site");
      setState({
        owner,
        sites,
        regions,
        roles,
        selectedRegionId: null,
        selected: selected === ALL_SITES_ID && sites.length > 1
          ? ALL_SITES_OBJECT
          : sites.find((s) => s.id === selected) ?? sites[0] ?? null,
      });
    } catch (e) {
      if (revision === generation.current) {
        setError(errorMessage(e));
        setState({ owner, sites: [], regions: [], selected: null, selectedRegionId: null, roles: {} });
      }
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
    const online = () => { void load(); };
    window.addEventListener("online", online);
    return () => {
      generation.current++;
      window.removeEventListener("online", online);
    };
  }, [load]);

  const setCurrentSite = (site: Site) => {
    if (site.id !== ALL_SITES_ID && !visible.sites.some((s) => s.id === site.id)) return;
    setState((prev) => ({ ...prev, selected: site }));
    try {
      localStorage.setItem("hazwaste-current-site:" + owner, site.id);
    } catch {
      /* in-memory */
    }
  };

  const setSelectedRegionId = (regionId: string | null) => {
    setState((prev) => ({ ...prev, selectedRegionId: regionId }));
  };

  const all = visible.selected?.id === ALL_SITES_ID;
  const roles: Role[] = all
    ? [...new Set(Object.values(visible.roles).flat())]
    : visible.roles[visible.selected?.id ?? ""] ?? [];

  const isAdmin = roles.includes("admin");
  const isManagerOrAdmin = roles.includes("admin") || roles.includes("manager");

  // Regional Coordinator: has manager or admin rights across > 1 facility
  const isRegionalCoordinator = useMemo(() => {
    if (isAdmin) return true;
    const managedSites = Object.entries(visible.roles).filter(
      ([, siteRoles]) => siteRoles.includes("manager") || siteRoles.includes("admin")
    );
    return managedSites.length > 1 || visible.sites.length > 1;
  }, [isAdmin, visible.roles, visible.sites.length]);

  return (
    <SiteContext.Provider
      value={{
        sites: visible.sites,
        regions: visible.regions,
        currentSite: visible.selected,
        setCurrentSite,
        selectedRegionId: visible.selectedRegionId,
        setSelectedRegionId,
        isAllSitesMode: all,
        isRegionalCoordinator,
        roles,
        isAdmin,
        isManagerOrAdmin,
        loading,
        error,
        refresh: load,
        rolesBySite: visible.roles,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}
