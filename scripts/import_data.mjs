// Import all CSV data into Supabase using the REST API / service role key.
// Run: node scripts/import_data.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";

const SUPABASE_URL = process.env.NEW_SUPABASE_URL || "https://oakjtbkxjhxoeyaapibo.supabase.co";
const SERVICE_ROLE_KEY = process.env.NEW_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("Set NEW_SERVICE_ROLE_KEY env var"); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// minimal CSV parser
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

const DATA_DIR = new URL("./data/", import.meta.url);
const files = readdirSync(DATA_DIR).filter(f => f.endsWith(".csv"));

// Skip audit_log to avoid re-logging the import
const skip = new Set(["audit_log.csv", "site_locations.csv"]);
const order = ["sites.csv", "profiles.csv", "site_locations.csv", "user_sites.csv", "user_roles.csv", "site_access_requests.csv", "disposal_batches.csv", "waste_entries.csv", "waste_entry_photos.csv"];

const sorted = order.filter(f => files.includes(f) && !skip.has(f));

for (const file of sorted) {
  const table = file.replace(".csv", "");
  const rows = parseCsv(readFileSync(new URL(`./data/${file}`, import.meta.url), "utf8"));
  console.log(`-> ${table} (${rows.length} rows)`);

  // Remove empty-string IDs so Supabase can generate them if needed
  const cleaned = rows.map(r => {
    const o = { ...r };
    if (!o.id) delete o.id;
    // Convert boolean strings
    if (o.is_common !== undefined) o.is_common = o.is_common === "t" || o.is_common === "true";
    // Convert empty strings to null for UUID/date fields
    for (const key of Object.keys(o)) {
      if (o[key] === "") o[key] = null;
    }
    return o;
  });

  // Upsert for all tables (idempotent — handles partial imports)
  const useUpsert = true;
  const conflictCol = table === "site_locations" ? "is_common,code" : "id";

  // Insert in batches of 50
  const batchSize = 50;
  let ok = 0, fail = 0;
  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);
    const { error } = useUpsert
      ? await admin.from(table).upsert(batch, { onConflict: conflictCol })
      : await admin.from(table).insert(batch);
    if (error) {
      console.error(`  batch ${Math.floor(i / batchSize) + 1} FAIL: ${error.message}`);
      fail += batch.length;
    } else {
      ok += batch.length;
    }
  }
  console.log(`  imported=${ok} failed=${fail}`);
}

console.log("\nDone.");
