import { supabase } from "@/integrations/supabase/client";
import { readAll } from "./pagination";
import type { Member, ProfileRow, AccessRequestRow } from "@/types";

export type DisplayRequest = AccessRequestRow & { profile?: Pick<ProfileRow, "email" | "full_name"> };

export async function loadTeam(siteId: string) {
  const [memberships, roles, requests] = await Promise.all([
    readAll((from, to) => supabase.from("user_sites").select("user_id").eq("site_id", siteId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("user_roles").select("user_id,role").eq("site_id", siteId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("site_access_requests").select("*").eq("site_id", siteId).eq("status", "pending").order("id").range(from, to)),
  ]);

  const ids = [...new Set([...memberships.map((m) => m.user_id), ...requests.map((r) => r.user_id)])];
  const profiles = new Map<string, Pick<ProfileRow, "email" | "full_name">>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const rows = await readAll((from, to) =>
      supabase.from("profiles").select("id,email,full_name").in("id", chunk).order("id").range(from, to)
    );
    for (const row of rows) profiles.set(row.id, row);
  }

  // Cross-site metadata for regional coordinator detection
  const multiSiteRoles = new Map<string, Set<string>>();
  const multiSiteManagers = new Map<string, Set<string>>();

  if (ids.length > 0) {
    try {
      const allUserRoles = await readAll((from, to) =>
        supabase.from("user_roles").select("user_id,site_id,role").in("user_id", ids.slice(0, 100)).order("id").range(from, to)
      );
      for (const ur of allUserRoles) {
        if (!multiSiteRoles.has(ur.user_id)) multiSiteRoles.set(ur.user_id, new Set());
        multiSiteRoles.get(ur.user_id)!.add(ur.site_id);

        if (ur.role === "manager" || ur.role === "admin") {
          if (!multiSiteManagers.has(ur.user_id)) multiSiteManagers.set(ur.user_id, new Set());
          multiSiteManagers.get(ur.user_id)!.add(ur.site_id);
        }
      }
    } catch {
      // Graceful fallback if cross-site roles query fails
    }
  }

  const members: Member[] = memberships.map((m) => {
    const siteRoles = roles.filter((r) => r.user_id === m.user_id).map((r) => r.role);
    const totalSites = multiSiteRoles.get(m.user_id)?.size ?? 1;
    const managerSites = multiSiteManagers.get(m.user_id)?.size ?? 0;
    const isRegional = managerSites > 1 || (totalSites > 1 && siteRoles.some((r) => r === "manager" || r === "admin"));

    return {
      user_id: m.user_id,
      email: profiles.get(m.user_id)?.email ?? null,
      full_name: profiles.get(m.user_id)?.full_name ?? null,
      roles: siteRoles,
      is_regional_coordinator: isRegional,
      site_count: totalSites,
    };
  });

  return {
    members,
    requests: requests.map((r) => ({ ...r, profile: profiles.get(r.user_id) })) as DisplayRequest[],
  };
}
