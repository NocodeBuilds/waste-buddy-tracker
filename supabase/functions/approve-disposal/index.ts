// Approve or reject a pending disposal batch. Manager/admin only.
// H4 fix: prevents self-approval (the creator of the batch cannot approve it).
// M5 fix: requires ALLOWED_ORIGINS env var; refuses to start if empty.
// On approve: links all unlinked entries on that site to the batch.
// On reject: marks batch rejected, leaves entries unlinked.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// M5 fix: fail fast at module load if ALLOWED_ORIGINS is not configured
if (ALLOWED_ORIGINS.length === 0) {
  console.error("ALLOWED_ORIGINS env var is required. Set it to a comma-separated list of allowed origins.");
}

function buildCorsHeaders(reqOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) {
    headers["Access-Control-Allow-Origin"] = reqOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

interface Body {
  batch_id: string;
  site_id: string;
  action: "approve" | "reject";
  reason?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // M5 fix: reject any request when ALLOWED_ORIGINS is not configured
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
    const callerId = userData.user.id as string;

    const body = (await req.json()) as Body;
    if (!body.batch_id || !body.site_id || !body.action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify caller is manager or admin of the target site
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("site_id", body.site_id);
    const allowed = (callerRoles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Only managers or admins can approve disposals" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Verify batch exists, is pending, and fetch disposer
    const { data: batch, error: batchErr } = await admin
      .from("disposal_batches")
      .select("id, status, site_id, disposed_by")
      .eq("id", body.batch_id)
      .maybeSingle();
    if (batchErr || !batch) {
      return new Response(JSON.stringify({ error: "Disposal batch not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (batch.site_id !== body.site_id) {
      return new Response(JSON.stringify({ error: "Site mismatch" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (batch.status !== "pending") {
      return new Response(JSON.stringify({ error: `Batch is already ${batch.status}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // H4 fix: prevent self-approval (separation of duties)
    // Allow rejection by the creator, but not approval
    if (body.action === "approve" && batch.disposed_by === callerId) {
      return new Response(JSON.stringify({ error: "You cannot approve a disposal batch you submitted. Ask another manager or admin." }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    if (body.action === "approve") {
      // 1. Mark batch approved
      const { error: uErr } = await admin
        .from("disposal_batches")
        .update({
          status: "approved",
          approved_by: callerId,
          approved_at: now,
        })
        .eq("id", body.batch_id);
      if (uErr) {
        return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 2. Check if entries were already linked to this batch (selective disposal)
      const { count: linkedCount } = await admin
        .from("waste_entries")
        .select("id", { count: "exact", head: true })
        .eq("disposal_batch_id", body.batch_id);

      if (!linkedCount || linkedCount === 0) {
        // Fallback for full facility batch: link all unlinked entries on this site
        const { error: linkErr } = await admin
          .from("waste_entries")
          .update({ disposal_batch_id: body.batch_id })
          .eq("site_id", body.site_id)
          .is("disposal_batch_id", null);
        if (linkErr) {
          return new Response(JSON.stringify({ error: linkErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ ok: true, status: "approved" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // action === "reject"
    // Unlink any entries that were pre-linked to this batch
    await admin
      .from("waste_entries")
      .update({ disposal_batch_id: null })
      .eq("disposal_batch_id", body.batch_id);

    const { error: rErr } = await admin
      .from("disposal_batches")
      .update({
        status: "rejected",
        rejection_reason: body.reason ?? null,
        approved_by: callerId,
        approved_at: now,
      })
      .eq("id", body.batch_id);
    if (rErr) {
      return new Response(JSON.stringify({ error: rErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
