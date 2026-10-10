import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Site, Role } from "@/types";

export const ALL_SITES_ID = "ALL_SITES";
export const ALL_SITES_OBJECT: Site = {
  id: ALL_SITES_ID,
  name: "All Facilities (Regional)",
  location: "Multi-Site Regional View",
};

interface SiteContextValue {
  sites: Site[];
  currentSite: Site | null;
  setCurrentSite: (site: Site) => void;
  isAllSitesMode: boolean;
  roles: Role[]; // roles for the current site or across all sites
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);
const STORAGE_KEY = "hazwaste-current-site";

export function SiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [currentSite, setCurrentSiteState] = useState<Site | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const isAllSitesMode = currentSite?.id === ALL_SITES_ID;

  const loadSites = useCallback(async () => {
    if (!user) {
      setSites([]);
      setCurrentSiteState(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: memberships } = await supabase
      .from("user_sites")
      .select("site_id, sites(id, name, location)")
      .eq("user_id", user.id);
    const siteList: Site[] =
      memberships?.map((m: any) => m.sites).filter(Boolean) ?? [];
    setSites(siteList);

    // Restore preferred site
    const stored = localStorage.getItem(STORAGE_KEY);
    let restored: Site | null = null;
    if (stored === ALL_SITES_ID && siteList.length > 1) {
      restored = ALL_SITES_OBJECT;
    } else {
      restored = siteList.find((s) => s.id === stored) ?? siteList[0] ?? null;
    }
    setCurrentSiteState(restored);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Load roles for the current site (or all sites if in multi-site mode)
  useEffect(() => {
    if (!user) {
      setRoles([]);
      return;
    }

    // Try reading cached roles first to provide instant responsiveness
    const cacheKey = `wb_roles_${user.id}_${isAllSitesMode ? "all" : currentSite?.id ?? ""}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setRoles(JSON.parse(cached));
      }
    } catch {}

    if (isAllSitesMode) {
      const siteIds = sites.map((s) => s.id);
      if (siteIds.length === 0) {
        setRoles([]);
        return;
      }
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("site_id", siteIds)
        .then(({ data }: any) => {
          const loadedRoles = (data ?? []).map((r: any) => r.role as Role);
          setRoles(loadedRoles);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(loadedRoles)); } catch {}
        });
    } else if (currentSite) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("site_id", currentSite.id)
        .then(({ data }: any) => {
          const loadedRoles = (data ?? []).map((r: any) => r.role as Role);
          setRoles(loadedRoles);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(loadedRoles)); } catch {}
        });
    }
  }, [user, currentSite, isAllSitesMode, sites]);

  const setCurrentSite = (site: Site) => {
    setCurrentSiteState(site);
    localStorage.setItem(STORAGE_KEY, site.id);
  };

  const isAdmin = roles.includes("admin");
  const isManagerOrAdmin = isAdmin || roles.includes("manager");

  return (
    <SiteContext.Provider
      value={{
        sites,
        currentSite,
        setCurrentSite,
        isAllSitesMode,
        roles,
        isAdmin,
        isManagerOrAdmin,
        loading,
        refresh: loadSites,
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
