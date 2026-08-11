import { test, type Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../playwright/.auth/visual-ux-audit');
try { mkdirSync(OUT, { recursive: true }); } catch {}

const VIEWPORTS = [
  { label: '375x812', w: 375, h: 812 },
  { label: '390x844', w: 390, h: 844 },
  { label: '768x1024', w: 768, h: 1024 },
  { label: '1440x900', w: 1440, h: 900 },
] as const;

const snap = async (page: Page, name: string) => {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log(`📸 ${name}`);
};

const vp = async (page: Page, w: number, h: number) => {
  await page.setViewportSize({ width: w, height: h });
};

async function metrics(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, unknown> = {};

    // Typography
    out.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(
      (h) => ({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 60) })
    );

    // Buttons
    const buttons = Array.from(document.querySelectorAll('button'));
    out.buttonCount = buttons.length;
    out.buttonTexts = buttons.map((b) => (b.textContent || '').trim().slice(0, 40)).filter(Boolean);

    // Touch target analysis
    const targets = buttons.map((b) => {
      const r = (b as HTMLElement).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), text: (b.textContent || '').trim().slice(0, 20) };
    }).filter((t) => t.w > 0 && t.h > 0);
    out.tinyButtons = targets.filter((t) => t.h < 36 || t.w < 36).slice(0, 10);
    out.allButtonSizes = targets.slice(0, 15);

    // Cards
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], article'));
    out.cardCount = cards.length;
    out.cardStyles = cards.slice(0, 5).map((c) => {
      const s = getComputedStyle(c);
      return { radius: s.borderRadius, shadow: s.boxShadow, border: `${s.borderWidth} ${s.borderStyle} ${s.borderColor}` };
    });

    // Inputs
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    out.inputCount = inputs.length;
    out.inputStyles = inputs.slice(0, 5).map((i) => {
      const s = getComputedStyle(i);
      return { radius: s.borderRadius, border: s.borderColor, padding: s.padding };
    });

    // Colors
    const bgMap: Record<string, number> = {};
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      const bg = s.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        bgMap[bg] = (bgMap[bg] || 0) + 1;
      }
    });
    out.colors = Object.entries(bgMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Shadows
    const shadowMap: Record<string, number> = {};
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      const sh = s.boxShadow;
      if (sh && sh !== 'none') {
        shadowMap[sh] = (shadowMap[sh] || 0) + 1;
      }
    });
    out.shadows = Object.entries(shadowMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Overflow
    out.docOverflow = document.documentElement.scrollWidth > window.innerWidth;

    // Focus indicator
    const firstInput = document.querySelector('button, input, select');
    if (firstInput) {
      (firstInput as HTMLElement).focus();
      const s = getComputedStyle(firstInput as HTMLElement);
      out.focusIndicator = `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
    }

    return out;
  });
}

async function navMetrics(page: Page) {
  return page.evaluate(() => {
    const result: Record<string, unknown> = {};

    // Fixed elements
    const fixedEls = Array.from(document.querySelectorAll('[class*="fixed"], [style*="fixed"]'));
    result.fixedCount = fixedEls.length;
    result.fixedElements = fixedEls.map((el) => {
      const s = getComputedStyle(el);
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        classes: (el as HTMLElement).className?.slice(0, 100) || el.tagName,
        top: Math.round(r.top),
        left: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
        z: s.zIndex,
      };
    });

    // Bottom nav
    const bottomNav = document.querySelector('[class*="bottom"], [class*="BottomNav"]');
    result.bottomNav = bottomNav ? {
      visible: (bottomNav as HTMLElement).offsetParent !== null,
      h: Math.round((bottomNav as HTMLElement).getBoundingClientRect().height),
      classes: (bottomNav as HTMLElement).className?.slice(0, 120),
    } : null;

    // Top nav / tab bar
    const topNav = document.querySelector('nav, [class*="tab-bar"]');
    result.topNav = topNav ? {
      visible: (topNav as HTMLElement).offsetParent !== null,
      h: Math.round((topNav as HTMLElement).getBoundingClientRect().height),
      w: Math.round((topNav as HTMLElement).getBoundingClientRect().width),
    } : null;

    // Overlap detection
    if (result.bottomNav && result.topNav) {
      const topNavEl = topNav as HTMLElement;
      const bottomNavEl = bottomNav as HTMLElement;
      const topNavRect = topNavEl.getBoundingClientRect();
      const bottomNavRect = bottomNavEl.getBoundingClientRect();
      const headerBottom = topNavRect.bottom;
      const bottomNavTop = bottomNavRect.top;
      result.overlap = {
        headerBottom,
        bottomNavTop,
        gap: bottomNavTop - headerBottom,
        overlapping: bottomNavTop < headerBottom,
      };
    }

    return result;
  });
}

async function dialogMetrics(page: Page) {
  return page.evaluate(() => {
    const result: Record<string, unknown> = {};

    const dialog = document.querySelector('[role="dialog"], [data-state="open"], [class*="dialog"]');
    result.dialog = dialog
      ? {
          visible: (dialog as HTMLElement).offsetParent !== null,
          rect: (dialog as HTMLElement).getBoundingClientRect(),
          classes: (dialog as HTMLElement).className?.slice(0, 150),
        }
      : null;

    const backdrop = document.querySelector('[data-state="open"] > div, [class*="backdrop"]');
    if (backdrop) {
      const s = getComputedStyle(backdrop);
      result.backdrop = { opacity: s.opacity, bg: s.backgroundColor };
    }

    return result;
  });
}

async function loginIfNeeded(page: Page) {
  if (page.url().includes('/app')) return;
  await page.goto('/app');
  await page.waitForTimeout(800);
  if (page.url().includes('/app')) return;

  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', 'test_user@gmail.com');
  await page.fill('input#password', 'Renew#2@26');
  await page.click('button[type="submit"], button:has-text("Sign in")');
  await page.waitForURL('**/app', { timeout: 15_000 });
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Authentication', () => {
  test('auth screens at all viewports', async ({ page }) => {
    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/auth');
      await page.waitForTimeout(500);
      await snap(page, `auth-${size.label}.png`);

      const info = await page.evaluate(() => {
        const h = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).map((h) => h.textContent?.trim()),
          inputs: document.querySelectorAll('input').length,
          buttons: Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 8),
          formRect: h('form'),
          cardRect: h('[class*="card"], [class*="Card"]'),
          hasIllustration: !!document.querySelector('img, svg:not([aria-hidden]), [class*="illustration"]'),
          bodyBg: getComputedStyle(document.body).backgroundColor,
        };
      });

      console.log(`\n--- AUTH ${size.label} ---`);
      console.log('  Headings:', info.headings);
      console.log('  Inputs:', info.inputs);
      console.log('  Buttons:', info.buttons);
      console.log('  Viewport:', info.viewport);
      console.log('  Form rect:', info.formRect);
      console.log('  Card rect:', info.cardRect);
      console.log('  Illustration:', info.hasIllustration);
      console.log('  Body bg:', info.bodyBg);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Dashboard', () => {
  test('dashboard at all viewports with metrics', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(500);
      await snap(page, `dashboard-${size.label}.png`);

      if (size.label === '1440x900') {
        const m = await metrics(page);
        console.log('\n--- DASHBOARD METRICS (1440x900) ---');
        console.log('  Headings:', JSON.stringify((m.headings as Array<{tag: string; text: string}>).slice(0, 6)));
        console.log('  Button count:', m.buttonCount);
        console.log('  Tiny buttons:', m.tinyButtons);
        console.log('  All button sizes:', m.allButtonSizes);
        console.log('  Card count:', m.cardCount);
        console.log('  Card styles:', JSON.stringify(m.cardStyles));
        console.log('  Input count:', m.inputCount);
        console.log('  Input styles:', m.inputStyles);
        console.log('  Colors:', JSON.stringify(m.colors));
        console.log('  Shadows:', JSON.stringify(m.shadows));
        console.log('  Horizontal overflow:', m.docOverflow);
        console.log('  Focus indicator:', m.focusIndicator);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Navigation', () => {
  test('navigation analysis at all viewports, especially 768px', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(500);
      await snap(page, `nav-${size.label}.png`);

      const nav = await navMetrics(page);
      console.log(`\n--- NAVIGATION ${size.label} ---`);
      console.log('  Top nav:', JSON.stringify(nav.topNav));
      console.log('  Bottom nav:', JSON.stringify(nav.bottomNav));
      console.log('  Overlap:', JSON.stringify(nav.overlap));
      console.log('  Fixed elements count:', nav.fixedCount);
      console.log('  Viewport:', size.w, 'x', size.h);

      if (size.w === 768) {
        // Detailed 768px analysis
        console.log('\n  >>> 768px DETAILED NAVIGATION <<<');
        console.log('  This is the tablet breakpoint — checking for dead zones:');
        console.log('  Top nav visible:', nav.topNav && typeof nav.topNav === 'object' && 'visible' in nav.topNav ? nav.topNav.visible : 'N/A');
        console.log('  Bottom nav visible:', nav.bottomNav?.visible);
        console.log('  Overlap detected:', nav.overlap && typeof nav.overlap === 'object' && 'overlapping' in nav.overlap ? nav.overlap.overlapping : 'N/A');
        if (nav.overlap && typeof nav.overlap === 'object' && 'gap' in nav.overlap) {
          console.log('  Gap between navs:', nav.overlap.gap, 'px');
        }
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Inventory', () => {
  test('inventory at all viewports', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(800);

      // Navigate to inventory
      const invBtn = page.locator('button:has-text("Inventory"), nav button:has(.icon-list), [role="tab"]:has-text("Inventory")').first();
      if (await invBtn.count() > 0 && await invBtn.isVisible().catch(() => false)) {
        await invBtn.click();
        await page.waitForTimeout(800);
      }

      await snap(page, `inventory-${size.label}.png`);

      if (size.label === '1440x900') {
        const m = await metrics(page);
        console.log('\n--- INVENTORY METRICS (1440x900) ---');
        console.log('  Button count:', m.buttonCount);
        console.log('  Tiny buttons:', m.tinyButtons);
        console.log('  Card count:', m.cardCount);
        console.log('  Input count:', m.inputCount);
        console.log('  Input styles:', m.inputStyles);
        console.log('  Horizontal overflow:', m.docOverflow);
        console.log('  Colors:', JSON.stringify(m.colors));
        console.log('  Shadows:', JSON.stringify(m.shadows));
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADD WASTE FORM
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Add Waste Form', () => {
  test('add waste form at all viewports', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(600);

      // Open add entry dialog
      const addBtn = page.locator('button:has-text("Log Entry"), button:has(.icon-plus)').first();
      if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);
      }

      await snap(page, `form-${size.label}.png`);

      const dm = await dialogMetrics(page);
      console.log(`\n--- FORM DIALOG ${size.label} ---`);
      console.log('  Dialog:', dm.dialog ? { visible: dm.dialog.visible, w: Math.round(dm.dialog.rect?.width || 0), h: Math.round(dm.dialog.rect?.height || 0) } : 'null');
      console.log('  Backdrop:', dm.backdrop);

      const formInfo = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent?.trim()).filter(Boolean);
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map((el) => {
          const s = getComputedStyle(el);
          const r = (el as HTMLElement).getBoundingClientRect();
          return {
            id: (el as HTMLInputElement).id,
            type: (el as HTMLInputElement).type,
            placeholder: (el as HTMLInputElement).placeholder,
            w: Math.round(r.width),
            h: Math.round(r.height),
            radius: s.borderRadius,
          };
        });
        const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean);
        return { labels, inputs: inputs.slice(0, 15), buttons: buttons.slice(0, 10) };
      });
      console.log('  Labels:', formInfo.labels);
      console.log('  Inputs:', formInfo.inputs);
      console.log('  Buttons:', formInfo.buttons);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT DIALOG
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Export Dialog', () => {
  test('export dialog at all viewports', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(600);

      const invBtn = page.locator('button:has-text("Inventory")').first();
      if (await invBtn.count() > 0 && await invBtn.isVisible().catch(() => false)) {
        await invBtn.click();
        await page.waitForTimeout(800);
      }

      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.count() > 0 && await exportBtn.isVisible().catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(800);
        await snap(page, `export-${size.label}.png`);

        const dm = await dialogMetrics(page);
        console.log(`\n--- EXPORT DIALOG ${size.label} ---`);
        console.log('  Dialog:', dm.dialog ? { visible: dm.dialog.visible, w: Math.round(dm.dialog.rect?.width || 0), h: Math.round(dm.dialog.rect?.height || 0) } : 'null');
        console.log('  Backdrop:', dm.backdrop);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EDIT WASTE DIALOG
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Edit Waste Dialog', () => {
  test('edit dialog', async ({ page }) => {
    await loginIfNeeded(page);
    await vp(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(600);

    const invBtn = page.locator('button:has-text("Inventory"), nav button:has(.icon-list)').first();
    if (await invBtn.count() > 0 && await invBtn.isVisible().catch(() => false)) {
      await invBtn.click();
      await page.waitForTimeout(800);
    }

    const editBtn = page.locator('button[aria-label*="Edit"], button:has([class*="pencil"]), button:has([class*="edit"])').first();
    if (await editBtn.count() > 0 && await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'edit-dialog-desktop.png');
      const dm = await dialogMetrics(page);
      console.log('\n--- EDIT DIALOG ---');
      console.log('  Dialog:', dm.dialog ? { w: Math.round(dm.dialog.rect?.width || 0), h: Math.round(dm.dialog.rect?.height || 0) } : 'null');
    } else {
      console.log('  No edit button found (inventory may be empty)');
      await snap(page, 'edit-dialog-not-found.png');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Settings', () => {
  test('settings at all viewports', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(600);

      const settingsBtn = page.locator('button:has-text("Settings"), nav button:has(.icon-settings)').first();
      if (await settingsBtn.count() > 0 && await settingsBtn.isVisible().catch(() => false)) {
        await settingsBtn.click();
        await page.waitForTimeout(600);
      }
      await snap(page, `settings-${size.label}.png`);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Analytics', () => {
  test('analytics at all viewports', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of VIEWPORTS) {
      await vp(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(600);

      const analyticsBtn = page.locator('button:has-text("Analytics"), nav button:has(.icon-bar-chart)').first();
      if (await analyticsBtn.count() > 0 && await analyticsBtn.isVisible().catch(() => false)) {
        await analyticsBtn.click();
        await page.waitForTimeout(600);
      }
      await snap(page, `analytics-${size.label}.png`);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOADING & EMPTY STATES
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Loading & Empty States', () => {
  test('loading and empty states', async ({ page }) => {
    await vp(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(300);
    await snap(page, 'loading-initial.png');
    await page.waitForTimeout(500);
    await snap(page, 'loading-after-2s.png');

    const loadingInfo = await page.evaluate(() => {
      const spinners = document.querySelectorAll('[class*="animate-spin"], [class*="animate-pulse"], [class*="skeleton"]');
      return {
        count: spinners.length,
        html: spinners.length > 0 ? spinners[0].outerHTML.slice(0, 200) : 'none',
      };
    });
    console.log('\n--- LOADING STATES ---');
    console.log('  Spinners/skeletons:', loadingInfo.count);
    console.log('  HTML:', loadingInfo.html);
  });

  test('empty states', async ({ page }) => {
    await vp(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(500);
    await snap(page, 'empty-states.png');

    const emptyInfo = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return {
        hasNoEntries: /no entries|no data|empty/i.test(text),
        hasNoSites: /no site|request access/i.test(text),
        hasNoBatches: /no batch|no disposal/i.test(text),
        bodyTextSnippet: text.slice(0, 500),
      };
    });
    console.log('\n--- EMPTY STATES ---');
    console.log('  No entries:', emptyInfo.hasNoEntries);
    console.log('  No sites:', emptyInfo.hasNoSites);
    console.log('  No batches:', emptyInfo.hasNoBatches);
    console.log('  Body text:', emptyInfo.bodyTextSnippet);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PWA OFFLINE TEST
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — PWA Offline', () => {
  test('offline behavior', async ({ page }) => {
    await loginIfNeeded(page);
    await vp(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(500);

    console.log('\n--- PWA OFFLINE TEST ---');

    // SW status
    const swStatus = await page.evaluate(async () => {
      let state = 'unsupported';
      let scope = '';
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.active) {
            state = 'active';
            scope = reg.scope;
          } else if (reg) {
            state = 'pending';
            scope = reg.scope;
          } else {
            state = 'not-registered';
          }
        } catch (e) {
          state = 'error';
        }
      }
      return { state, scope };
    });
    console.log('  SW state:', swStatus.state);
    console.log('  SW scope:', swStatus.scope);

    // Manifest
    const manifest = await page.evaluate(() => {
      const m = document.querySelector('link[rel="manifest"]');
      return { hasManifest: !!m, href: m?.getAttribute('href') };
    });
    console.log('  Manifest:', manifest);

    // Cache check
    const cacheInfo = await page.evaluate(async () => {
      if ('caches' in window) {
        const names = await caches.keys();
        return { hasCaches: names.length > 0, count: names.length, names: names.slice(0, 5) };
      }
      return { hasCaches: false };
    });
    console.log('  Cache:', cacheInfo);

    // Screenshot online
    await snap(page, 'pwa-online.png');

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await snap(page, 'pwa-offline.png');

    const offlineInfo = await page.evaluate(() => {
      return {
        pageTitle: document.title,
        bodyText: document.body.textContent?.slice(0, 300),
        hasOfflineMsg: /offline|no connection|no internet/i.test(document.body.textContent || ''),
        docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log('  Offline title:', offlineInfo.pageTitle);
    console.log('  Offline msg:', offlineInfo.hasOfflineMsg);
    console.log('  Body text:', offlineInfo.bodyText);

    // Try navigation while offline
    try {
      await page.goto('/app', { timeout: 5000 });
      console.log('  Offline navigation: SUCCESS');
    } catch {
      console.log('  Offline navigation: FAILED');
    }
    await page.waitForTimeout(500);
    await snap(page, 'pwa-offline-navigated.png');

    // Back online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);
    await snap(page, 'pwa-online-again.png');
    console.log('  Back online');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 768px TABLET DEEP-DIVE
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — 768px Tablet Deep-Dive', () => {
  test('detailed 768px navigation and layout analysis', async ({ page }) => {
    await loginIfNeeded(page);
    await vp(page, 768, 1024);
    await page.goto('/app');
    await page.waitForTimeout(500);

    await snap(page, 'tablet-768-home.png');

    // Switch to inventory
    const invBtn = page.locator('nav button:has-text("Inventory")').first();
    if (await invBtn.count() > 0 && await invBtn.isVisible().catch(() => false)) {
      await invBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'tablet-768-inventory.png');
    } else {
      console.log('  Inventory button not visible at 768px');
      await snap(page, 'tablet-768-inventory-not-visible.png');
    }

    // Switch to analytics
    const analyticsBtn = page.locator('nav button:has-text("Analytics")').first();
    if (await analyticsBtn.count() > 0 && await analyticsBtn.isVisible().catch(() => false)) {
      await analyticsBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'tablet-768-analytics.png');
    } else {
      console.log('  Analytics button not visible at 768px');
      await snap(page, 'tablet-768-analytics-not-visible.png');
    }

    // Switch to settings
    const settingsBtn = page.locator('nav button:has-text("Settings")').first();
    if (await settingsBtn.count() > 0 && await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'tablet-768-settings.png');
    } else {
      console.log('  Settings button not visible at 768px');
      await snap(page, 'tablet-768-settings-not-visible.png');
    }

    // Final metrics
    const nav = await navMetrics(page);
    console.log('\n--- 768px TABLET ANALYSIS ---');
    console.log('  Top nav:', JSON.stringify(nav.topNav));
    console.log('  Bottom nav:', JSON.stringify(nav.bottomNav));
    console.log('  Overlap:', JSON.stringify(nav.overlap));
    console.log('  Fixed elements:', nav.fixedCount);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE METRICS
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Visual UX Audit — Full Metrics', () => {
  test('comprehensive visual metrics', async ({ page }) => {
    await loginIfNeeded(page);
    await vp(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(500);

    const m = await metrics(page);
    console.log('\n--- FULL APP METRICS (1440x900) ---');
    console.log('  Headings:', JSON.stringify((m.headings as Array<{tag: string; text: string}>).slice(0, 8)));
    console.log('  Button count:', m.buttonCount);
    console.log('  Tiny buttons:', m.tinyButtons);
    console.log('  Card count:', m.cardCount);
    console.log('  Input count:', m.inputCount);
    console.log('  Colors (top 5):', JSON.stringify((m.colors as Array<[string, number]>).slice(0, 5)));
    console.log('  Shadows:', JSON.stringify(m.shadows));
    console.log('  Horizontal overflow:', m.docOverflow);
    console.log('  Focus indicator:', m.focusIndicator);

    await snap(page, 'metrics-overview.png');
  });
});
