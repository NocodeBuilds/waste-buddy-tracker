import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Site, Role } from "@/types";
import { errorMessage } from "@/lib/validation";
import { readAll } from "@/lib/pagination";
export const ALL_SITES_ID="ALL_SITES";
export const ALL_SITES_OBJECT:Site={id:ALL_SITES_ID,name:"All Facilities (Regional)",location:"Multi-Site Regional View"};
interface SiteContextValue {
 sites:Site[];currentSite:Site|null;setCurrentSite:(site:Site)=>void;isAllSitesMode:boolean;roles:Role[];
 isAdmin:boolean;isManagerOrAdmin:boolean;loading:boolean;error:string|null;refresh:()=>Promise<void>;
 rolesBySite:Record<string,Role[]>;
}
const SiteContext=createContext<SiteContextValue|undefined>(undefined);
export function SiteProvider({children}:{children:ReactNode}){
 const {user}=useAuth();
 const [state,setState]=useState<{owner:string|null;sites:Site[];selected:Site|null;roles:Record<string,Role[]>}>({owner:null,sites:[],selected:null,roles:{}});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null);
 const generation=useRef(0);
 const owner=user?.id ?? null;
 const visible=state.owner===owner ? state : {owner,sites:[],selected:null,roles:{}};
 const load=useCallback(async()=>{
  const revision=++generation.current;
  setLoading(true);setError(null);
  if(!owner){setState({owner:null,sites:[],selected:null,roles:{}});setLoading(false);return;}
  const key="wastebuddy:v2:sites:"+owner;
  try{
   let sites:Site[]; const roles:Record<string,Role[]>={};
   if(!navigator.onLine){
    const snapshot=localStorage.getItem(key);
    if(!snapshot) throw new Error("No offline facility snapshot. Connect once to load your facilities.");
    sites=(JSON.parse(snapshot) as {sites:Site[]}).sites;
    // Offline role snapshots never grant governance privileges.
   }else{
    const memberships=await readAll((from,to)=>supabase.from("user_sites").select("site_id,sites(id,name,location,archived_at)").eq("user_id",owner).order("id").range(from,to));
    sites=memberships.flatMap(m=>m.sites && !m.sites.archived_at ? [m.sites] : []);
    const rows=await readAll((from,to)=>supabase.from("user_roles").select("site_id,role").eq("user_id",owner).order("id").range(from,to));
    for(const row of rows) if(sites.some(s=>s.id===row.site_id)) roles[row.site_id]=[...(roles[row.site_id] ?? []),row.role];
    try{localStorage.setItem(key,JSON.stringify({sites}));}catch{/* Offline snapshots are optional; writes are not. */}
   }
   if(revision!==generation.current) return;
   const selected=localStorage.getItem("hazwaste-current-site:"+owner) ?? localStorage.getItem("hazwaste-current-site");
   setState({owner,sites,roles,selected:selected===ALL_SITES_ID && sites.length>1 ? ALL_SITES_OBJECT : sites.find(s=>s.id===selected) ?? sites[0] ?? null});
  }catch(e){if(revision===generation.current){setError(errorMessage(e));setState({owner,sites:[],selected:null,roles:{}});}}
  finally{if(revision===generation.current) setLoading(false);}
 },[owner]);
 useEffect(()=>{void load();const online=()=>{void load();};window.addEventListener("online",online);return ()=>{generation.current++;window.removeEventListener("online",online);};},[load]);
 const setCurrentSite=(site:Site)=>{
  if(site.id!==ALL_SITES_ID && !visible.sites.some(s=>s.id===site.id)) return;
  setState(prev=>({...prev,selected:site}));
  try{localStorage.setItem("hazwaste-current-site:"+owner,site.id);}catch{/* Selection remains in memory. */}
 };
 const all=visible.selected?.id===ALL_SITES_ID;
 const roles:Role[]=all ? [...new Set(Object.values(visible.roles).flat())] : visible.roles[visible.selected?.id ?? ""] ?? [];
 return <SiteContext.Provider value={{sites:visible.sites,currentSite:visible.selected,setCurrentSite,isAllSitesMode:all,roles,
  isAdmin:roles.includes("admin"),isManagerOrAdmin:roles.includes("admin")||roles.includes("manager"),
  loading,error,refresh:load,rolesBySite:visible.roles}}>{children}</SiteContext.Provider>;
}
export function useSite(){const ctx=useContext(SiteContext);if(!ctx) throw new Error("useSite must be used within SiteProvider");return ctx;}
