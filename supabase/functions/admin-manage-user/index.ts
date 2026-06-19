// Admin-only: create/invite a user, assign site + role, or revoke.
// Requires the caller to be admin on the target site.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { action: "invite"; email: string; site_id: string; role: "admin" | "manager" | "member"; full_name?: string }
  | { action: "assign"; user_id: string; site_id: string; role: "admin" | "manager" | "member" }
  | { action: "revoke_role"; user_id: string; site_id: string; role: "admin" | "manager" | "member" }
  | { action: "remove_from_site"; user_id: string; site_id: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = (await req.json()) as Action;
    if (!body || !("action" in body)) return json({ error: "Invalid payload" }, 400);

    const site_id = (body as any).site_id as string;
    if (!site_id) return json({ error: "site_id required" }, 400);

    // Verify caller is admin of target site
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("site_id", site_id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Forbidden — not an admin of this site" }, 403);

    if (body.action === "invite") {
      const email = body.email.trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "Invalid email" }, 400);

      // Find existing user by email
      let targetId: string | null = null;
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        targetId = existing.id;
        // Existing user — send password reset link so they can update if needed
        await admin.auth.admin.generateLink({ type: "recovery", email });
      } else {
        // Send invite email — user clicks link and sets their own password
        const redirectTo = `${req.headers.get("origin") ?? ""}/reset-password`;
        const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { full_name: body.full_name ?? email },
        });
        if (invErr || !inv.user) return json({ error: invErr?.message ?? "Invite failed" }, 400);
        targetId = inv.user.id;
      }

      await admin.from("user_sites").upsert(
        { user_id: targetId, site_id },
        { onConflict: "user_id,site_id" }
      );
      await admin.from("user_roles").upsert(
        { user_id: targetId, site_id, role: body.role },
        { onConflict: "user_id,site_id,role" }
      );

      return json({ ok: true, user_id: targetId });
    }

    if (body.action === "assign") {
      await admin.from("user_sites").upsert(
        { user_id: body.user_id, site_id },
        { onConflict: "user_id,site_id" }
      );
      const { error } = await admin.from("user_roles").upsert(
        { user_id: body.user_id, site_id, role: body.role },
        { onConflict: "user_id,site_id,role" }
      );
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "revoke_role") {
      // Prevent removing the last admin
      if (body.role === "admin") {
        const { count } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("site_id", site_id)
          .eq("role", "admin");
        if ((count ?? 0) <= 1) return json({ error: "Cannot remove the last admin" }, 400);
      }
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", body.user_id)
        .eq("site_id", site_id)
        .eq("role", body.role);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "remove_from_site") {
      const { count } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("site_id", site_id)
        .eq("role", "admin");
      const { data: isAdmin } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("site_id", site_id)
        .eq("user_id", body.user_id)
        .eq("role", "admin")
        .maybeSingle();
      if (isAdmin && (count ?? 0) <= 1) return json({ error: "Cannot remove the last admin" }, 400);

      await admin.from("user_roles").delete().eq("user_id", body.user_id).eq("site_id", site_id);
      const { error } = await admin.from("user_sites").delete().eq("user_id", body.user_id).eq("site_id", site_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return json({ error: msg }, 500);
  }
});
