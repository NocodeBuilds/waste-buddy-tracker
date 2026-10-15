import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import type { Database } from "../../../src/integrations/supabase/types.ts";
export { z } from "https://esm.sh/zod@3.25.76";

export function serve(handler: (req: Request, client: SupabaseClient<Database>) => Promise<unknown>) {
  Deno.serve(async req => {
    const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get("origin");
    const headers: Record<string,string> = {
      "Content-Type": "application/json", "Vary": "Origin", "Cache-Control": "no-store",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (origin && origins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
    const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), {status,headers});
    if (!origins.length) return reply({error:"Server origin configuration is missing"},503);
    if (origin && !origins.includes(origin)) return reply({error:"Origin not allowed"},403);
    if (req.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (req.method !== "POST") return reply({error:"POST required"},405);
    if (Number(req.headers.get("content-length") ?? 0)>65536) return reply({error:"Request too large"},413);
    const authorization=req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({error:"Unauthorized"},401);
    const client=createClient<Database>(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{
      global:{headers:{Authorization:authorization}}, auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data,error}=await client.auth.getUser();
    if (error || !data.user) return reply({error:"Unauthorized"},401);
    try { return reply(await handler(req,client),200); }
    catch (error) {
      const message=error instanceof Error ? error.message : "Operation failed";
      return reply({error:message},400);
    }
  });
}

export async function body(req: Request): Promise<unknown> {
  const text=await req.text();
  if (text.length>65536) throw new Error("Request too large");
  return JSON.parse(text);
}
export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
    auth:{persistSession:false,autoRefreshToken:false},
  });
}
