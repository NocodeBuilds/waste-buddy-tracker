import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../playwright/.auth/screenshots');

/**
 * Visual Tour of the Waste Buddy Tracker PWA
 *
 * Run with:
 *   npx playwright test tests/waste-buddy-visual-tour.spec.ts --headed --project=chromium
 *
 * This test uses the authenticated storageState from tests/auth.setup.ts
 * and navigates through the application like a real user, taking screenshots
 * at each major screen.
 */

test.describe('Waste Buddy Tracker — Visual Tour', () => {
  test.beforeAll(async () => {
    // Ensure screenshots directory exists
    try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch (e) {}
  });

  test('complete visual tour of the PWA', async ({ page, context }) => {
    // Storage state is loaded from playwright/.auth/user.json via project config

    console.log('\n=== STEP 1: Open Application ===');
    await page.goto('/app');
    await page.waitForTimeout;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-home-dashboard.png'), fullPage: true });
    console.log('✓ Dashboard loaded at:', page.url());

    // Verify we're authenticated and on the app
    await expect(page).toHaveURL(/\/app/);

    console.log('\n=== STEP 2: Home Dashboard ===');
    // Wait for dashboard content to render
    await page.waitForSelector('text=/WasteBuddy|Dashboard|In storage|Latest/i', { timeout: 10_000 });
    await page.waitForTimeout;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-home-content.png'), fullPage: true });
    console.log('✓ Home dashboard content visible');

    console.log('\n=== STEP 3: Navigate to Inventory Tab ===');
    // Click on Inventory tab (desktop uses top nav, mobile uses bottom nav)
    const inventoryTab = page.locator('button:has-text("Inventory"), nav button:has-text("Inventory"), [aria-label*="Inventory"], button:has(.icon-list)').first();
    if (await inventoryTab.count() > 0) {
      await inventoryTab.click();
    } else {
      // Try clicking by text content
      await page.locator('text=Inventory').first().click();
    }
    await page.waitForTimeout;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-inventory.png'), fullPage: true });
    console.log('✓ Inventory tab opened at:', page.url());

    console.log('\n=== STEP 4: Check Inventory Content ===');
    // Wait for inventory table or empty state
    await page.waitForSelector('text=/Waste Inventory|In storage|All Entries|No entries/i', { timeout: 10_000 });
    await page.waitForTimeout;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-inventory-content.png'), fullPage: true });
    console.log('✓ Inventory content loaded');

    console.log('\n=== STEP 5: Test Filters ===');
    // Look for filter controls (period, type, status)
    const filterDropdowns = page.locator('select, [role="combobox"], button:has-text("All"), button:has-text("In Storage")');
    const filterCount = await filterDropdowns.count();
    console.log(`  Found ${filterCount} filter controls`);

    if (filterCount > 0) {
      // Try to interact with the first filter
      const firstFilter = filterDropdowns.first();
      if (await firstFilter.isVisible()) {
        await firstFilter.click();
        await page.waitForTimeout;
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-filters-open.png'), fullPage: true });
        console.log('✓ Filters dropdown opened');

        // Close dropdown by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    console.log('\n=== STEP 6: Open Add Entry Dialog ===');
    // Click the "Log" or "Log Entry" or "+" button
    const addButton = page.locator('button:has-text("Log"), button:has-text("Log Entry"), button:has(.icon-plus), [aria-label*="Add"], [aria-label*="New"]').first();
    if (await addButton.count() > 0 && await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-add-entry-dialog.png'), fullPage: true });
      console.log('✓ Add entry dialog opened');

      // Try to fill the form if fields exist
      const formFields = page.locator('input, select, textarea');
      const fieldCount = await formFields.count();
      console.log(`  Found ${fieldCount} form fields`);

      if (fieldCount > 0) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-add-entry-form.png'), fullPage: true });
      }

      // Close the dialog
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")').first();
      if (await closeButton.count() > 0) {
        await closeButton.click();
        await page.waitForTimeout;
        console.log('✓ Dialog closed');
      }
    } else {
      console.log('⚠ Add entry button not found');
    }

    console.log('\n=== STEP 7: Navigate to Analytics Tab ===');
    const analyticsTab = page.locator('text=Analytics').first();
    if (await analyticsTab.count() > 0) {
      await analyticsTab.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-analytics.png'), fullPage: true });
      console.log('✓ Analytics tab opened');
    } else {
      console.log('⚠ Analytics tab not found');
    }

    console.log('\n=== STEP 8: Navigate to Settings Tab ===');
    const settingsTab = page.locator('text=Settings').first();
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-settings.png'), fullPage: true });
      console.log('✓ Settings tab opened');
    } else {
      console.log('⚠ Settings tab not found');
    }

    console.log('\n=== STEP 9: Navigate to Admin Tab (if available) ===');
    const adminTab = page.locator('text=Admin').first();
    if (await adminTab.count() > 0 && await adminTab.isVisible()) {
      await adminTab.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-admin.png'), fullPage: true });
      console.log('✓ Admin tab opened');
    } else {
      console.log('⚠ Admin tab not available (user may not have admin role)');
    }

    console.log('\n=== STEP 10: Return to Home ===');
    const homeTab = page.locator('text=Home').first();
    if (await homeTab.count() > 0) {
      await homeTab.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-home-return.png'), fullPage: true });
      console.log('✓ Returned to home');
    }

    console.log('\n=== STEP 11: Test Site Switcher ===');
    // Try to open site switcher
    const siteSwitcher = page.locator('button:has-text("Site"), [aria-label*="Site"], .site-switcher').first();
    if (await siteSwitcher.count() > 0 && await siteSwitcher.isVisible()) {
      await siteSwitcher.click();
      await page.waitForTimeout;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-site-switcher.png'), fullPage: true });
      console.log('✓ Site switcher opened');

      // Close it
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('⚠ Site switcher not found');
    }

    console.log('\n=== STEP 12: Test Export Functionality ===');
    // Go back to inventory to test export
    const inventoryTab2 = page.locator('text=Inventory').first();
    if (await inventoryTab2.count() > 0) {
      await inventoryTab2.click();
      await page.waitForTimeout;

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), button:has(.icon-file), [aria-label*="Export"]').first();
      if (await exportButton.count() > 0 && await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout;
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13-export-dialog.png'), fullPage: true });
        console.log('✓ Export dialog opened');

        // Close dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('⚠ Export button not found');
      }
    }

    console.log('\n=== STEP 13: Final Dashboard View ===');
    await page.goto('/app');
    await page.waitForTimeout;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14-final-dashboard.png'), fullPage: true });
    console.log('✓ Final dashboard screenshot captured');

    console.log('\n=== VISUAL TOUR COMPLETE ===');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
  });
});
