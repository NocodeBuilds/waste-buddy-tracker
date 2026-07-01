// Invite a user to a site with a given role. Admin-only.
// Uses the SUPABASE service role to invite + create user_sites + user_roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  email: string;
  site_id: string;
  role: "admin" | "manager" | "member";
}

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
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = { id: claimsData.claims.sub as string };

    const body = (await req.json()) as Body;
    if (!body.email || !body.site_id || !body.role) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service role client for admin ops
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify caller is admin of the site
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("site_id", body.site_id);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Only site admins can invite" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check whether the user already exists
    let userId: string | null = null;
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", body.email.toLowerCase())
      .maybeSingle();

    if (existing) {
      userId = existing.id;
    } else {
      // Invite by email (sends invite email + creates auth user)
      const redirectTo = `${req.headers.get("origin") ?? ""}/reset-password`;
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(body.email, {
        redirectTo,
      });
      if (invErr || !inv.user) {
        return new Response(JSON.stringify({ error: invErr?.message ?? "Invite failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = inv.user.id;
    }

    // Link to site
    await admin.from("user_sites").upsert(
      { user_id: userId, site_id: body.site_id },
      { onConflict: "user_id,site_id" }
    );

    // Assign role
    await admin.from("user_roles").upsert(
      { user_id: userId, site_id: body.site_id, role: body.role },
      { onConflict: "user_id,site_id,role" }
    );

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
