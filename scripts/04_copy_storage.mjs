// 04_copy_storage.mjs
// Copies every object in the waste-photos bucket from the OLD project to YOUR project,
// preserving the exact key layout  <site_id>/<waste_entry_id>/<file>.jpg
// so waste_entry_photos.storage_path keeps working unchanged.
//
// Needs a service-role key for BOTH projects. On Lovable Cloud the old project's
// service-role key is not accessible to you — in that case ask Lovable to run the
// bundled `migrate-storage` edge function instead (see RUNBOOK.md, step 5b).
//
// Usage:
//   npm i @supabase/supabase-js
//   OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
//   NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... node scripts/04_copy_storage.mjs

import { createClient } from "@supabase/supabase-js";

const BUCKET = "waste-photos";
const need = ["OLD_SUPABASE_URL","OLD_SERVICE_ROLE_KEY","NEW_SUPABASE_URL","NEW_SERVICE_ROLE_KEY"];
for (const k of need) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }

const opts = { auth: { persistSession: false } };
const oldC = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SERVICE_ROLE_KEY, opts);
const newC = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SERVICE_ROLE_KEY, opts);

async function walk(prefix = "") {
  const out = [];
  const { data, error } = await oldC.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const e of data) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) out.push(...await walk(path)); // folder
    else out.push(path);
  }
  return out;
}

const files = await walk();
console.log(`${files.length} objects to copy`);

let ok = 0, fail = 0;
for (const path of files) {
  const { data, error } = await oldC.storage.from(BUCKET).download(path);
  if (error) { console.error(`download FAIL ${path}: ${error.message}`); fail++; continue; }
  const buf = Buffer.from(await data.arrayBuffer());
  const { error: uErr } = await newC.storage.from(BUCKET)
    .upload(path, buf, { contentType: data.type || "image/jpeg", upsert: true });
  if (uErr) { console.error(`upload FAIL ${path}: ${uErr.message}`); fail++; continue; }
  ok++; console.log(`ok ${ok}/${files.length}  ${path}`);
}
console.log(`\nDone. copied=${ok} failed=${fail}`);
