import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://oakjtbkxjhxoeyaapibo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0Ymt4amh4b2V5YWFwaWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzOTQzMywiZXhwIjoyMTAxNDE1NDMzfQ.kKxV2UidOb8-4IeZJO2W3FCWqAHm0DNGx-t9rkzfHAU';
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_USER = {
  name: 'Automated Test Operator',
  email: `automated_op_${Date.now()}@testwb.com`,
  password: 'TestPassword#2026',
};

test.describe('Admin User Provisioning, Role Assignment, and User Login Flow', () => {
  let createdUserId: string | null = null;

  test.afterAll(async () => {
    if (createdUserId) {
      console.log(`[CLEANUP] Removing test user ${TEST_USER.email} (${createdUserId})...`);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', createdUserId);
      await supabaseAdmin.from('user_sites').delete().eq('user_id', createdUserId);
      await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      console.log(`[CLEANUP] Successfully cleaned up test user.`);
    }
  });

  test('E2E Complete Flow: Admin creates user -> assigns roles -> user logs in -> permissions verified', async ({ page, browser }) => {
    test.setTimeout(120000);

    console.log(`[STEP 1] Admin opens app and navigates to Admin Portal`);
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Wait for the desktop sidebar or admin button
    const adminPortalNav = page.locator('button:has-text("Admin Portal"), [data-tab="admin"]');
    await expect(adminPortalNav.first()).toBeVisible({ timeout: 15000 });
    await adminPortalNav.first().click();

    // Verify Admin Portal loaded
    await expect(page.locator('text=Admin Portal').first()).toBeVisible();

    // Navigate to Team & Access tab
    console.log(`[STEP 2] Navigating to Team & Access tab`);
    const teamTab = page.locator('button[role="tab"]:has-text("Team & Access"), button:has-text("Team & Access")');
    await teamTab.first().click();

    // Wait for initial members load to complete
    await expect(page.locator('text=Site Operators & Credentials').first()).toBeVisible();
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 }).catch(() => {});

    // Dismiss any PWA prompt
    const notNowBtn = page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click();
    }

    // Click "Add User Account"
    console.log(`[STEP 3] Opening Add User Account drawer`);
    const addUserBtn = page.locator('button:has-text("Add User Account"), button:has-text("Add User")');
    await addUserBtn.first().click();

    // Fill in the form
    console.log(`[STEP 4] Submitting new user form for ${TEST_USER.email}`);
    await page.locator('input[placeholder="e.g. Alex Kumar"]').fill(TEST_USER.name);
    await page.locator('input[placeholder="colleague@domain.com"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="Min 6 characters"]').fill(TEST_USER.password);

    const submitBtn = page.locator('button[type="submit"]:has-text("Create Account & Hand Over")');
    await expect(submitBtn).toBeEnabled();

    // Submit and await the edge function response
    console.log(`[STEP 5] Submitting creation request to edge function`);
    const [createResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('admin-manage-user') && res.status() === 200, { timeout: 20000 }),
      submitBtn.click(),
    ]);
    const createData = await createResponse.json();
    console.log(`[EDGE SUCCESS] create_user returned:`, createData);

    // Verify Credentials Ready Dialog appears
    console.log(`[STEP 6] Verifying Credentials Ready modal`);
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog.getByText('User Credentials Ready')).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(TEST_USER.email)).toBeVisible();
    await expect(dialog.getByText(TEST_USER.password)).toBeVisible();

    // Capture screenshot of credentials modal
    await page.screenshot({ path: 'screenshots/01_admin_user_created_modal.png' });
    console.log(`[SCREENSHOT] Saved screenshots/01_admin_user_created_modal.png`);

    // Click "Done" to close the credentials dialog
    const doneBtn = dialog.locator('button:has-text("Done")');
    await doneBtn.click();
    await expect(dialog).not.toBeVisible();
    await page.waitForTimeout(1000);

    // Verify in database and retrieve created user_id
    const { data: dbProfiles } = await supabaseAdmin.from('profiles').select('id, full_name, email').eq('email', TEST_USER.email);
    expect(dbProfiles).toBeDefined();
    expect(dbProfiles!.length).toBe(1);
    createdUserId = dbProfiles![0].id;
    console.log(`[DB VERIFIED] Created user in profiles: ID = ${createdUserId}, Name = ${dbProfiles![0].full_name}`);

    // Verify role in user_roles
    const { data: initialRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', createdUserId);
    const roleList1 = (initialRoles ?? []).map((r) => r.role);
    expect(roleList1).toContain('member');
    console.log(`[DB VERIFIED] Initial roles: ${roleList1.join(', ')}`);

    // Wait for directory to display the new user
    console.log(`[STEP 7] Verifying user appears in Members Directory`);
    const userRow = page.locator('.divide-y > div').filter({ hasText: TEST_USER.email });
    await expect(userRow).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'screenshots/02_admin_directory_member.png' });
    console.log(`[SCREENSHOT] Saved screenshots/02_admin_directory_member.png`);

    // STEP 8: Assign Manager role in UI via edge function
    console.log(`[STEP 8] Assigning manager role in UI`);
    const managerRoleBtn = userRow.locator('button').filter({ hasText: /^manager$/i });
    await managerRoleBtn.scrollIntoViewIfNeeded();

    const [assignResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('admin-manage-user') && res.status() === 200, { timeout: 15000 }),
      managerRoleBtn.click({ force: true }),
    ]);
    console.log(`[EDGE SUCCESS] assign manager returned 200`);

    await page.waitForTimeout(1500);
    const { data: updatedRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', createdUserId);
    const roleList2 = (updatedRoles ?? []).map((r) => r.role);
    console.log(`[DB VERIFIED] Roles after granting manager: ${roleList2.join(', ')}`);
    expect(roleList2).toContain('manager');

    // Revoke member role so user has strictly manager
    console.log(`[STEP 8b] Revoking member role in UI`);
    const memberRoleBtn = userRow.locator('button').filter({ hasText: /^member$/i });
    await memberRoleBtn.scrollIntoViewIfNeeded();

    const [revokeResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('admin-manage-user') && res.status() === 200, { timeout: 15000 }),
      memberRoleBtn.click({ force: true }),
    ]);
    console.log(`[EDGE SUCCESS] revoke member returned 200`);

    await page.waitForTimeout(1500);
    const { data: finalRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', createdUserId);
    const roleList3 = (finalRoles ?? []).map((r) => r.role);
    console.log(`[DB VERIFIED] Roles after revoking member: ${roleList3.join(', ')}`);
    expect(roleList3).toContain('manager');
    expect(roleList3).not.toContain('member');

    await page.screenshot({ path: 'screenshots/03_admin_directory_manager.png' });
    console.log(`[SCREENSHOT] Saved screenshots/03_admin_directory_manager.png`);

    // STEP 9: Fresh incognito browser context for the new user login
    console.log(`[STEP 9] Opening fresh incognito browser context for new user login`);
    const userContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const userPage = await userContext.newPage();

    await userPage.goto('/auth');
    await expect(userPage).toHaveURL(/\/auth/);

    console.log(`[STEP 10] Entering new user credentials at /auth`);
    await userPage.locator('#email').fill(TEST_USER.email);
    await userPage.locator('#password').fill(TEST_USER.password);
    await userPage.locator('button[type="submit"]').click();

    // Verify successful login and redirect to /app
    console.log(`[STEP 11] Waiting for redirect to /app`);
    await userPage.waitForURL(/\/app/, { timeout: 20000 });
    await expect(userPage).toHaveURL(/\/app/);

    // Verify facility loaded
    await expect(userPage.locator('text=Molagavalli 1 & 2').first()).toBeVisible({ timeout: 15000 });
    console.log(`[VERIFIED] Facility 'Molagavalli 1 & 2' loaded in user session`);

    // Verify user role permissions in the UI:
    // As Manager:
    // 1. Should NOT see Admin Portal tab in sidebar
    const adminNavForManager = userPage.locator('button:has-text("Admin Portal")');
    await expect(adminNavForManager).toHaveCount(0);
    console.log(`[VERIFIED] Admin Portal is hidden for non-admin user`);

    // 2. Manager / Facility Operator badge displayed in profile footer
    const roleBadge = userPage.locator('text=/Facility Operator|Manager|Operator/i').first();
    await expect(roleBadge).toBeVisible();

    await userPage.screenshot({ path: 'screenshots/04_new_user_logged_in.png' });
    console.log(`[SCREENSHOT] Saved screenshots/04_new_user_logged_in.png`);

    // STEP 12: Upgrade user to Admin in admin session and verify live upgrade
    console.log(`[STEP 12] Upgrading user to Admin role`);
    const adminRoleBtn = userRow.locator('button').filter({ hasText: /^admin$/i });
    await adminRoleBtn.scrollIntoViewIfNeeded();

    const [adminAssignResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('admin-manage-user') && res.status() === 200, { timeout: 15000 }),
      adminRoleBtn.click({ force: true }),
    ]);
    console.log(`[EDGE SUCCESS] admin role assigned returned 200`);

    // Reload userPage and verify Admin Portal now appears!
    console.log(`[STEP 13] Reloading user session to verify upgraded Admin privileges`);
    await userPage.reload();
    await userPage.waitForLoadState('networkidle');

    const adminNavForAdmin = userPage.locator('button:has-text("Admin Portal"), [data-tab="admin"]');
    await expect(adminNavForAdmin.first()).toBeVisible({ timeout: 20000 });
    console.log(`[VERIFIED] Admin Portal is now visible for upgraded user!`);

    await adminNavForAdmin.first().click();
    await expect(userPage.locator('text=Admin Portal').first()).toBeVisible();

    await userPage.screenshot({ path: 'screenshots/05_new_user_as_admin.png' });
    console.log(`[SCREENSHOT] Saved screenshots/05_new_user_as_admin.png`);

    await userContext.close();
    console.log(`[COMPLETE] Entire workflow verified successfully!`);
  });
});
