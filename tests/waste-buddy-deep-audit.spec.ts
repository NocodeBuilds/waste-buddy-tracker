import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../playwright/.auth/audit');
const STORAGE_STATE_PATH = path.join(__dirname, '../playwright/.auth/user.json');

test.describe('Waste Buddy Tracker — Deep PWA Audit', () => {
  test.beforeAll(async () => {
    try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch (e) {}
  });

  test.beforeEach(async ({ context }) => {
    // Ensure fresh auth state for each test
    if (context && 'extendStorageState' in context) {
      await (context as any).extendStorageState?.(STORAGE_STATE_PATH);
    }
  });

  test('Phase 1: Application Health — Console & Network', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    });

    page.on('pageerror', (err) => errors.push(err.message));

    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/app');
    await page.waitForTimeout(500);

    console.log('\n--- CONSOLE ERRORS ---');
    console.log(errors.length === 0 ? 'None' : errors.slice(0, 10).join('\n'));
    console.log('\n--- CONSOLE WARNINGS ---');
    console.log(warnings.length === 0 ? 'None' : warnings.slice(0, 10).join('\n'));
    console.log('\n--- FAILED NETWORK REQUESTS ---');
    console.log(failedRequests.length === 0 ? 'None' : failedRequests.slice(0, 10).join('\n'));

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'health-console.png'), fullPage: true });

    // Assert no critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('manifest')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Phase 2: Responsive — Mobile 375x812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-375-dashboard.png'), fullPage: true });
    console.log('✓ 375x812 dashboard captured');

    // Check for horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`  Horizontal scroll: ${hasHorizontalScroll ? 'YES ⚠' : 'NO ✓'}`);

    // Navigate to inventory on mobile
    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-375-inventory.png'), fullPage: true });
    console.log('✓ 375x812 inventory captured');

    // Open add entry dialog — use visible button filter
    const logBtn = page.locator('button:has-text("Log")').first();
    if (await logBtn.count() > 0 && await logBtn.isVisible().catch(() => false)) {
      await logBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-375-add-dialog.png'), fullPage: true });
      console.log('✓ 375x812 add dialog captured');
      await page.keyboard.press('Escape');
    } else {
      console.log('  Log button not visible on mobile — skipped add dialog screenshot');
    }
  });

  test('Phase 3: Responsive — Tablet 768x1024', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-768-dashboard.png'), fullPage: true });
    console.log('✓ 768x1024 dashboard captured');

    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-768-inventory.png'), fullPage: true });
    console.log('✓ 768x1024 inventory captured');
  });

  test('Phase 4: Responsive — Desktop 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-1440-dashboard.png'), fullPage: true });
    console.log('✓ 1440x900 dashboard captured');

    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'responsive-1440-inventory.png'), fullPage: true });
    console.log('✓ 1440x900 inventory captured');
  });

  test('Phase 5: Dashboard Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Check for key dashboard elements
    const dashboardElements = [
      { selector: 'text=WasteBuddy', name: 'App title' },
      { selector: 'text=/Home|Dashboard|In storage/i', name: 'Dashboard content' },
      { selector: 'button:has-text("Site")', name: 'Site switcher' },
      { selector: 'button[aria-label*="Notification"], button:has(.icon-bell)', name: 'Notifications' },
    ];

    for (const el of dashboardElements) {
      const found = await page.locator(el.selector).first().count();
      console.log(`  ${el.name}: ${found > 0 ? 'FOUND ✓' : 'NOT FOUND ⚠'}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard-details.png'), fullPage: true });
  });

  test('Phase 6: Inventory Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);

    // Check inventory elements
    const inventoryElements = [
      { selector: 'text=Waste Inventory', name: 'Inventory title' },
      { selector: 'select, [role="combobox"]', name: 'Filter controls' },
      { selector: 'button:has-text("Export")', name: 'Export button' },
      { selector: 'button:has-text("Mark Quarterly")', name: 'Disposal button' },
      { selector: 'text=Disposal History', name: 'Disposal history section' },
      { selector: 'table, [role="table"]', name: 'Entries table' },
    ];

    for (const el of inventoryElements) {
      const found = await page.locator(el.selector).first().count();
      console.log(`  ${el.name}: ${found > 0 ? 'FOUND ✓' : 'NOT FOUND ⚠'}`);
    }

    // Test filter interaction
    const firstSelect = page.locator('select, [role="combobox"]').first();
    if (await firstSelect.count() > 0) {
      await firstSelect.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'inventory-filter-open.png'), fullPage: true });
      await page.keyboard.press('Escape');
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'inventory-details.png'), fullPage: true });
  });

  test('Phase 7: Add Entry Form Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Open add entry dialog
    await page.getByRole('button', { name: 'Log Entry' }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'form-dialog.png'), fullPage: true });

    // Analyze form fields via single evaluate to avoid detached-element issues
    const formInfo = await page.evaluate(() => {
      const fields: any[] = [];
      document.querySelectorAll('input, select, textarea').forEach((el, i) => {
        if (i >= 12) return;
        fields.push({
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || 'text',
          id: (el as HTMLInputElement).id || 'no-id',
          placeholder: (el as HTMLInputElement).placeholder || '',
          visible: (el as HTMLElement).offsetParent !== null,
        });
      });
      const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent?.trim()).filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 10);
      return { fields, labels, buttons };
    });
    console.log(`\n  Form fields found: ${formInfo.fields.length}`);
    formInfo.fields.forEach((f: any, i: number) => {
      console.log(`  [${i + 1}] <${f.tag} type="${f.type}" id="${f.id}"> placeholder="${f.placeholder}" visible=${f.visible}`);
    });
    console.log('  Labels:', formInfo.labels);
    console.log('  Buttons:', formInfo.buttons);

    // Check for validation
    const submitBtn = page.getByRole('button', { name: /Record|Save|Submit|Log Waste/i }).first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'form-validation.png'), fullPage: true });
    }

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Phase 8: Analytics Tab Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Analytics" }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'analytics-details.png'), fullPage: true });

    // Check for charts/graphs
    const charts = await page.locator('canvas, svg, [role="img"], .recharts-wrapper').count();
    console.log(`  Charts/graphs found: ${charts}`);

    // Check for export in analytics
    const exportBtn = page.locator('button:has-text("Export")');
    if (await exportBtn.count() > 0) {
      console.log('  Export button: FOUND ✓');
    }
  });

  test('Phase 9: Settings Tab Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'settings-details.png'), fullPage: true });

    // Check for settings options
    const settingsItems = await page.locator('button, [role="switch"], input[type="checkbox"]').count();
    console.log(`  Settings controls found: ${settingsItems}`);
  });

  test('Phase 10: Admin Tab Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Admin" }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-details.png'), fullPage: true });

    // Check admin features
    const adminElements = await page.locator('button, table, input').count();
    console.log(`  Admin page elements: ${adminElements}`);
  });

  test('Phase 11: Site Switcher Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');

    // Open site switcher
    await page.locator('button:has-text("Site")').first().click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'site-switcher-details.png'), fullPage: true });

    // Check available sites
    const siteItems = await page.locator('[role="menuitem"], button:has-text("Site")').count();
    console.log(`  Site items found: ${siteItems}`);
  });

  test('Phase 12: Export Functionality Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);

    // Open export dialog
    await page.locator('button:has-text("Export")').first().click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'export-dialog-details.png'), fullPage: true });

    // Check export options
    const exportOptions = await page.locator('button, [role="menuitem"], input[type="radio"]').count();
    console.log(`  Export options found: ${exportOptions}`);
  });

  test('Phase 13: Disposal History Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);

    // Scroll to disposal history
    await page.locator('text=Disposal History').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'disposal-history.png'), fullPage: true });

    // Check disposal history elements
    const disposalElements = await page.locator('text=/batch|approved|pending|rejected/i').count();
    console.log(`  Disposal history items: ${disposalElements}`);
  });

  test('Phase 14: Notifications / Alerts Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Open notifications
    const bellBtn = page.locator('button[aria-label*="Notification"], button:has(.icon-bell)').first();
    if (await bellBtn.count() > 0) {
      await bellBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'notifications-details.png'), fullPage: true });

      const alertCount = await page.locator('text=/overdue|warning|alert/i').count();
      console.log(`  Alert items found: ${alertCount}`);
    } else {
      console.log('  Notification button not found');
    }
  });

  test('Phase 15: PWA Manifest & Service Worker', async ({ page }) => {
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Check manifest
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;
      const response = await fetch(link.getAttribute('href')!);
      return response.json();
    }).catch(() => null);

    console.log('\n--- PWA MANIFEST ---');
    if (manifest) {
      console.log(`  Name: ${manifest.name}`);
      console.log(`  Short name: ${manifest.short_name}`);
      console.log(`  Display: ${manifest.display}`);
      console.log(`  Theme color: ${manifest.theme_color}`);
      console.log(`  Background color: ${manifest.background_color}`);
      console.log(`  Start URL: ${manifest.start_url}`);
      console.log(`  Icons: ${manifest.icons?.length || 0} icons`);
      console.log(`  Categories: ${manifest.categories?.join(', ') || 'none'}`);
    } else {
      console.log('  Manifest not found');
    }

    // Check service worker
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? 'Registered' : 'Not registered';
      }
      return 'Not supported';
    });
    console.log(`\n--- SERVICE WORKER ---`);
    console.log(`  Status: ${swRegistered}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'pwa-manifest.png'), fullPage: true });
  });

  test('Phase 16: Navigation & Routing Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test all routes
    const routes = ['/auth', '/app', '/reset-password', '/admin', '/nonexistent'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(500);
      const url = page.url();
      const title = await page.title();
      console.log(`  ${route} → ${url} (title: ${title})`);

      if (route === '/app') {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'route-app.png'), fullPage: true });
      } else if (route === '/auth') {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'route-auth.png'), fullPage: true });
      }
    }

    // Test browser back/forward
    await page.goto('/app');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Inventory' }).click();
    await page.waitForTimeout(500);
    await page.goBack();
    await page.waitForTimeout(500);
    const backUrl = page.url();
    console.log(`  Browser back: ${backUrl} (contains /app: ${backUrl.includes('/app')})`);
  });

  test('Phase 17: Error Handling Deep Dive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Test empty form submission
    await page.locator('button:has-text("Log Entry")').first().click();
    await page.waitForTimeout(500);

    // Try to submit empty form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Log Waste")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-empty-form.png'), fullPage: true });
      console.log('  Empty form submission tested');
    }

    await page.keyboard.press('Escape');

    // Test invalid input if possible
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-states.png'), fullPage: true });
  });

  test('Phase 18: Accessibility Spot Check', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Check for alt text on images
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.hasAttribute('alt')).length;
    });
    console.log(`  Images without alt text: ${imagesWithoutAlt}`);

    // Check for proper heading hierarchy
    const headings = await page.evaluate(() => {
      const hs = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return hs.map(h => `${h.tagName.toLowerCase()}: ${h.textContent?.trim().slice(0, 50)}`);
    });
    console.log(`  Heading structure (${headings.length} headings):`);
    headings.slice(0, 10).forEach(h => console.log(`    ${h}`));

    // Check for focus indicators
    const focusableElements = await page.evaluate(() => {
      return document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').length;
    });
    console.log(`  Focusable elements: ${focusableElements}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'accessibility-check.png'), fullPage: true });
  });

  test('Phase 19: Performance Metrics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const metrics = await page.evaluate(async () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        loadComplete: Math.round(nav.loadEventEnd),
        domInteractive: Math.round(nav.domInteractive),
        resources: performance.getEntriesByType('resource').length,
        jsSize: performance.getEntriesByType('resource')
          .filter(e => e.name.endsWith('.js'))
          .reduce((sum, e) => sum + (e as any).transferSize, 0),
        cssSize: performance.getEntriesByType('resource')
          .filter(e => e.name.endsWith('.css'))
          .reduce((sum, e) => sum + (e as any).transferSize, 0),
      };
    });

    console.log('\n--- PERFORMANCE METRICS ---');
    console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`  Load Complete: ${metrics.loadComplete}ms`);
    console.log(`  DOM Interactive: ${metrics.domInteractive}ms`);
    console.log(`  Resources loaded: ${metrics.resources}`);
    console.log(`  JS transfer size: ${Math.round(metrics.jsSize / 1024)}KB`);
    console.log(`  CSS transfer size: ${Math.round(metrics.cssSize / 1024)}KB`);
  });
});
