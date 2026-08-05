const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://oakjtbkxjhxoeyaapibo.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0Ymt4amh4b2V5YWFwaWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzOTQzMywiZXhwIjoyMTAxNDE1NDMzfQ.kKxV2UidOb8-4IeZJO2W3FCWqAHm0DNGx-t9rkzfHAU";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // 1. Delete all users
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("List error:", listErr.message);
    return;
  }
  console.log(`Found ${users.length} users. Deleting all...`);

  let deleted = 0, failed = 0;
  for (const u of users) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      failed++;
      console.error(`  Failed: ${u.email} - ${error.message}`);
    } else {
      deleted++;
      console.log(`  Deleted: ${u.email}`);
    }
  }
  console.log(`--- Deleted ${deleted}/${users.length} users (${failed} failed) ---\n`);

  // 2. Clean up user-related tables (orphaned rows)
  const { error: rolesErr } = await supabase.from("user_roles").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (rolesErr) console.error("Clean user_roles:", rolesErr.message);
  else console.log("Cleared user_roles");

  const { error: sitesErr } = await supabase.from("user_sites").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (sitesErr) console.error("Clean user_sites:", sitesErr.message);
  else console.log("Cleared user_sites");

  const { error: reqErr } = await supabase.from("site_access_requests").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (reqErr) console.error("Clean requests:", reqErr.message);
  else console.log("Cleared site_access_requests");

  // 3. Create new admin: wbadmin@gmail.com
  console.log("\nCreating admin: wbadmin@gmail.com");
  const { data: newAdmin, error: createErr } = await supabase.auth.admin.createUser({
    email: "wbadmin@gmail.com",
    email_confirm: true,
    password: "ChangeMe@2026",
  });

  if (createErr) {
    console.error("Create admin failed:", createErr.message);
    return;
  }

  const adminId = newAdmin.user.id;
  console.log(`Created user: ${newAdmin.user.email} (${adminId})`);

  // 4. Ensure profile exists
  const { error: profErr } = await supabase.from("profiles").upsert(
    { id: adminId, email: "wbadmin@gmail.com", full_name: "Waste Buddy Admin" },
    { onConflict: "id" }
  );
  if (profErr) console.error("Profile:", profErr.message);
  else console.log("Profile created");

  // 5. Find or create a default site
  const { data: sites } = await supabase.from("sites").select("id, name").limit(1);
  let siteId;
  if (sites && sites.length > 0) {
    siteId = sites[0].id;
    console.log(`Using existing site: ${sites[0].name} (${siteId})`);
  } else {
    const { data: newSite, error: nsErr } = await supabase
      .from("sites")
      .insert({ name: "Main Site", location: "Default Location" })
      .select()
      .single();
    if (nsErr) {
      console.error("Create site failed:", nsErr.message);
      return;
    }
    siteId = newSite.id;
    console.log(`Created default site: ${newSite.name} (${siteId})`);
  }

  // 6. Link admin to site
  const { error: usErr } = await supabase.from("user_sites").insert({
    user_id: adminId,
    site_id: siteId,
  });
  if (usErr) console.error("user_sites:", usErr.message);
  else console.log("Linked admin to site");

  // 7. Grant admin role
  const { error: urErr } = await supabase.from("user_roles").insert({
    user_id: adminId,
    site_id: siteId,
    role: "admin",
  });
  if (urErr) console.error("user_roles:", urErr.message);
  else console.log("Granted admin role");

  console.log("\n=== DONE ===");
  console.log("Admin email:    wbadmin@gmail.com");
  console.log("Admin password: ChangeMe@2026");
  console.log("Site:           " + siteId);
  console.log("\n→ Sign in and change the password immediately.");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
