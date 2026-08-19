import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../playwright/.auth/ux-audit');
const STORAGE_STATE_PATH = path.join(__dirname, '../playwright/.auth/user.json');

test.describe('UX Audit — Missing Mobile/Tablet Screenshots', () => {
  test.beforeAll(async () => {
    try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch (e) {}
  });

  test.beforeEach(async ({ context }) => {
    if (context && 'extendStorageState' in context) {
      await (context as any).extendStorageState?.(STORAGE_STATE_PATH);
    }
  });

  test('Mobile 375x812 — Inventory, Filters, Export', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Use bottom nav FAB or bottom nav buttons for mobile
    // The bottom nav has: Home | Inventory | [Log FAB] | Analytics | Settings
    const inventoryBtn = page.locator('button:has-text("Inventory")').nth(1);
    if (await inventoryBtn.count() > 0 && await inventoryBtn.isVisible()) {
      await inventoryBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-inventory-mobile-375.png'), fullPage: true });
      console.log('✓ 375x812 inventory captured');

      // Open filter
      const filter = page.locator('select, [role="combobox"]').first();
      if (await filter.count() > 0 && await filter.isVisible()) {
        await filter.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14-filters-mobile-375.png'), fullPage: true });
        await page.keyboard.press('Escape');
        console.log('✓ 375x812 filters captured');
      }

      // Open export
      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.count() > 0 && await exportBtn.isVisible()) {
        await exportBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16-export-mobile-375.png'), fullPage: true });
        await page.keyboard.press('Escape');
        console.log('✓ 375x812 export captured');
      }
    }
  });

  test('Tablet 768x1024 — Navigation, Inventory', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Check which nav is visible
    const navInfo = await page.evaluate(() => {
      const desktopNav = document.querySelector('nav[class*="lg:flex"], nav.hidden');
      const bottomNav = document.querySelector('nav[class*="bottom"]');
      return {
        desktopVisible: desktopNav ? (desktopNav as HTMLElement).offsetParent !== null : false,
        bottomVisible: bottomNav ? (bottomNav as HTMLElement).offsetParent !== null : false,
      };
    });

    console.log('Tablet nav — desktop:', navInfo.desktopVisible, 'bottom:', navInfo.bottomVisible);

    // Try desktop nav first, fallback to bottom nav
    const inventoryBtn = page.locator('button:has-text("Inventory")').first();
    if (await inventoryBtn.count() > 0) {
      try {
        await inventoryBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-inventory-tablet-768.png'), fullPage: true });
        console.log('✓ 768x1024 inventory captured');
      } catch (e) {
        // Desktop nav hidden, try bottom nav
        const bottomInventory = page.locator('button:has-text("Inventory")').nth(1);
        if (await bottomInventory.count() > 0 && await bottomInventory.isVisible()) {
          await bottomInventory.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-inventory-tablet-768.png'), fullPage: true });
          console.log('✓ 768x1024 inventory captured (bottom nav)');
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '23-tablet-768-inventory.png'), fullPage: true });
  });

  test('PWA Offline Test', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(300);

    // Try reload while offline — expect failure due to no network
    let reloadResult: 'success' | 'expected-offline-error' | 'unexpected-error' = 'success';
    try {
      await page.reload({ timeout: 8000 });
    } catch (e: any) {
      if (e?.message?.includes('ERR_INTERNET_DISCONNECTED') || e?.message?.includes('net::')) {
        reloadResult = 'expected-offline-error';
      } else {
        reloadResult = 'unexpected-error';
        throw e;
      }
    }
    console.log('Offline reload result:', reloadResult);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '24-offline.png'), fullPage: true });

    const offlineUrl = page.url();
    const offlineTitle = await page.title();
    console.log('Offline URL:', offlineUrl);
    console.log('Offline title:', offlineTitle);

    // Check if app still works or shows expected offline state
    const offlineWorking = await page.evaluate(() => {
      return {
        hasContent: document.body.innerText.length > 100,
        hasError: document.body.innerText.includes('Cannot connect') || document.body.innerText.includes('Offline'),
        url: window.location.href,
      };
    });

    console.log('Offline app working:', offlineWorking.hasContent ? 'YES ✓' : 'NO ⚠');
    console.log('Offline error shown:', offlineWorking.hasError ? 'YES' : 'NO');

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);

    // Reload to verify recovery — expect success now that we're online
    await page.reload({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '25-online-again.png'), fullPage: true });
    console.log('✓ Back online verified');
  });
});
