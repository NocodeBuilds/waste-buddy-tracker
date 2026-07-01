// One-time bootstrap: if no admin exists, the caller becomes admin of ALL sites.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = { id: claimsData.claims.sub as string };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Block if an admin already exists anywhere
    const { data: existing } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "An admin already exists" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch all sites
    const { data: sites, error: sErr } = await admin.from("sites").select("id");
    if (sErr || !sites || sites.length === 0) {
      return new Response(JSON.stringify({ error: "No sites configured" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userSites = sites.map((s) => ({ user_id: user.id, site_id: s.id }));
    const userRoles = sites.map((s) => ({ user_id: user.id, site_id: s.id, role: "admin" as const }));

    await admin.from("user_sites").upsert(userSites, { onConflict: "user_id,site_id" });
    await admin.from("user_roles").upsert(userRoles, { onConflict: "user_id,site_id,role" });

    return new Response(JSON.stringify({ ok: true, sites: sites.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
