import { test, expect } from '@playwright/test';

test.describe('Settings Navigation & Admin Consolidation Verification', () => {
  test('Settings cleanly routes Admin to dedicated Admin tabs without duplicate forms', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Dismiss any PWA prompt
    const notNowBtn = page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click();
    }

    // Navigate to Settings
    console.log('[STEP 1] Navigating to Settings tab');
    const settingsNav = page.locator('button:has-text("Settings"), [data-tab="settings"]');
    await settingsNav.first().click();

    // Verify Settings loaded
    await expect(page.locator('text=Authorized Facilities').first()).toBeVisible({ timeout: 10000 });

    // Verify duplicate inline form is completely gone
    const addSiteDrawer = page.locator('text=Register New Facility Site');
    await expect(addSiteDrawer).toHaveCount(0);
    console.log('[VERIFIED] Duplicate "Register New Facility Site" inline form is removed');

    // Verify new clean action buttons
    const manageFacilitiesBtn = page.locator('button:has-text("Manage Facilities in Admin")');
    await expect(manageFacilitiesBtn).toBeVisible();

    const manageUsersBtn = page.locator('button:has-text("Manage Users in Admin")');
    await expect(manageUsersBtn).toBeVisible();

    // Capture screenshot of clean Settings
    await page.screenshot({ path: 'screenshots/settings_clean_admin_routing.png' });
    console.log('[SCREENSHOT] Saved screenshots/settings_clean_admin_routing.png');

    // Click "Manage Facilities in Admin"
    console.log('[STEP 2] Clicking "Manage Facilities in Admin"');
    await manageFacilitiesBtn.click();

    // Verify we are now on Admin Portal -> Facilities & Tags
    await expect(page.locator('text=Admin Portal').first()).toBeVisible();
    await expect(page.locator('text=/Facilities & Location Tags/i').first()).toBeVisible();
    console.log('[VERIFIED] Successfully deep-linked into Admin Portal -> Facilities & Tags');

    await page.screenshot({ path: 'screenshots/settings_routed_to_facilities.png' });
    console.log('[SCREENSHOT] Saved screenshots/settings_routed_to_facilities.png');

    // Go back to Settings and test "Manage Users in Admin"
    console.log('[STEP 3] Returning to Settings to test "Manage Users in Admin"');
    await settingsNav.first().click();
    await expect(page.locator('text=Authorized Facilities').first()).toBeVisible();

    await manageUsersBtn.click();
    await expect(page.locator('text=Admin Portal').first()).toBeVisible();
    await expect(page.locator('text=Site Operators & Credentials').first()).toBeVisible();
    console.log('[VERIFIED] Successfully deep-linked into Admin Portal -> Team & Access');

    await page.screenshot({ path: 'screenshots/settings_routed_to_users.png' });
    console.log('[SCREENSHOT] Saved screenshots/settings_routed_to_users.png');
  });
});
