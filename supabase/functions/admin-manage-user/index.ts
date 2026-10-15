import { serve, body, serviceClient, z } from "../_shared/request.ts";
const schema=z.object({
 action:z.enum(["create_user","invite","assign","revoke_role","remove_from_site","approve_request","reject_request"]),
 site_id:z.string().uuid(), user_id:z.string().uuid().optional(), request_id:z.string().uuid().optional(),
 role:z.enum(["admin","manager","member"]).default("member"),
 email:z.string().email().max(254).optional(), password:z.string().min(12).max(256).optional(),
 full_name:z.string().trim().max(200).optional(), note:z.string().max(5000).optional(),
});
serve(async (req,client)=>{
 const input=schema.parse(await body(req));
 const {data:identity,error:identityError}=await client.auth.getUser();
 if(identityError || !identity.user) throw new Error("Unauthorized");
 const {data:allowed,error:roleError}=await client.rpc("has_site_role",{
  _user_id:identity.user.id,_site_id:input.site_id,_role:"admin"
 });
 if(roleError || !allowed) throw new Error("Site administrator required");
 let target=input.user_id;
 if(input.action==="create_user" || input.action==="invite"){
  if(!input.email || input.role==="admin") throw new Error("Email and a non-administrator role are required");
  const admin=serviceClient();
  const email=input.email.trim().toLowerCase();
  // Auth, not editable profiles, is the identity authority. Never reset an existing password.
  if(input.action==="create_user"){
   if(!input.password || !/[A-Z]/.test(input.password)||!/[a-z]/.test(input.password)||!/[0-9]/.test(input.password))
    throw new Error("Use at least 12 characters including uppercase, lowercase and a number");
   const {data,error}=await admin.auth.admin.createUser({
    email,password:input.password,email_confirm:true,user_metadata:{full_name:input.full_name ?? email}
   });
   if(error || !data.user) throw new Error(error?.message ?? "Account creation failed");
   target=data.user.id;
  } else {
   const redirect=(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")[0].trim()+"/reset-password";
   const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{
    redirectTo:redirect,data:{full_name:input.full_name ?? email}
   });
   if(error || !data.user) throw new Error(error?.message ?? "Invitation failed");
   target=data.user.id;
  }
 }
 const {error}=await client.rpc("manage_site_access",{
  p_action:["create_user","invite"].includes(input.action)?"assign":input.action,
  p_site_id:input.site_id,p_user_id:target ?? null,p_role:input.role,
  p_request_id:input.request_id ?? null,p_note:input.note ?? null,
 });
 // Auth and SQL are separate services. Retain the account on SQL failure; report a recoverable
 // provisioning failure rather than deleting an account or changing its password on retry.
 if(error) throw new Error(target && ["create_user","invite"].includes(input.action)
  ? `Account exists but site assignment failed. Assign user ${target} to this site: ${error.message}`
  : error.message);
 return {ok:true,user_id:target};
});
