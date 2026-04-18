// One-time bootstrap: if Main Site has no admins, the caller becomes admin.
// Lets the first signed-up user gain access without needing pre-seeded credentials.
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find main site
    const { data: site } = await admin
      .from("sites")
      .select("id, name")
      .eq("name", "Main Site")
      .maybeSingle();
    if (!site) {
      return new Response(JSON.stringify({ error: "Main Site missing" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check for existing admins
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("site_id", site.id)
      .eq("role", "admin")
      .limit(1);

    if (admins && admins.length > 0) {
      return new Response(JSON.stringify({ error: "Already initialized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Make caller admin of Main Site
    await admin.from("user_sites").upsert(
      { user_id: user.id, site_id: site.id },
      { onConflict: "user_id,site_id" }
    );
    await admin.from("user_roles").upsert(
      { user_id: user.id, site_id: site.id, role: "admin" },
      { onConflict: "user_id,site_id,role" }
    );

    return new Response(JSON.stringify({ ok: true, site_id: site.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
