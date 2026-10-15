import { serve, body, z } from "../_shared/request.ts";
const schema=z.object({batch_id:z.string().uuid(),site_id:z.string().uuid(),
 action:z.enum(["approve","reject"]),reason:z.string().max(5000).optional()});
serve(async(req,client)=>{
 const input=schema.parse(await body(req));
 const {error}=await client.rpc("decide_disposal",{
  p_batch_id:input.batch_id,p_site_id:input.site_id,p_action:input.action,p_reason:input.reason ?? null
 });
 if(error) throw new Error(error.message);
 return {ok:true};
});
