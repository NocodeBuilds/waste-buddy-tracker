import { supabase } from "@/integrations/supabase/client";
import { readAll } from "./pagination";
import type { Member, ProfileRow, AccessRequestRow } from "@/types";
export type DisplayRequest = AccessRequestRow & { profile?: Pick<ProfileRow, "email" | "full_name"> };
export async function loadTeam(siteId: string) {
  const [memberships, roles, requests] = await Promise.all([
    readAll((from,to)=>supabase.from("user_sites").select("user_id").eq("site_id",siteId).order("id").range(from,to)),
    readAll((from,to)=>supabase.from("user_roles").select("user_id,role").eq("site_id",siteId).order("id").range(from,to)),
    readAll((from,to)=>supabase.from("site_access_requests").select("*").eq("site_id",siteId).eq("status","pending").order("id").range(from,to)),
  ]);
  const ids = [...new Set([...memberships.map(m=>m.user_id),...requests.map(r=>r.user_id)])];
  const profiles = new Map<string, Pick<ProfileRow,"email"|"full_name">>();
  for(let i=0;i<ids.length;i+=100){
    const rows=await readAll((from,to)=>supabase.from("profiles").select("id,email,full_name").in("id",ids.slice(i,i+100)).order("id").range(from,to));
    for(const row of rows) profiles.set(row.id,row);
  }
  const members:Member[]=memberships.map(m=>({user_id:m.user_id,email:profiles.get(m.user_id)?.email ?? null,
    full_name:profiles.get(m.user_id)?.full_name ?? null,roles:roles.filter(r=>r.user_id===m.user_id).map(r=>r.role)}));
  return {members,requests:requests.map(r=>({...r,profile:profiles.get(r.user_id)})) as DisplayRequest[]};
}
