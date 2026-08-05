import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://oakjtbkxjhxoeyaapibo.supabase.co";
// Use anon key for reading (RLS allows reading your own sites)
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!ANON_KEY) {
  console.log("Set VITE_SUPABASE_PUBLISHABLE_KEY env var first, or edit this script with your anon key");
  process.exit(1);
}

const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

(async () => {
  const { data: sites } = await c.from("sites").select("id, name, location");
  console.log("Sites found:");
  for (const s of sites) {
    console.log(`  ${s.id}  |  ${s.name}  |  ${s.location}`);
  }

  const { data: entries } = await c.from("waste_entries").select("site_id, id");
  const counts = {};
  for (const e of entries || []) { counts[e.site_id] = (counts[e.site_id] || 0) + 1; }
  console.log("\nEntry counts per site:");
  for (const [sid, cnt] of Object.entries(counts)) {
    const site = sites?.find(s => s.id === sid);
    console.log(`  ${sid}  |  ${site?.name || "unknown"}  |  ${cnt} entries`);
  }

  const { data: batches } = await c.from("disposal_batches").select("site_id, id");
  const bCounts = {};
  for (const b of batches || []) { bCounts[b.site_id] = (bCounts[b.site_id] || 0) + 1; }
  console.log("\nBatch counts per site:");
  for (const [sid, cnt] of Object.entries(bCounts)) {
    const site = sites?.find(s => s.id === sid);
    console.log(`  ${site?.name || "unknown"}  |  ${cnt} batches`);
  }
})();
