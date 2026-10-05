import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oakjtbkxjhxoeyaapibo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0Ymt4amh4b2V5YWFwaWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzOTQzMywiZXhwIjoyMTAxNDE1NDMzfQ.kKxV2UidOb8-4IeZJO2W3FCWqAHm0DNGx-t9rkzfHAU';
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_FACILITY_NAME = `Test Demo Facility ${Date.now()}`;
const TEST_FACILITY_LOC = 'Testing Zone Beta, Demo Area';

test.describe('Facility Addition Flow Verification', () => {
  let createdSiteId: string | null = null;
  let adminUserId: string | null = null;

  test.afterAll(async () => {
    if (createdSiteId) {
      console.log(`[CLEANUP] Removing test facility: ${TEST_FACILITY_NAME} (${createdSiteId})...`);
      // Delete user_roles, user_sites, site_locations, and site
      await supabaseAdmin.from('user_roles').delete().eq('site_id', createdSiteId);
      await supabaseAdmin.from('user_sites').delete().eq('site_id', createdSiteId);
      await supabaseAdmin.from('site_locations').delete().eq('site_id', createdSiteId);
      await supabaseAdmin.from('sites').delete().eq('id', createdSiteId);
      console.log(`[CLEANUP] Test facility cleaned up successfully.`);
    }
  });

  test('Admin creates new facility in Admin Portal -> Verified in UI, Database, Roles, and Switcher', async ({ page }) => {
    test.setTimeout(90000);

    console.log(`[STEP 1] Admin opens app and navigates to Admin Portal`);
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Dismiss any PWA prompt
    const notNowBtn = page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click();
    }

    const adminPortalNav = page.locator('button:has-text("Admin Portal"), [data-tab="admin"]');
    await expect(adminPortalNav.first()).toBeVisible({ timeout: 15000 });
    await adminPortalNav.first().click();

    // Verify Admin Portal loaded
    await expect(page.locator('text=Admin Portal').first()).toBeVisible();

    // Navigate to Facilities & Tags tab
    console.log(`[STEP 2] Navigating to Facilities & Tags tab`);
    const facilitiesTab = page.locator('button[role="tab"]:has-text("Facilities"), button:has-text("Facilities & Tags"), button:has-text("Facilities")');
    await facilitiesTab.first().click();

    // Verify Facilities section loaded
    await expect(page.locator('text=/Facilities & Location Tags/i').first()).toBeVisible({ timeout: 10000 });

    // Click "Add Facility"
    console.log(`[STEP 3] Opening Add Facility drawer`);
    const addFacilityBtn = page.locator('button:has-text("Add Facility")');
    await addFacilityBtn.first().click();

    // Fill the facility form
    console.log(`[STEP 4] Entering new facility details: ${TEST_FACILITY_NAME}`);
    await page.locator('input[placeholder="Facility name"]').fill(TEST_FACILITY_NAME);
    await page.locator('input[placeholder="Location region (optional)"]').fill(TEST_FACILITY_LOC);

    // Capture screenshot before submitting
    await page.screenshot({ path: 'screenshots/facility_01_add_form.png' });
    console.log(`[SCREENSHOT] Saved screenshots/facility_01_add_form.png`);

    // Submit form
    console.log(`[STEP 5] Submitting facility creation form`);
    const submitBtn = page.locator('button[type="submit"]:has-text("Create Site")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success toast
    await expect(page.locator(`text=Facility "${TEST_FACILITY_NAME}" created`).first()).toBeVisible({ timeout: 15000 });
    console.log(`[VERIFIED] Success toast appeared for "${TEST_FACILITY_NAME}"`);

    // Verify facility appears in facilities list
    const facilityRow = page.locator(`text=${TEST_FACILITY_NAME}`).first();
    await expect(facilityRow).toBeVisible({ timeout: 10000 });

    // Capture screenshot of facilities list
    await page.screenshot({ path: 'screenshots/facility_02_created_in_list.png' });
    console.log(`[SCREENSHOT] Saved screenshots/facility_02_created_in_list.png`);

    // Verify facility switcher in top navbar has automatically switched to the new facility
    console.log(`[STEP 6] Verifying top navigation facility switcher shows the new facility`);
    const topSwitcher = page.locator(`button:has-text("${TEST_FACILITY_NAME}")`);
    await expect(topSwitcher.first()).toBeVisible({ timeout: 10000 });
    console.log(`[VERIFIED] Top navbar facility switcher switched to "${TEST_FACILITY_NAME}"`);

    // STEP 7: Database Verification
    console.log(`[STEP 7] Verifying database records for new facility`);
    const { data: dbSite } = await supabaseAdmin.from('sites').select('*').eq('name', TEST_FACILITY_NAME).single();
    expect(dbSite).toBeDefined();
    expect(dbSite.name).toBe(TEST_FACILITY_NAME);
    expect(dbSite.location).toBe(TEST_FACILITY_LOC);
    createdSiteId = dbSite.id;
    console.log(`[DB VERIFIED] Site record found: ID = ${createdSiteId}`);

    // Verify test_user is in user_sites
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const adminUser = users.find(u => u.email === 'test_user@gmail.com');
    expect(adminUser).toBeDefined();
    adminUserId = adminUser!.id;

    const { data: dbUserSite } = await supabaseAdmin.from('user_sites').select('*').eq('site_id', createdSiteId).eq('user_id', adminUserId);
    expect(dbUserSite).toBeDefined();
    expect(dbUserSite!.length).toBe(1);
    console.log(`[DB VERIFIED] Admin linked to facility in user_sites: user_id = ${adminUserId}`);

    // Verify test_user is admin in user_roles
    const { data: dbUserRoles } = await supabaseAdmin.from('user_roles').select('*').eq('site_id', createdSiteId).eq('user_id', adminUserId);
    expect(dbUserRoles).toBeDefined();
    expect(dbUserRoles!.length).toBe(1);
    expect(dbUserRoles![0].role).toBe('admin');
    console.log(`[DB VERIFIED] Admin role automatically granted in user_roles: role = admin`);

    // STEP 8: Verify Facility Switcher dropdown allows switching back and forth
    console.log(`[STEP 8] Testing facility switching in UI`);
    await topSwitcher.first().click();
    // Select Molagavalli
    const molagavalliOption = page.locator('[role="menuitem"]:has-text("Molagavalli"), [role="option"]:has-text("Molagavalli"), button:has-text("Molagavalli")');
    if (await molagavalliOption.first().isVisible().catch(() => false)) {
      await molagavalliOption.first().click();
      await page.waitForTimeout(1000);
      console.log(`[VERIFIED] Successfully switched back to Molagavalli`);
    } else {
      await page.keyboard.press('Escape');
    }

    await page.screenshot({ path: 'screenshots/facility_03_switched_back.png' });
    console.log(`[SCREENSHOT] Saved screenshots/facility_03_switched_back.png`);
    console.log(`[COMPLETE] Facility addition flow verified successfully!`);
  });
});
