import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadTeam } from "@/lib/adminData";
import { readAll } from "@/lib/pagination";
import { toast } from "sonner";
import { errorMessage } from "@/lib/validation";
export function useSites(){
 const {user}=useAuth();
 return useQuery({queryKey:["sites",user?.id],enabled:!!user,queryFn:()=>readAll((from,to)=>supabase.from("sites").select("id,name,location").order("name").order("id").range(from,to))});
}
export function useMembers(siteId:string){
 const {user}=useAuth();
 return useQuery({queryKey:["members",user?.id,siteId],enabled:!!user&&!!siteId&&siteId!=="ALL_SITES",queryFn:async()=>(await loadTeam(siteId)).members});
}
export function useRequests(siteId:string){
 const {user}=useAuth();
 return useQuery({queryKey:["requests",user?.id,siteId],enabled:!!user&&!!siteId&&siteId!=="ALL_SITES",
 queryFn:()=>readAll((from,to)=>supabase.from("site_access_requests").select("*").eq("site_id",siteId).order("created_at",{ascending:false}).order("id").range(from,to))});
}
export function useAuditLog(siteId:string,page=0){
 const {user}=useAuth();
 return useQuery({queryKey:["audit_log",user?.id,siteId,page],enabled:!!user&&!!siteId&&siteId!=="ALL_SITES",queryFn:async()=>{
  const {data,error}=await supabase.from("audit_log").select("*").eq("site_id",siteId).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99);
  if(error) throw new Error(error.message);return data;
 }});
}
export function useCreateSite(){
 const qc=useQueryClient();
 return useMutation({mutationFn:async(name:string)=>{
  const {data,error}=await supabase.from("sites").insert({name:name.trim()}).select().single();
  if(error) throw new Error(error.message);return data;
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:["sites"]});toast.success("Site created");},onError:error=>toast.error(errorMessage(error))});
}
function useDecideRequest(action:"approve_request"|"reject_request"){
 const qc=useQueryClient();
 return useMutation({mutationFn:async({requestId,siteId}:{requestId:string;siteId:string})=>{
  const {error}=await supabase.rpc("manage_site_access",{p_action:action,p_site_id:siteId,p_request_id:requestId,p_role:"member"});
  if(error) throw new Error(error.message);
 },onSuccess:()=>{for(const key of ["requests","members","audit_log"]) void qc.invalidateQueries({queryKey:[key]});},
 onError:error=>toast.error(errorMessage(error))});
}
export function useApproveRequest(){return useDecideRequest("approve_request");}
export function useRejectRequest(){return useDecideRequest("reject_request");}
