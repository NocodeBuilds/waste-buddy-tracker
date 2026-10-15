import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { entrySchema, errorMessage, validatePhotos } from "./validation";
import { compressImages } from "./imageCompress";

const LEGACY_KEY="wastebuddy_offline_pending_entries";
const EVENT="wastebuddy:outbox";
export interface PendingEntry {
 tempId:string; siteId:string; userId:string; timestamp:number;
 data:{waste_type_id:string;waste_category:"hazardous"|"non_hazardous"|"e_waste"|"other_wastes";weight_kg:number;
 piece_count?:number|null;generated_date:string;activity_type:"breakdown"|"preventive"|"5s"|"others";location?:string|null;notes?:string|null};
 photos?:{id:string;file:Blob;path:string}[];
 error?:string;
}
let dbPromise:Promise<IDBDatabase>|undefined;
function database(){
 return dbPromise ??= new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open("wastebuddy-outbox",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("entries",{keyPath:"tempId"});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{dbPromise=undefined;reject(new Error("Offline storage is unavailable. Your entry has not been saved."));};
 });
}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 return new Promise<T>((resolve,reject)=>{
  const tx=db.transaction("entries",mode);
  const request=action(tx.objectStore("entries"));
  tx.oncomplete=()=>{if(mode==="readwrite") window.dispatchEvent(new Event(EVENT));resolve(request.result);};
  tx.onabort=()=>reject(tx.error ?? new Error("Unable to save. Device storage may be full."));
  tx.onerror=()=>reject(tx.error ?? new Error("Offline storage failed"));
 });
}
let migrating:Promise<void>|undefined;
async function migrateLegacy(){
 if(!migrating) migrating=(async()=>{
  const raw=localStorage.getItem(LEGACY_KEY);
  if(!raw) return;
  const items=JSON.parse(raw) as PendingEntry[];
  if(!Array.isArray(items)) throw new Error("Legacy offline queue is invalid; keep a backup before repairing it.");
  for(const item of items){
   const existing=await transaction("readonly",s=>s.get(item.tempId));
   if(!existing) await transaction("readwrite",s=>s.put(item));
  }
  localStorage.removeItem(LEGACY_KEY);
 })().catch(error=>{migrating=undefined;throw error;});
 return migrating;
}
export async function getPendingQueue(userId?:string):Promise<PendingEntry[]>{
 await migrateLegacy();
 const items=await transaction<PendingEntry[]>("readonly",s=>s.getAll());
 return items.filter(item=>!userId||item.userId===userId).sort((a,b)=>a.timestamp-b.timestamp);
}
export async function saveToPendingQueue(entry:PendingEntry){
 await migrateLegacy();
 await transaction("readwrite",s=>s.put(entry));
}
export async function removeFromPendingQueue(id:string){await transaction("readwrite",s=>s.delete(id));}
export async function clearPendingQueue(){await transaction("readwrite",s=>s.clear());}
export async function createPendingEntry(siteId:string,userId:string,data:PendingEntry["data"],photos:File[]=[],id:string=crypto.randomUUID()):Promise<PendingEntry>{
 const parsed=entrySchema.parse(data);
 validatePhotos(photos);
 const compressed=await compressImages(photos);
 return {tempId:id,siteId,userId,timestamp:Date.now(),data:parsed,
  photos:compressed.map(file=>{const photoId=crypto.randomUUID();return {id:photoId,file,path:siteId+"/"+id+"/"+photoId};})};
}
export async function uploadPendingEntry(item:PendingEntry){
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError || user?.id!==item.userId) throw new Error("Sign in as the entry owner to sync this draft");
 entrySchema.parse(item.data);
 const payload={...item.data,id:item.tempId,site_id:item.siteId,created_by:item.userId,quantity:item.data.weight_kg,expected_photo_count:item.photos?.length ?? 0};
 const {error}=await supabase.from("waste_entries").insert(payload);
 if(error){
  if(error.code!=="23505") throw new Error(error.message);
  const {data:existing,error:readError}=await supabase.from("waste_entries").select("*").eq("id",item.tempId).single();
  if(readError || !existing || existing.site_id!==item.siteId || existing.created_by!==item.userId)
   throw new Error("Unable to verify the previously saved entry");
  for(const [key,value] of Object.entries(item.data)){
   if((existing[key as keyof typeof existing] ?? null)!==(value ?? null)) throw new Error("Saved entry differs from this draft; review it before retrying");
  }
 }
 for(const photo of item.photos ?? []){
  const {data:record,error:lookupError}=await supabase.from("waste_entry_photos").select("storage_path,waste_entry_id,site_id").eq("id",photo.id).maybeSingle();
  if(lookupError) throw new Error(lookupError.message);
  if(record){
   if(record.storage_path!==photo.path||record.waste_entry_id!==item.tempId||record.site_id!==item.siteId) throw new Error("Photo identity conflict");
   continue;
  }
  const {error:uploadError}=await supabase.storage.from("waste-photos").upload(photo.path,photo.file,{contentType:photo.file.type,upsert:false});
  if(uploadError && !["409","400"].includes(String(uploadError.statusCode))) throw new Error(uploadError.message);
  if(uploadError){
   const {error:verifyError}=await supabase.storage.from("waste-photos").createSignedUrl(photo.path,60);
   if(verifyError) throw new Error(uploadError.message);
  }
  const {error:rowError}=await supabase.from("waste_entry_photos").insert({
   id:photo.id,waste_entry_id:item.tempId,site_id:item.siteId,storage_path:photo.path,uploaded_by:item.userId,
  });
  if(rowError && rowError.code!=="23505") throw new Error(rowError.message);
 }
 await removeFromPendingQueue(item.tempId);
}
let syncing:Promise<number>|undefined;
export async function syncPendingEntries(queryClient?:QueryClient):Promise<number>{
 if(!navigator.onLine) return 0;
 if(syncing) return syncing;
 const run=async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return 0;
  let count=0;
  for(const item of await getPendingQueue(user.id)){
   try {await uploadPendingEntry(item);count++;}
   catch(error){await saveToPendingQueue({...item,error:errorMessage(error)});}
  }
  if(count) toast.success("Synced "+count+" saved entries");
  await queryClient?.invalidateQueries({queryKey:["waste_entries"]});
  await queryClient?.invalidateQueries({queryKey:["waste_entry_photos"]});
  await queryClient?.invalidateQueries({queryKey:["waste_entry_photo_counts"]});
  return count;
 };
 syncing=Promise.resolve(navigator.locks ? navigator.locks.request("wastebuddy-outbox-sync",run) : run()).then(value => value).finally(()=>{syncing=undefined;});
 return syncing!;
}
export function useOnlineStatus(){
 const {user}=useAuth();
 const qc=useQueryClient();
 const [isOnline,setIsOnline]=useState(navigator.onLine);
 const [pendingCount,setPendingCount]=useState(0);
 const [pendingError,setPendingError]=useState<string|null>(null);
 const refreshPending=useCallback(async()=>{
  if(!user){setPendingCount(0);setPendingError(null);return;}
  try{const items=await getPendingQueue(user.id);setPendingCount(items.length);setPendingError(items.find(i=>i.error)?.error ?? null);}
  catch(error){setPendingError(errorMessage(error));}
 },[user?.id]);
 useEffect(()=>{
  const online=()=>{setIsOnline(true);void syncPendingEntries(qc).then(refreshPending).catch(error=>setPendingError(errorMessage(error)));};
  const offline=()=>setIsOnline(false);
  const changed=()=>{void refreshPending();};
  window.addEventListener("online",online);window.addEventListener("offline",offline);window.addEventListener(EVENT,changed);
  void refreshPending();
  if(user && navigator.onLine) online();
  return ()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);window.removeEventListener(EVENT,changed);};
 },[user?.id,qc,refreshPending]);
 return {isOnline,pendingCount,pendingError,syncNow:async()=>{await syncPendingEntries(qc);await refreshPending();}};
}
