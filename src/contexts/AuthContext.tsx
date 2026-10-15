import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextValue {session:Session|null;user:Session["user"]|null;loading:boolean;signOut:()=>Promise<void>;isAdmin:boolean;}
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
export function AuthProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const [isAdmin,setIsAdmin]=useState(false);
 const qc=useQueryClient();
 const previousUser=useRef<string|null>(null);
 useEffect(()=>{
  let active=true,revision=0;
  const apply=(next:Session|null)=>{
   if(!active) return;
   if(previousUser.current!== (next?.user.id ?? null)){
    void qc.cancelQueries();qc.clear();setIsAdmin(false);
    previousUser.current=next?.user.id ?? null;
   }
   setSession(next);setLoading(false);
  };
  const {data:subscription}=supabase.auth.onAuthStateChange((_event,next)=>{revision++;apply(next);});
  const initialRevision=revision;
  void supabase.auth.getSession().then(({data})=>{if(revision===initialRevision) apply(data.session);});
  return ()=>{active=false;subscription.subscription.unsubscribe();};
 },[qc]);
 useEffect(()=>{
  let active=true;
  setIsAdmin(false);
  if(session?.user.id) void supabase.from("user_roles").select("role").eq("user_id",session.user.id).eq("role","admin")
   .then(({data,error})=>{if(active) setIsAdmin(!error && !!data?.length);});
  return ()=>{active=false;};
 },[session?.user.id]);
 const signOut=async()=>{
  const {error}=await supabase.auth.signOut();
  if(error) throw error;
  void qc.cancelQueries();qc.clear();
  // Preserve the owner-scoped outbox, including photos. Remove obsolete unscoped snapshots only.
  for(const key of Object.keys(localStorage)){
   if(key.startsWith("wastebuddy:v2:")||key.startsWith("wastebuddy_entries_")||key.startsWith("wastebuddy_batches_")) localStorage.removeItem(key);
  }
  for(const key of Object.keys(sessionStorage)) if(key.startsWith("wb_roles_")) sessionStorage.removeItem(key);
  // Never delete the app shell/precache: a signed-out installation must still start offline.
  if("caches" in window) for(const key of await caches.keys()) if(key.startsWith("signed-photos-")) await caches.delete(key);
 };
 return <AuthContext.Provider value={{session,user:session?.user ?? null,loading,signOut,isAdmin}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const ctx=useContext(AuthContext);if(!ctx) throw new Error("useAuth must be used within AuthProvider");return ctx;}
