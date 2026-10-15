import { useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WasteEntry, DisposalBatch } from "@/lib/wasteTypes";
import { useSite, ALL_SITES_ID } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createPendingEntry, getPendingQueue, saveToPendingQueue, uploadPendingEntry } from "@/lib/offlineSync";
import { entrySchema, errorMessage } from "@/lib/validation";
import { readAll } from "@/lib/pagination";

export type NewEntryInput = {
 operationId?:string;waste_type_id:string;waste_category:WasteEntry["waste_category"];weight_kg:number;
 piece_count?:number|null;generated_date:string;activity_type:WasteEntry["activity_type"];
 location?:string|null;notes?:string|null;photos?:File[];siteId?:string;
};
type UpdateEntryInput={id:string;siteId:string;updates:Partial<Pick<WasteEntry,"waste_type_id"|"waste_category"|"weight_kg"|"piece_count"|"generated_date"|"activity_type"|"location"|"notes">>};
type CreateDisposalInput={operationId?:string;disposed_date:string;notes?:string;siteId:string;entry_ids?:string[]};

async function snapshot<T>(key:string,fetch:()=>Promise<T>):Promise<T>{
 const readSnapshot = () => {
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error("No offline snapshot for this facility. Connect to load its records.");
  return JSON.parse(raw) as T;
 };
 if (!navigator.onLine) {
  return readSnapshot();
 }
 try {
  const data = await fetch();
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* Read snapshots may be omitted when storage is full. */ }
  return data;
 } catch (error) {
  if (typeof window !== "undefined") {
   window.dispatchEvent(new Event("wastebuddy:network-offline"));
  }
  try {
   return readSnapshot();
  } catch {
   throw error;
  }
 }
}
export function useWasteEntries(){
 const {currentSite,sites,isAllSitesMode}=useSite();
 const {user}=useAuth();
 const qc=useQueryClient();
 const siteIds=useMemo(()=>isAllSitesMode?sites.map(s=>s.id).sort():currentSite&&currentSite.id!==ALL_SITES_ID?[currentSite.id]:[],[isAllSitesMode,sites,currentSite]);
 const scope=siteIds.join(",");
 const identity=useRef({user,site:currentSite?.id});
 identity.current={user,site:currentSite?.id};
 const batchesQuery=useQuery({
  queryKey:["disposal_batches",user?.id,scope],enabled:!!user&&siteIds.length>0,staleTime:60000,
  queryFn:()=>snapshot<DisposalBatch[]>("wastebuddy:v2:batches:"+user!.id+":"+scope,()=>readAll((from,to)=>supabase
   .from("disposal_batches").select("*").in("site_id",siteIds).order("disposed_date",{ascending:false}).order("id").range(from,to))),
 });
 const entriesQuery=useQuery({
  queryKey:["waste_entries",user?.id,scope],enabled:!!user&&siteIds.length>0,staleTime:60000,
  queryFn:async():Promise<WasteEntry[]>=>{
   const rows=await snapshot<WasteEntry[]>("wastebuddy:v2:entries:"+user!.id+":"+scope,()=>readAll((from,to)=>supabase
    .from("waste_entries").select("*").in("site_id",siteIds).order("generated_date",{ascending:false}).order("id").range(from,to)));
   const pending=(await getPendingQueue(user!.id)).filter(p=>siteIds.includes(p.siteId));
   const ids=new Set(rows.map(e=>e.id));
   const pendingIds=new Set(pending.map(p=>p.tempId));
   return [...pending.filter(p=>!ids.has(p.tempId)).map(p=>({...p.data,id:p.tempId,site_id:p.siteId,created_by:p.userId,created_at:new Date(p.timestamp).toISOString(),sync_pending:true})),...rows.map(row=>({...row,sync_pending:pendingIds.has(row.id)}))];
  },
 });
 const invalidate=()=>{
  for(const key of ["waste_entries","disposal_batches","waste_entry_photos","waste_entry_photo_counts","audit_log"]) void qc.invalidateQueries({queryKey:[key]});
 };
 const onError=(error:unknown)=>toast.error(errorMessage(error));
 const addEntry=useMutation({
  mutationFn:async(entry:NewEntryInput)=>{
   const actor=identity.current.user;
   const site=entry.siteId ?? identity.current.site;
   if(!actor||!site||site===ALL_SITES_ID) throw new Error("Select a specific facility");
   const data=entrySchema.parse(entry);
   const id=entry.operationId ?? crypto.randomUUID();
   const existing=(await getPendingQueue(actor.id)).find(p=>p.tempId===id);
   const pending=existing ?? await createPendingEntry(site,actor.id,data,entry.photos,id);
   await saveToPendingQueue(pending); // No success until the entire draft, including blobs, is durable.
   if(navigator.onLine){
    try{await uploadPendingEntry(pending);}
    catch(error){await saveToPendingQueue({...pending,error:errorMessage(error)});toast.warning("Saved on this device; sync needs attention. "+errorMessage(error));}
   }else toast.info("Saved offline, including photos. Keep this device until sync completes.");
   return id;
  },onSuccess:invalidate,onError,
 });
 const updateEntry=useMutation({
  mutationFn:async({id,siteId,updates}:UpdateEntryInput)=>{
   const {data:old,error:readError}=await supabase.from("waste_entries").select("*").eq("id",id).eq("site_id",siteId).single();
   if(readError) throw new Error(readError.message);
   const data=entrySchema.parse({...old,...updates});
   const {data:changed,error}=await supabase.from("waste_entries").update({...data,quantity:data.weight_kg}).eq("id",id).eq("site_id",siteId).select("id").single();
   if(error||!changed) throw new Error(error?.message ?? "Entry was not updated");
  },onSuccess:()=>{invalidate();toast.success("Entry updated");},onError,
 });
 const deleteEntry=useMutation({
  mutationFn:async({id,siteId}:{id:string;siteId:string})=>{
   const {data,error}=await supabase.from("waste_entries").delete().eq("id",id).eq("site_id",siteId).select("id").single();
   if(error||!data) throw new Error(error?.message ?? "Entry was not deleted");
  },onSuccess:()=>{invalidate();toast.success("Entry deleted");},onError,
 });
 const createDisposalBatch=useMutation({
  mutationFn:async(input:CreateDisposalInput)=>{
   if(input.siteId===ALL_SITES_ID || !input.entry_ids?.length) throw new Error("Select entries from one facility");
   const {data,error}=await supabase.rpc("create_disposal_request",{
    p_id:input.operationId ?? crypto.randomUUID(),p_site_id:input.siteId,p_date:input.disposed_date,
    p_notes:input.notes ?? null,p_entry_ids:input.entry_ids,
   });
   if(error) throw new Error(error.message);return data;
  },onSuccess:()=>{invalidate();toast.success("Disposal request submitted for approval");},onError,
 });
 const approveDisposalBatch=useMutation({
  mutationFn:async(input:{batchId:string;siteId:string;action:"approve"|"reject";reason?:string})=>{
   const {error}=await supabase.rpc("decide_disposal",{p_batch_id:input.batchId,p_site_id:input.siteId,p_action:input.action,p_reason:input.reason ?? null});
   if(error) throw new Error(error.message);
  },onSuccess:()=>{invalidate();toast.success("Disposal decision saved");},onError,
 });
 const entries=useMemo(()=>{
  const status=new Map((batchesQuery.data ?? []).map(b=>[b.id,b.status]));
  return (entriesQuery.data ?? []).map(e=>({...e,disposal_status:e.disposal_batch_id ? status.get(e.disposal_batch_id) ?? "pending" : undefined}));
 },[entriesQuery.data,batchesQuery.data]);
 return {entries,batches:batchesQuery.data ?? [],error:entriesQuery.error ?? batchesQuery.error,
  isLoading:entriesQuery.isLoading||batchesQuery.isLoading,entriesIsLoading:entriesQuery.isLoading,batchesIsLoading:batchesQuery.isLoading,
  addEntry,updateEntry,deleteEntry,createDisposalBatch,approveDisposalBatch};
}
