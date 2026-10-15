import { serviceClient } from "../_shared/request.ts";
// Invoke on a server scheduler with a dedicated random secret, never from the PWA.
Deno.serve(async req=>{
 const secret=Deno.env.get("PHOTO_CLEANUP_SECRET");
 if(req.method!=="POST" || !secret || req.headers.get("authorization")!=="Bearer "+secret)
  return new Response("Unauthorized",{status:401});
 const admin=serviceClient();
 const {data,error}=await admin.from("photo_cleanup_jobs").select("*").order("created_at").limit(100);
 if(error) return new Response("Unable to load cleanup jobs",{status:500});
 let completed=0;
 for(const job of data ?? []){
  const {error:removeError}=await admin.storage.from("waste-photos").remove([job.storage_path]);
  if(removeError){
   await admin.from("photo_cleanup_jobs").update({attempts:job.attempts+1,last_error:removeError.message}).eq("id",job.id);
  }else{
   const {error:ackError}=await admin.from("photo_cleanup_jobs").delete().eq("id",job.id);
   if(!ackError) completed++;
  }
 }
 return Response.json({completed});
});
