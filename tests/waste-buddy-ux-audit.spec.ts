import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../playwright/.auth/ux-audit');
const STORAGE_STATE_PATH = path.join(__dirname, '../playwright/.auth/user.json');

test.describe('Waste Buddy Tracker — UX/UI Quality Audit', () => {
  test.beforeAll(async () => {
    try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch (e) {}
  });

  test.beforeEach(async ({ context }) => {
    if (context && 'extendStorageState' in context) {
      await (context as any).extendStorageState?.(STORAGE_STATE_PATH);
    }
  });

  const takeScreenshot = async (page: any, name: string) => {
    const filePath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`  📸 ${name}`);
  };

  test('AUTH — Login Screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/auth');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '01-auth-desktop.png');

    // Evaluate auth screen UI
    const authUI = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).background;
      const card = document.querySelector('card, [class*="card"], form');
      return {
        bodyBackground: bg.slice(0, 100),
        hasCard: !!card,
        buttonText: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 10),
        inputCount: document.querySelectorAll('input').length,
        headingText: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).filter(Boolean),
      };
    });
    console.log('\n--- AUTH SCREEN UI ---');
    console.log('  Inputs:', authUI.inputCount);
    console.log('  Headings:', authUI.headingText);
    console.log('  Buttons:', authUI.buttonText.slice(0, 5));

    // Mobile auth
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/auth');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '02-auth-mobile-375.png');

    // Tablet auth
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/auth');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '03-auth-tablet-768.png');
  });

  test('DASHBOARD — Home Screen', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '04-dashboard-desktop.png');

    // Analyze dashboard
    const dashboardUI = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim().slice(0, 30),
        visible: b.offsetParent !== null,
        ariaLabel: b.getAttribute('aria-label'),
      })).filter(b => b.text);
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        tag: h.tagName,
        text: h.textContent?.trim().slice(0, 50),
      }));
      const colors = Array.from(document.querySelectorAll('[class*="bg-"], [class*="text-"]')).slice(0, 20).map(el => {
        const classes = String(el.className).match(/(bg-|text-)[\w-]+/g) || [];
        return classes.slice(0, 3).join(', ');
      });
      return {
        cardCount: cards.length,
        buttonCount: buttons.length,
        headingCount: headings.length,
        headings: headings.slice(0, 8),
        colorClasses: [...new Set(colors)].slice(0, 15),
      };
    });
    console.log('\n--- DASHBOARD UI ---');
    console.log('  Cards:', dashboardUI.cardCount);
    console.log('  Buttons:', dashboardUI.buttonCount);
    console.log('  Headings:', dashboardUI.headingCount);
    console.log('  Color system:', dashboardUI.colorClasses.join(' | '));

    // Mobile dashboard
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '05-dashboard-mobile-375.png');

    // Tablet dashboard
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '06-dashboard-tablet-768.png');

    // Check for horizontal scroll on mobile
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log('  Mobile horizontal scroll:', hasHorizontalScroll ? 'YES ⚠' : 'NO ✓');
  });

  test('INVENTORY — Waste Inventory Tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '07-inventory-desktop.png');

    // Analyze inventory UI
    const inventoryUI = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const rows = document.querySelectorAll('tr');
      const selects = document.querySelectorAll('select');
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().slice(0, 40)).filter(Boolean);
      return {
        tableCount: tables.length,
        rowCount: rows.length,
        selectCount: selects.length,
        buttons: buttons.slice(0, 15),
        hasScrollableArea: !!document.querySelector('[style*="overflow"], [class*="overflow"]'),
      };
    });
    console.log('\n--- INVENTORY UI ---');
    console.log('  Tables:', inventoryUI.tableCount);
    console.log('  Rows:', inventoryUI.rowCount);
    console.log('  Filters:', inventoryUI.selectCount);
    console.log('  Buttons:', inventoryUI.buttons.slice(0, 10));

    // Mobile inventory
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '08-inventory-mobile-375.png');

    // Tablet inventory
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '09-inventory-tablet-768.png');

    // Test table horizontal scroll
    const tableOverflow = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.map(t => ({
        width: t.scrollWidth,
        visibleWidth: t.clientWidth,
        overflows: t.scrollWidth > t.clientWidth,
      }));
    });
    console.log('  Table overflow:', tableOverflow);
  });

  test('ADD ENTRY — Form Dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');

    // Open add entry dialog
    const addButton = page.locator('button:has-text("Log Entry")').first();
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '10-form-desktop.png');

      // Analyze form
      const formUI = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          tag: el.tagName,
          type: (el as HTMLInputElement).type || 'text',
          id: (el as HTMLInputElement).id,
          placeholder: (el as HTMLInputElement).placeholder,
          visible: (el as HTMLElement).offsetParent !== null,
        }));
        const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent?.trim());
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().slice(0, 40)).filter(Boolean);
        return { inputs: inputs.slice(0, 10), labels: labels.slice(0, 10), buttons: buttons.slice(0, 5) };
      });
      console.log('\n--- FORM UI ---');
      console.log('  Inputs:', formUI.inputs.length);
      console.log('  Labels:', formUI.labels);
      console.log('  Buttons:', formUI.buttons);

      // Mobile form
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);
      await takeScreenshot(page, '11-form-mobile-375.png');

      // Tablet form
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      await takeScreenshot(page, '12-form-tablet-768.png');

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('FILTERS — Filter Controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);

    // Open first filter
    const firstFilter = page.locator('select, [role="combobox"]').first();
    if (await firstFilter.count() > 0) {
      await firstFilter.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '13-filters-desktop-open.png');
      await page.keyboard.press('Escape');

      // Check filter styling
      const filterUI = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select, [role="combobox"]'));
        return selects.map(s => ({
          tag: s.tagName,
          classes: s.className.slice(0, 100),
          visible: (s as HTMLElement).offsetParent !== null,
        }));
      });
      console.log('\n--- FILTERS UI ---');
      console.log('  Filter controls:', filterUI.length);
    }

    // Mobile filters
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, '14-filters-mobile-375.png');
  });

  test('EXPORT — Export Dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);

    // Open export dialog
    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.count() > 0) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '15-export-desktop.png');

      // Analyze export dialog
      const exportUI = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], [class*="dialog"], [class*="sheet"]');
        return {
          hasDialog: !!dialog,
          dialogClasses: dialog ? String(dialog.className).slice(0, 150) : null,
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 10),
        };
      });
      console.log('\n--- EXPORT UI ---');
      console.log('  Dialog present:', exportUI.hasDialog);
      console.log('  Buttons:', exportUI.buttons);

      await page.keyboard.press('Escape');
    }

    // Mobile export
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.getByRole("button", { name: "Inventory" }).click();
    await page.waitForTimeout(500);
    const exportBtnMobile = page.locator('button:has-text("Export")').first();
    if (await exportBtnMobile.count() > 0) {
      await exportBtnMobile.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '16-export-mobile-375.png');
      await page.keyboard.press('Escape');
    }
  });

  test('EMPTY STATES — Check for empty state handling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Check for empty states in various sections
    const emptyStates = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return {
        hasNoEntriesMessage: /no entries|no data|empty|nothing here/i.test(text),
        hasNoSitesMessage: /no site|request access/i.test(text),
        hasNoBatchesMessage: /no disposal|no batch/i.test(text),
      };
    });
    console.log('\n--- EMPTY STATES ---');
    console.log('  No entries message:', emptyStates.hasNoEntriesMessage ? 'YES' : 'NO');
    console.log('  No sites message:', emptyStates.hasNoSitesMessage ? 'YES' : 'NO');
    console.log('  No batches message:', emptyStates.hasNoBatchesMessage ? 'YES' : 'NO');

    await takeScreenshot(page, '17-empty-states.png');
  });

  test('LOADING STATES — Check loading indicators', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Reload to catch loading state
    await page.goto('/app');

    // Take screenshot immediately to catch loading
    await page.waitForTimeout(500);
    const loadingUI = await page.evaluate(() => {
      const spinners = document.querySelectorAll('[class*="spin"], [class*="loader"], [class*="loading"]');
      const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="placeholder"]');
      return {
        spinnerCount: spinners.length,
        skeletonCount: skeletons.length,
        hasLoader: spinners.length > 0 || skeletons.length > 0,
      };
    });
    console.log('\n--- LOADING STATES ---');
    console.log('  Spinners:', loadingUI.spinnerCount);
    console.log('  Skeletons:', loadingUI.skeletonCount);

    await page.waitForTimeout(500);
    await takeScreenshot(page, '18-loading-states.png');
  });

  test('ERROR STATES — Check error handling UI', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');

    // Try to trigger error state
    const addButton = page.locator('button:has-text("Log Entry")').first();
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Submit empty form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Log Waste")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '19-error-states.png');

        const errorUI = await page.evaluate(() => {
          const errors = document.querySelectorAll('[class*="error"], [class*="invalid"], [role="alert"]');
          return {
            errorCount: errors.length,
            errorTexts: Array.from(errors).map(e => e.textContent?.trim().slice(0, 100)).filter(Boolean),
          };
        });
        console.log('\n--- ERROR STATES ---');
        console.log('  Error elements:', errorUI.errorCount);
        console.log('  Error messages:', errorUI.errorTexts);
      }

      await page.keyboard.press('Escape');
    }
  });

  test('NAVIGATION — Test navigation patterns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Test desktop navigation
    const navUI = await page.evaluate(() => {
      const navs = document.querySelectorAll('nav');
      const navButtons = Array.from(document.querySelectorAll('nav button')).map(b => b.textContent?.trim()).filter(Boolean);
      return {
        navCount: navs.length,
        navButtons: navButtons,
        fixedElements: Array.from(document.querySelectorAll('[class*="fixed"], [style*="fixed"]')).map(el => el.className.slice(0, 50)),
      };
    });
    console.log('\n--- NAVIGATION UI ---');
    console.log('  Nav elements:', navUI.navCount);
    console.log('  Nav buttons:', navUI.navButtons);
    console.log('  Fixed elements:', navUI.fixedElements.length);

    await takeScreenshot(page, '20-navigation-desktop.png');

    // Test mobile navigation
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '21-navigation-mobile-375.png');

    const mobileNav = await page.evaluate(() => {
      const bottomNav = document.querySelector('[class*="bottom"], nav[class*="fixed"]');
      const fab = document.querySelector('button:has(.icon-plus), [class*="fab"]');
      return {
        hasBottomNav: !!bottomNav,
        hasFAB: !!fab,
        bottomNavVisible: bottomNav ? (bottomNav as HTMLElement).offsetParent !== null : false,
      };
    });
    console.log('  Mobile bottom nav:', mobileNav.hasBottomNav ? 'PRESENT' : 'MISSING');
    console.log('  Mobile FAB:', mobileNav.hasFAB ? 'PRESENT' : 'MISSING');
  });

  test('768px TABLET — Navigation investigation', async ({ page }) => {
    // This test specifically investigates the 768px navigation issue
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    const navAnalysis = await page.evaluate(() => {
      const desktopNav = document.querySelector('nav[class*="hidden lg:flex"], nav.lg\\:flex');
      const bottomNav = document.querySelector('nav[class*="fixed bottom"], .lg\\:hidden');
      const allNavs = Array.from(document.querySelectorAll('nav'));
      const allButtons = Array.from(document.querySelectorAll('nav button')).map(b => ({
        text: b.textContent?.trim().slice(0, 30),
        visible: (b as HTMLElement).offsetParent !== null,
        classes: b.className.slice(0, 100),
      }));

      return {
        desktopNavExists: !!desktopNav,
        desktopNavVisible: desktopNav ? (desktopNav as HTMLElement).offsetParent !== null : false,
        bottomNavExists: !!bottomNav,
        bottomNavVisible: bottomNav ? (bottomNav as HTMLElement).offsetParent !== null : false,
        totalNavs: allNavs.length,
        navButtons: allButtons,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });

    console.log('\n--- 768px NAVIGATION INVESTIGATION ---');
    console.log('  Viewport:', navAnalysis.viewportWidth, 'x', navAnalysis.viewportHeight);
    console.log('  Desktop nav exists:', navAnalysis.desktopNavExists);
    console.log('  Desktop nav visible:', navAnalysis.desktopNavVisible);
    console.log('  Bottom nav exists:', navAnalysis.bottomNavExists);
    console.log('  Bottom nav visible:', navAnalysis.bottomNavVisible);
    console.log('  Total navs:', navAnalysis.totalNavs);
    console.log('  Nav buttons:', navAnalysis.navButtons.map(b => `${b.text} (${b.visible ? 'visible' : 'hidden'})`));

    await takeScreenshot(page, '22-tablet-768-navigation.png');

    // Try clicking navigation at tablet size
    const inventoryBtn = page.getByRole("button", { name: "Inventory" });
    if (await inventoryBtn.count() > 0) {
      const isVisible = await inventoryBtn.isVisible();
      console.log('  Inventory button visible:', isVisible);
      if (isVisible) {
        await inventoryBtn.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '23-tablet-768-inventory.png');
      }
    }
  });

  test('PWA — Offline Capability Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Verify service worker and cache
    const pwaInfo = await page.evaluate(async () => {
      const info: any = {};

      // Check service worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        info.swRegistered = !!reg;
        info.swScope = reg?.scope;
        info.swActive = reg?.active?.state;
      } else {
        info.swSupported = false;
      }

      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      info.hasManifest = !!manifestLink;

      // Check cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        info.cacheNames = cacheNames;
        info.hasCaches = cacheNames.length > 0;
      }

      // Check localStorage (auth state)
      info.hasLocalStorage = !!localStorage.getItem('sb-oakjtbkxjhxoeyaapibo-auth-token');

      return info;
    });

    console.log('\n--- PWA OFFLINE CAPABILITY ---');
    console.log('  Service Worker:', pwaInfo.swRegistered ? 'REGISTERED' : 'NOT REGISTERED');
    console.log('  SW Active:', pwaInfo.swActive);
    console.log('  Manifest:', pwaInfo.hasManifest ? 'PRESENT' : 'MISSING');
    console.log('  Cache:', pwaInfo.hasCaches ? `${pwaInfo.cacheNames?.length} caches` : 'NONE');
    console.log('  Auth in localStorage:', pwaInfo.hasLocalStorage ? 'YES' : 'NO');

    // Test offline behavior
    console.log('\n  Testing offline behavior...');
    await page.context().setOffline(true);
    await page.waitForTimeout(300);

    // Try to navigate while offline — expect it may fail due to no network
    let navigationResult: 'success' | 'expected-offline-error' | 'unexpected-error' = 'success';
    try {
      await page.goto('/app', { timeout: 8000 });
    } catch (e: any) {
      if (e?.message?.includes('ERR_INTERNET_DISCONNECTED') || e?.message?.includes('net::')) {
        navigationResult = 'expected-offline-error';
      } else {
        navigationResult = 'unexpected-error';
        throw e;
      }
    }
    console.log('  Navigation offline:', navigationResult);
    await page.waitForTimeout(300);
    await takeScreenshot(page, '24-offline.png');

    const offlineURL = page.url();
    console.log('  Offline URL:', offlineURL);
    console.log('  App loads offline:', offlineURL.includes('/app') ? 'YES ✓' : 'NO ⚠');

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);
    console.log('  ✓ Back online');

    await takeScreenshot(page, '25-online-again.png');
  });

  test('TOUCH TARGETS — Check button sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    const touchTargets = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      return buttons.map(btn => {
        const rect = btn.getBoundingClientRect();
        const minSize = 44; // iOS HIG minimum
        const meetsMinimum = rect.width >= minSize && rect.height >= minSize;
        return {
          text: (btn.textContent?.trim() || btn.getAttribute('aria-label') || 'icon').slice(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          meetsMinimum,
        };
      }).filter(t => t.width > 0 && t.height > 0).slice(0, 20);
    });

    const smallTargets = touchTargets.filter(t => !t.meetsMinimum);
    console.log('\n--- TOUCH TARGETS (Mobile 375x812) ---');
    console.log('  Total targets:', touchTargets.length);
    console.log('  Meeting 44x44 minimum:', touchTargets.filter(t => t.meetsMinimum).length);
    console.log('  Below minimum:', smallTargets.length);
    if (smallTargets.length > 0) {
      console.log('  Small targets:', smallTargets.map(t => `${t.text} (${t.width}x${t.height})`));
    }
  });

  test('VISUAL POLISH — Consistency check', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(500);

    const polishCheck = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]')).slice(0, 10);
      const buttons = Array.from(document.querySelectorAll('button')).slice(0, 10);

      // Check border radius consistency
      const radii = new Set(Array.from(cards).map(c => {
        const style = getComputedStyle(c);
        return style.borderRadius;
      }));

      // Check for box shadows
      const shadows = new Set(Array.from(cards).map(c => {
        const style = getComputedStyle(c);
        return style.boxShadow === 'none' ? 'none' : 'has-shadow';
      }));

      // Check transitions
      const transitions = new Set(Array.from(buttons).map(b => {
        const style = getComputedStyle(b);
        return style.transition === 'none' ? 'none' : 'has-transition';
      }));

      return {
        cardCount: cards.length,
        uniqueRadii: Array.from(radii),
        hasShadows: Array.from(shadows),
        hasTransitions: Array.from(transitions),
        buttonCount: buttons.length,
      };
    });

    console.log('\n--- VISUAL POLISH ---');
    console.log('  Cards analyzed:', polishCheck.cardCount);
    console.log('  Border radii:', polishCheck.uniqueRadii.join(', ') || 'none');
    console.log('  Shadows:', polishCheck.hasShadows.join(', ') || 'none');
    console.log('  Transitions:', polishCheck.hasTransitions.join(', ') || 'none');

    await takeScreenshot(page, '26-visual-polish.png');
  });
});
