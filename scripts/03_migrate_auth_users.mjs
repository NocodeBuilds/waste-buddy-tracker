// 03_migrate_auth_users.mjs
// Recreates every login account on YOUR Supabase project with the SAME user id,
// so all foreign keys (waste_entries.created_by, user_roles.user_id, ...) stay valid.
//
// Password hashes cannot be read out of a managed project, so each user gets a
// password-recovery email and sets a new password once. Everything else carries over.
//
// Usage:
//   npm i @supabase/supabase-js
//   NEW_SUPABASE_URL="https://xxxx.supabase.co" \
//   NEW_SERVICE_ROLE_KEY="eyJ..." \
//   node scripts/03_migrate_auth_users.mjs            # add --send-reset to email everyone
//
// Run this AFTER 01_schema.sql and BEFORE 02_import_data.sh.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEW_SUPABASE_URL;
const key = process.env.NEW_SERVICE_ROLE_KEY;
const sendReset = process.argv.includes("--send-reset");
if (!url || !key) { console.error("Set NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY"); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false } });

// minimal CSV parser (handles quoted fields)
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const profiles = parseCsv(readFileSync(new URL("./data/profiles.csv", import.meta.url), "utf8"));
console.log(`Migrating ${profiles.length} accounts...`);

for (const p of profiles) {
  if (!p.email) { console.warn(`skip ${p.id} — no email`); continue; }
  const { error } = await admin.auth.admin.createUser({
    id: p.id,
    email: p.email,
    email_confirm: true,
    user_metadata: { full_name: p.full_name || p.email },
  });
  if (error && !/already/i.test(error.message)) { console.error(`FAIL ${p.email}: ${error.message}`); continue; }
  console.log(`ok  ${p.email}`);

  if (sendReset) {
    const { error: rErr } = await admin.auth.resetPasswordForEmail(p.email, {
      redirectTo: `${process.env.APP_URL ?? "http://localhost:8080"}/reset-password`,
    });
    if (rErr) console.error(`  reset mail failed: ${rErr.message}`);
  }
}

// The handle_new_user trigger already inserted profiles rows; 02_import_data.sh
// would then conflict. Clear them so the CSV import is the source of truth.
console.log("\nNow run:  psql \"$PGURI\" -c 'truncate public.profiles cascade;'  before 02_import_data.sh");
