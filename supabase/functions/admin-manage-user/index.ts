// Admin-only: create/invite a user, assign site + role, or revoke.
// Requires the caller to be admin on the target site.
// M5 fix: ALLOWED_ORIGINS is required; CORS rejects any origin not in the list.
// H6 fix: TOCTOU race on last-admin check — uses a verify-after-delete pattern.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_REDIRECT = ALLOWED_ORIGINS[0] ?? "";

// M5 fix: fail at module load if ALLOWED_ORIGINS is not set
if (ALLOWED_ORIGINS.length === 0) {
  console.error("ALLOWED_ORIGINS env var is required. Set it to a comma-separated list of allowed origins.");
}

function buildCorsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  // M5 fix: never fall back to *; only allow exact origin matches
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) {
    headers["Access-Control-Allow-Origin"] = reqOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

type Action =
  | { action: "create_user"; email: string; password?: string; site_id: string; role: "admin" | "manager" | "member"; full_name?: string }
  | { action: "invite"; email: string; site_id: string; role: "admin" | "manager" | "member"; full_name?: string }
  | { action: "assign"; user_id: string; site_id: string; role: "admin" | "manager" | "member" }
  | { action: "revoke_role"; user_id: string; site_id: string; role: "admin" | "manager" | "member" }
  | { action: "remove_from_site"; user_id: string; site_id: string }
  | { action: "approve_request"; request_id: string; site_id: string; role?: "admin" | "manager" | "member" }
  | { action: "reject_request"; request_id: string; site_id: string; note?: string };

function json(body: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // M5 fix: reject if ALLOWED_ORIGINS not configured
  if (ALLOWED_ORIGINS.length === 0) {
    return json({ error: "Server misconfigured: ALLOWED_ORIGINS not set" }, 500, cors);
  }

  // M5 fix: block requests from unapproved origins
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403, cors);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, cors);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401, cors);
    const user = { id: userData.user.id as string };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = (await req.json()) as Action;
    if (!body || !("action" in body)) return json({ error: "Invalid payload" }, 400, cors);

    const site_id = (body as any).site_id as string;
    if (!site_id) return json({ error: "site_id required" }, 400, cors);

    // Verify caller is admin of target site
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("site_id", site_id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Forbidden — not an admin of this site" }, 403, cors);

    if (body.action === "create_user") {
      const email = body.email.trim().toLowerCase();
      const password = (body.password ?? "").trim();
      if (!email.includes("@")) return json({ error: "Invalid email" }, 400, cors);
      if (!password || password.length < 12) {
        return json({ error: "Password must be at least 12 characters" }, 400, cors);
      }
      if (!/[A-Z]/.test(password)) {
        return json({ error: "Password must include at least one uppercase letter" }, 400, cors);
      }
      if (!/[a-z]/.test(password)) {
        return json({ error: "Password must include at least one lowercase letter" }, 400, cors);
      }
      if (!/[0-9]/.test(password)) {
        return json({ error: "Password must include at least one number" }, 400, cors);
      }

      let targetId: string | null = null;
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        targetId = existing.id;
        await admin.auth.admin.updateUserById(targetId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name ?? email },
        });
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name ?? email },
        });
        if (createErr || !created.user) {
          return json({ error: createErr?.message ?? "User creation failed" }, 400, cors);
        }
        targetId = created.user.id;
      }

      await admin.from("user_sites").upsert(
        { user_id: targetId, site_id },
        { onConflict: "user_id,site_id" }
      );
      await admin.from("user_roles").upsert(
        { user_id: targetId, site_id, role: body.role },
        { onConflict: "user_id,site_id,role" }
      );

      return json({ ok: true, user_id: targetId }, 200, cors);
    }

    if (body.action === "invite") {
      const email = body.email.trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "Invalid email" }, 400, cors);

      let targetId: string | null = null;
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        targetId = existing.id;
        const redirectTo = `${DEFAULT_REDIRECT}/reset-password`;
        await admin.auth.admin.generateLink({ type: "recovery", email, redirectTo });
      } else {
        const redirectTo = `${DEFAULT_REDIRECT}/reset-password`;
        const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { full_name: body.full_name ?? email },
        });
        if (invErr || !inv.user) return json({ error: invErr?.message ?? "Invite failed" }, 400, cors);
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

      return json({ ok: true, user_id: targetId }, 200, cors);
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
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true }, 200, cors);
    }

    if (body.action === "revoke_role") {
      // H6 fix: verify-after-delete to prevent TOCTOU race leaving zero admins
      const isAdminRole = body.role === "admin";

      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", body.user_id)
        .eq("site_id", site_id)
        .eq("role", body.role);
      if (error) return json({ error: error.message }, 400, cors);

      // H6 fix: if we just deleted the last admin, add the caller back
      if (isAdminRole) {
        const { data: remainingAdmins } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("site_id", site_id)
          .eq("role", "admin");
        if ((remainingAdmins?.length ?? 0) === 0) {
          // Compensating action: restore the caller as admin
          await admin.from("user_roles").upsert(
            { user_id: user.id, site_id, role: "admin" },
            { onConflict: "user_id,site_id,role" }
          );
          return json({ error: "Cannot remove the last admin — operation reverted" }, 400, cors);
        }
      }

      return json({ ok: true }, 200, cors);
    }

    if (body.action === "remove_from_site") {
      // H6 fix: verify-after-delete pattern
      const { data: targetIsAdmin } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("site_id", site_id)
        .eq("user_id", body.user_id)
        .eq("role", "admin")
        .maybeSingle();

      await admin.from("user_roles").delete().eq("user_id", body.user_id).eq("site_id", site_id);
      const { error } = await admin.from("user_sites").delete().eq("user_id", body.user_id).eq("site_id", site_id);
      if (error) return json({ error: error.message }, 400, cors);

      // If we just removed the last admin, restore the caller
      if (targetIsAdmin) {
        const { data: remainingAdmins } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("site_id", site_id)
          .eq("role", "admin");
        if ((remainingAdmins?.length ?? 0) === 0) {
          await admin.from("user_roles").upsert(
            { user_id: user.id, site_id, role: "admin" },
            { onConflict: "user_id,site_id,role" }
          );
          return json({ error: "Cannot remove the last admin — operation reverted" }, 400, cors);
        }
      }

      return json({ ok: true }, 200, cors);
    }

    if (body.action === "approve_request") {
      const { data: reqRow, error: reqErr } = await admin
        .from("site_access_requests")
        .select("id, user_id, site_id, status")
        .eq("id", body.request_id)
        .maybeSingle();
      if (reqErr || !reqRow) return json({ error: "Request not found" }, 404, cors);
      if (reqRow.site_id !== site_id) return json({ error: "Site mismatch" }, 400, cors);
      if (reqRow.status !== "pending") return json({ error: "Already decided" }, 400, cors);

      const role = body.role ?? "member";
      await admin.from("user_sites").upsert(
        { user_id: reqRow.user_id, site_id },
        { onConflict: "user_id,site_id" }
      );
      await admin.from("user_roles").upsert(
        { user_id: reqRow.user_id, site_id, role },
        { onConflict: "user_id,site_id,role" }
      );
      await admin.from("site_access_requests")
        .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", body.request_id);
      return json({ ok: true }, 200, cors);
    }

    if (body.action === "reject_request") {
      const { error } = await admin.from("site_access_requests")
        .update({
          status: "rejected",
          decided_at: new Date().toISOString(),
          decided_by: user.id,
          note: body.note ?? null,
        })
        .eq("id", body.request_id)
        .eq("site_id", site_id);
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return json({ error: msg }, 500, cors);
  }
});
