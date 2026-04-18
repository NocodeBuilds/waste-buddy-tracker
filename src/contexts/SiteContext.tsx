import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Site {
  id: string;
  name: string;
  location: string | null;
}

export type Role = "admin" | "manager" | "member";

interface SiteContextValue {
  sites: Site[];
  currentSite: Site | null;
  setCurrentSite: (site: Site) => void;
  roles: Role[]; // roles for the current site
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
    const restored = siteList.find((s) => s.id === stored) ?? siteList[0] ?? null;
    setCurrentSiteState(restored);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Load roles for the current site
  useEffect(() => {
    if (!user || !currentSite) {
      setRoles([]);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("site_id", currentSite.id)
      .then(({ data }) => {
        setRoles((data ?? []).map((r: any) => r.role as Role));
      });
  }, [user, currentSite]);

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
