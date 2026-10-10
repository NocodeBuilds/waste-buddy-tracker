// One-time bootstrap: if no super-admin exists, the caller becomes super_admin.
// Creates a default "Main Site" if none exist. Grants admin only on the new/default site.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_REDIRECT = ALLOWED_ORIGINS[0] ?? "";

if (ALLOWED_ORIGINS.length === 0) {
  console.error("ALLOWED_ORIGINS env var is required. Set it to a comma-separated list of allowed origins.");
}

function buildCorsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (!reqOrigin || !ALLOWED_ORIGINS.includes(reqOrigin)) {
    return headers;
  }
  headers["Access-Control-Allow-Origin"] = reqOrigin;
  headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Reject requests when ALLOWED_ORIGINS is not configured
  if (ALLOWED_ORIGINS.length === 0) {
    return new Response(JSON.stringify({ error: "Server misconfigured: ALLOWED_ORIGINS not set" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // CORS preflight guard: block requests without a valid origin
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const user = { id: userData.user.id as string };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Use the admin_exists() helper to check if any admin exists anywhere
    const { data: anyAdmin } = await admin.rpc("admin_exists");
    if ((anyAdmin as boolean) === true) {
      return new Response(JSON.stringify({ error: "An admin already exists" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Create a default site if none exist
    let { data: sites, error: sErr } = await admin.from("sites").select("id, name");
    if (sErr || !sites || sites.length === 0) {
      const { data: newSite, error: nsErr } = await admin
        .from("sites")
        .insert({ name: "Main Site", location: "Default Location" })
        .select("id, name")
        .single();
      if (nsErr || !newSite) {
        return new Response(JSON.stringify({ error: "Could not create default site: " + nsErr?.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
      sites = [newSite];
    }

    // Grant admin role ONLY on the first/default site (not all sites)
    const targetSite = sites[0];
    await admin.from("user_sites").upsert(
      { user_id: user.id, site_id: targetSite.id },
      { onConflict: "user_id,site_id" }
    );
    await admin.from("user_roles").upsert(
      { user_id: user.id, site_id: targetSite.id, role: "admin" },
      { onConflict: "user_id,site_id,role" }
    );

    return new Response(JSON.stringify({ ok: true, site: targetSite.name }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
