import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../playwright/.auth/ux-audit');

try { mkdirSync(OUT_DIR, { recursive: true }); } catch {}

// ── Helpers ──────────────────────────────────────────────────────────────────
const snap = async (page: Page, name: string) => {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
  console.log(`  📸 ${name}`);
};

const viewportSets = [
  { label: 'mobile-375', w: 375, h: 812 },
  { label: 'mobile-390', w: 390, h: 844 },
  { label: 'tablet-768', w: 768, h: 1024 },
  { label: 'desktop-1440', w: 1440, h: 900 },
] as const;

const setVP = async (page: Page, w: number, h: number) => {
  await page.setViewportSize({ width: w, height: h });
};

// ── Metric collectors ────────────────────────────────────────────────────────
async function collectMetrics(page: Page) {
  return page.evaluate(() => {
    // Typography
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const bodySize = parseFloat(getComputedStyle(document.body).fontSize);

    // Buttons
    const buttons = Array.from(document.querySelectorAll('button:not([disabled])'));
    const btnSizes = buttons.map(b => {
      const r = b.getBoundingClientRect();
      return { w: r.width, h: r.height, text: (b.textContent || '').trim().slice(0, 30) };
    });
    const tinyButtons = btnSizes.filter(b => b.h < 36 || b.w < 36);

    // Cards
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="rounded-"], article');
    const cardBorders = Array.from(cards).slice(0, 5).map(c => {
      const s = getComputedStyle(c);
      return { radius: s.borderRadius, borderWidth: s.borderWidth, shadow: s.boxShadow };
    });

    // Focus indicators
    const focusable = Array.from(document.querySelectorAll('button, input, select, a, [tabindex]'));
    const firstFocusable = focusable[0];
    let focusOutline = 'none';
    if (firstFocusable) {
      firstFocusable.focus();
      const s = getComputedStyle(firstFocusable);
      focusOutline = `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
    }

    // Inputs
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    const inputStyles = inputs.slice(0, 5).map(i => {
      const s = getComputedStyle(i);
      return { radius: s.borderRadius, border: s.borderColor, padding: s.padding };
    });

    // Colors used
    const bgElements = Array.from(document.querySelectorAll('[class*="bg-"]'));
    const bgColors = [...new Set(bgElements.map(e => {
      const m = e.className.match(/bg-[\w-]+/g);
      return m ? m.join(',') : '';
    }).filter(Boolean))].slice(0, 15);

    // Shadow usage
    const shadowElements = Array.from(document.querySelectorAll('[class*="shadow"]'));
    const shadowClasses = [...new Set(shadowElements.map(e => {
      const m = e.className.match(/shadow-[\w-]+/g);
      return m ? m.join(',') : '';
    }).filter(Boolean))].slice(0, 10);

    // Horizontal overflow
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth;

    // Z-index stacking
    const zIndexes = Array.from(document.querySelectorAll('[style*="z-index"]')).map(e =>
      (e as HTMLElement).style.zIndex
    ).filter(Boolean);

    return {
      bodyFont,
      bodySize,
      headingCount: headings.length,
      buttonCount: buttons.length,
      tinyButtons: tinyButtons.length,
      tinyButtonDetails: tinyButtons.slice(0, 5),
      cardBorders,
      focusOutline,
      inputCount: inputs.length,
      inputStyles,
      bgColors,
      shadowClasses,
      docOverflow,
      zIndexes,
    };
  });
}

async function collectDialogMetrics(page: Page) {
  return page.evaluate(() => {
    // Dialog / overlay
    const overlay = document.querySelector('[data-state="open"], [role="dialog"], [class*="dialog"]');
    const overlayStyle = overlay
      ? {
          visible: (overlay as HTMLElement).offsetParent !== null,
          rect: (overlay as HTMLElement).getBoundingClientRect(),
          classes: (overlay as HTMLElement).className ? String((overlay as HTMLElement).className).slice(0, 200) : '',
        }
      : null;

    // Backdrops
    const backdrops = document.querySelectorAll('[class*="backdrop"], [data-state="open"] > div');
    const backdropOpacity = Array.from(backdrops).map(d => {
      const s = getComputedStyle(d);
      return { opacity: s.opacity, bg: s.backgroundColor };
    });

    // Close buttons
    const closeButtons = Array.from(document.querySelectorAll('button[aria-label="Close"], button:has([class*="close"]), button svg[class*="close"]'));
    const closeInfo = closeButtons.map(b => ({
      text: b.textContent?.trim().slice(0, 20),
      visible: (b as HTMLElement).offsetParent !== null,
      rect: b.getBoundingClientRect(),
    }));

    // Input focus ring
    const inputs = document.querySelectorAll('input, select, textarea');
    let focusRing = 'none';
    if (inputs.length) {
      (inputs[0] as HTMLElement).focus();
      const s = getComputedStyle(inputs[0] as HTMLElement);
      focusRing = `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
    }

    return {
      overlay: overlayStyle,
      backdropCount: backdrops.length,
      backdropOpacity: backdropOpacity.slice(0, 3),
      closeButtons: closeInfo.length,
      closeInfo: closeInfo.slice(0, 5),
      focusRing,
    };
  });
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function loginIfNeeded(page: Page) {
  // Already authenticated?
  if (page.url().includes('/app')) return;

  // Try /app first — stored auth state may still be valid
  await page.goto('/app');
  await page.waitForTimeout(500);
  if (page.url().includes('/app')) return;

  // Need to log in — navigate to auth page
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });

  // Check if we're on login or signup
  const isSignup = await page.locator('text=/Create account/i').count();
  if (isSignup > 0) {
    // Click "Already have an account? Sign in"
    await page.click('text=/Sign in/i').catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.fill('input[type="email"]', 'test_user@gmail.com');
  await page.fill('input#password', 'Renew#2@26');

  const submitBtn = page.locator('button[type="submit"]');
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await page.click('button:has-text("Sign in")');
  }

  await page.waitForURL(/\/app/, { timeout: 15_000 });
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Authentication', () => {
  test('auth screens across viewports', async ({ page }) => {
    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.goto('/auth');
      await page.waitForTimeout(500);
      await snap(page, `auth-${vp.label}.png`);

      const info = await page.evaluate(() => {
        const h = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent?.trim()),
          inputs: document.querySelectorAll('input').length,
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 5),
          formRect: h('form'),
          cardRect: h('[class*="card"], [class*="Card"]'),
          hasIllustration: !!document.querySelector('img, svg:not([aria-hidden]), [class*="illustration"]'),
        };
      });
      console.log(`\n--- AUTH ${vp.label} ---`);
      console.log('  Headings:', info.headings);
      console.log('  Inputs:', info.inputs);
      console.log('  Buttons:', info.buttons);
      console.log('  Viewport:', info.viewport);
      console.log('  Form rect:', info.formRect);
      console.log('  Card rect:', info.cardRect);
      console.log('  Has illustration:', info.hasIllustration);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (Home)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Dashboard', () => {
  test('dashboard across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    // Force home tab
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);
      await snap(page, `dashboard-${vp.label}.png`);

      if (vp.label === 'desktop-1440') {
        const m = await collectMetrics(page);
        console.log(`\n--- DASHBOARD METRICS ---`);
        console.log('  Body font:', m.bodyFont, 'size:', m.bodySize);
        console.log('  Buttons:', m.buttonCount, 'tiny:', m.tinyButtons);
        console.log('  Tiny buttons:', m.tinyButtonDetails);
        console.log('  Cards (first 3):', m.cardBorders.slice(0, 3));
        console.log('  Focus outline:', m.focusOutline);
        console.log('  Inputs:', m.inputCount);
        console.log('  BG colors:', m.bgColors);
        console.log('  Shadows:', m.shadowClasses);
        console.log('  Horizontal overflow:', m.docOverflow);
        console.log('  Z-indexes:', m.zIndexes);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Inventory', () => {
  test('inventory across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(800);

      // Click Inventory tab
      const invTab = page.locator('button:has-text("Inventory"), nav button:has(.icon-list), [role="tab"]:has-text("Inventory")').first();
      if (await invTab.count() > 0 && await invTab.isVisible().catch(() => false)) {
        await invTab.click();
        await page.waitForTimeout(500);
      }

      await snap(page, `inventory-${vp.label}.png`);

      if (vp.label === 'desktop-1440') {
        const m = await collectMetrics(page);
        console.log(`\n--- INVENTORY METRICS ---`);
        console.log('  Buttons:', m.buttonCount);
        console.log('  Tiny buttons:', m.tinyButtons);
        console.log('  Tiny button details:', m.tinyButtonDetails);
        console.log('  Card borders:', m.cardBorders.slice(0, 3));
        console.log('  Horizontal overflow:', m.docOverflow);
        console.log('  BG colors:', m.bgColors);
        console.log('  Shadows:', m.shadowClasses);
        console.log('  Input styles:', m.inputStyles.slice(0, 3));
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// WASTE ENTRY FORM DIALOG
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Log Entry Form Dialog', () => {
  test('form dialog across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);

      // Open dialog
      const addBtn = page.locator('button:has-text("Log Entry")').first();
      if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);
      } else {
        // Try bottom nav + button
        const bottomAdd = page.locator('button:has(.icon-plus)').first();
        if (await bottomAdd.count() > 0 && await bottomAdd.isVisible().catch(() => false)) {
          await bottomAdd.click();
          await page.waitForTimeout(800);
        }
      }

      await snap(page, `form-dialog-${vp.label}.png`);

      // Analyze dialog
      const dm = await collectDialogMetrics(page);
      console.log(`\n--- FORM DIALOG ${vp.label} ---`);
      console.log('  Overlay:', dm.overlay ? { visible: dm.overlay.visible, w: Math.round(dm.overlay.rect?.width || 0), h: Math.round(dm.overlay.rect?.height || 0) } : 'null');
      console.log('  Backdrops:', dm.backdropCount);
      console.log('  Close buttons:', dm.closeButtons);
      console.log('  Focus ring:', dm.focusRing);

      // Get input labels
      const formInfo = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent?.trim()).filter(Boolean);
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            id: (el as HTMLInputElement).id,
            type: (el as HTMLInputElement).type,
            placeholder: (el as HTMLInputElement).placeholder,
            w: Math.round(r.width),
            h: Math.round(r.height),
            padding: s.padding,
            radius: s.borderRadius,
          };
        });
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean);
        return { labels, inputs: inputs.slice(0, 12), buttons };
      });
      console.log('  Labels:', formInfo.labels);
      console.log('  Inputs:', formInfo.inputs);
      console.log('  Buttons:', formInfo.buttons.slice(0, 10));

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT DIALOG (reference — already looks good)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Export Dialog', () => {
  test('export dialog across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);

      // Click Inventory tab (use visible-only selector)
      const invTab = page.getByRole('button', { name: 'Inventory' });
      if (await invTab.count() > 0) await invTab.click();
      await page.waitForTimeout(800);

      // Open export
      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.count() > 0 && await exportBtn.isVisible().catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(800);
        await snap(page, `export-${vp.label}.png`);

        const dm = await collectDialogMetrics(page);
        console.log(`\n--- EXPORT DIALOG ${vp.label} ---`);
        console.log('  Overlay:', dm.overlay ? { visible: dm.overlay.visible, w: Math.round(dm.overlay.rect?.width || 0), h: Math.round(dm.overlay.rect?.height || 0) } : 'null');
        console.log('  Backdrops:', dm.backdropCount);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION (768px issue)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Navigation', () => {
  test('navigation at every breakpoint, especially 768px', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);

      const navInfo = await page.evaluate(() => {
        // Bottom nav
        const bottomNav = document.querySelector('[class*="bottom"], [class*="BottomNav"]');

        const visibleBottom = bottomNav ? (bottomNav as HTMLElement).offsetParent !== null : false;

        const navButtons = Array.from(document.querySelectorAll('nav button, [class*="bottom"] button')).map(b => ({
          text: (b.textContent || '').trim().slice(0, 20),
          visible: (b as HTMLElement).offsetParent !== null,
        }));

        // Check for duplicate navs
        const allNavs = document.querySelectorAll('nav, [role="navigation"], [class*="nav"]');
        const navRects = Array.from(allNavs).map(n => {
          const r = (n as HTMLElement).getBoundingClientRect();
          return { tag: n.tagName, top: r.top, w: r.width, visible: r.width > 0 && r.height > 0 };
        });

        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          topNavVisible: false,
          bottomNavVisible: visibleBottom,
          navButtons,
          navRectCount: navRects.filter(n => n.visible).length,
          navRects: navRects.filter(n => n.visible).slice(0, 5),
          hasDuplicateNav: navRects.filter(n => n.visible).length > 1,
        };
      });

      console.log(`\n--- NAVIGATION ${vp.label} ---`);
      console.log('  Top nav visible:', navInfo.topNavVisible);
      console.log('  Bottom nav visible:', navInfo.bottomNavVisible);
      console.log('  Nav buttons:', navInfo.navButtons);
      console.log('  Visible navs count:', navInfo.navRectCount);
      console.log('  Nav rects:', navInfo.navRects);
      console.log('  Duplicate navs:', navInfo.hasDuplicateNav);
      console.log('  Viewport:', navInfo.viewport);

      await snap(page, `navigation-${vp.label}.png`);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OFFLINE / PWA
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Offline / PWA', () => {
  test('offline behavior', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    console.log('\n--- PWA / OFFLINE ---');

    // Check SW registration
    const swInfo = await page.evaluate(async () => {
      let sw: ServiceWorker | null = null;
      let state = 'unsupported';
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            sw = reg.active;
            state = reg.active ? 'active' : 'pending';
          } else {
            state = 'not-registered';
          }
        } catch (e) {
          state = 'error: ' + (e as Error).message;
        }
      }
      return {
        swSupported: 'serviceWorker' in navigator,
        swState: state,
        swScope: sw?.scope,
        swScriptURL: sw?.scriptURL,
      };
    });
    console.log('  SW supported:', swInfo.swSupported);
    console.log('  SW state:', swInfo.swState);
    console.log('  SW scope:', swInfo.swScope);
    console.log('  SW script:', swInfo.swScriptURL);

    // Check web app manifest
    const manifest = await page.evaluate(() => {
      const m = document.querySelector('link[rel="manifest"]');
      return {
        hasManifest: !!m,
        href: m?.getAttribute('href'),
      };
    });
    console.log('  Manifest:', manifest);

    // Check install prompt component
    const installInfo = await page.evaluate(() => {
      const el = document.querySelector('[class*="install"], [class*="Install"]');
      return {
        hasInstallPrompt: !!el,
        beforeInstallPrompt: 'onbeforeinstallprompt' in window,
      };
    });
    console.log('  Install prompt:', installInfo);

    // Take online screenshot
    await snap(page, 'pwa-online.png');

    // Go offline using current Playwright context API
    await page.context().setOffline(true);
    await page.waitForTimeout(300);
    await snap(page, 'pwa-offline.png');

    const offlineBehavior = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      return {
        pageTitle: document.title,
        hasOfflineMessage: /offline|no connection|no internet/i.test(bodyText),
        hasErrorOverlay: !!document.querySelector('[class*="error"], [class*="Error"], .crash'),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log('  Offline title:', offlineBehavior.pageTitle);
    console.log('  Offline message:', offlineBehavior.hasOfflineMessage);
    console.log('  Error overlay:', offlineBehavior.hasErrorOverlay);
    console.log('  Overflow when offline:', offlineBehavior.docOverflow);

    // Try navigation while offline — expect it may fail due to no network
    let navigationOfflineResult = 'skipped';
    try {
      await page.goto('/app', { timeout: 8000 });
      navigationOfflineResult = 'served-from-cache';
    } catch (e: any) {
      // ERR_INTERNET_DISCONNECTED is expected when offline
      if (e?.message?.includes('ERR_INTERNET_DISCONNECTED')) {
        navigationOfflineResult = 'expected-offline-error';
      } else {
        navigationOfflineResult = 'unexpected-error: ' + (e?.message?.slice(0, 60) || '');
      }
    }
    console.log('  Navigation offline:', navigationOfflineResult);

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);
    await snap(page, 'pwa-back-online.png');

    console.log('  PWA offline test complete');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOADING & EMPTY STATES
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Loading & Empty States', () => {
  test('loading state capture', async ({ page }) => {
    await setVP(page, 1440, 900);

    // Reload to catch loading spinner
    await page.goto('/app');
    await page.waitForTimeout(300);
    await snap(page, 'loading-initial.png');
    await page.waitForTimeout(500);
    await snap(page, 'loading-after-1.5s.png');

    const loadingInfo = await page.evaluate(() => {
      const spinners = document.querySelectorAll('[class*="animate-spin"], [class*="animate-pulse"], [class*="skeleton"]');
      return {
        spinnerCount: spinners.length,
        spinnerHTML: spinners.length > 0 ? spinners[0].outerHTML.slice(0, 200) : 'none',
      };
    });
    console.log('\n--- LOADING ---');
    console.log('  Spinners:', loadingInfo.spinnerCount);
  });

  test('error state — validation errors', async ({ page }) => {
    await setVP(page, 1440, 900);
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Open form and submit empty
    const addBtn = page.locator('button:has-text("Log Entry")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);

      const submitBtn = page.locator('button:has-text("Log Waste"), button[type="submit"]').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        await snap(page, 'error-validation.png');

        const errorInfo = await page.evaluate(() => {
          const errors = document.querySelectorAll('[class*="error"], [class*="destructive"], [role="alert"]');
          const errorTexts = Array.from(errors).map(e => e.textContent?.trim()).filter(Boolean);
          const inputBorders = Array.from(document.querySelectorAll('input:invalid, input[aria-invalid="true"]')).map(i => {
            const s = getComputedStyle(i);
            return { borderColor: s.borderColor, boxShadow: s.boxShadow };
          });
          return {
            errorCount: errors.length,
            errorTexts: errorTexts.slice(0, 10),
            invalidInputs: inputBorders.length,
            inputBorderErrors: inputBorders.slice(0, 5),
          };
        });
        console.log('\n--- VALIDATION ERRORS ---');
        console.log('  Errors:', errorInfo.errorCount);
        console.log('  Error texts:', errorInfo.errorTexts);
        console.log('  Invalid inputs:', errorInfo.invalidInputs);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Analytics', () => {
  test('analytics across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);

      const analyticsTab = page.locator('button:has-text("Analytics"), nav button:has(.icon-bar-chart)').first();
      if (await analyticsTab.count() > 0 && await analyticsTab.isVisible().catch(() => false)) {
        await analyticsTab.click();
        await page.waitForTimeout(500);
      }
      await snap(page, `analytics-${vp.label}.png`);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Settings', () => {
  test('settings across viewports', async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto('/app');
    await page.waitForTimeout(500);

    for (const vp of viewportSets) {
      await setVP(page, vp.w, vp.h);
      await page.waitForTimeout(500);

      const settingsTab = page.locator('button:has-text("Settings"), nav button:has(.icon-settings)').first();
      if (await settingsTab.count() > 0 && await settingsTab.isVisible().catch(() => false)) {
        await settingsTab.click();
        await page.waitForTimeout(500);
      }
      await snap(page, `settings-${vp.label}.png`);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 768px TABLET NAVIGATION FOCUS TEST
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — 768px Navigation Deep-Dive', () => {
  test('detailed navigation analysis at 768px', async ({ page }) => {
    await loginIfNeeded(page);
    await setVP(page, 768, 1024);
    await page.goto('/app');
    await page.waitForTimeout(500);

    await snap(page, 'nav-768-initial.png');

    const navDetail = await page.evaluate(() => {
      const result: any = {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        header: null,
        tabBar: null,
        bottomNav: null,
        allFixed: [],
        overlapped: [],
        visibleHeader: false,
        visibleTabBar: false,
        visibleBottomNav: false,
      };

      // Fixed elements
      const fixedEls = Array.from(document.querySelectorAll('[class*="fixed"]'));
      fixedEls.forEach(el => {
        const s = getComputedStyle(el);
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          result.allFixed.push({
            classes: (el as HTMLElement).className?.slice(0, 120) || el.tagName,
            top: Math.round(r.top),
            left: Math.round(r.left),
            w: Math.round(r.width),
            h: Math.round(r.height),
            z: s.zIndex,
          });
        }
      });

      // Header
      const header = document.querySelector('header');
      if (header) {
        const r = (header as HTMLElement).getBoundingClientRect();
        result.header = { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), visible: r.height > 0 };
        result.visibleHeader = result.header.visible;
      }

      // Tab bar (desktop)
      const tabBar = document.querySelector('nav');
      if (tabBar) {
        const r = (tabBar as HTMLElement).getBoundingClientRect();
        result.tabBar = { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), visible: r.height > 0 };
        result.visibleTabBar = result.tabBar.visible;
      }

      // Bottom nav (mobile)
      const bottomNav = document.querySelector('[class*="bottom"]');
      if (bottomNav) {
        const r = (bottomNav as HTMLElement).getBoundingClientRect();
        result.bottomNav = { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), visible: r.height > 0 };
        result.visibleBottomNav = result.bottomNav.visible;
      }

      // Check for overlap between header and tab bar
      if (result.header && result.tabBar && result.header.visible && result.tabBar.visible) {
        const headerBottom = result.header.top + result.header.h;
        const tabBarTop = result.tabBar.top;
        result.overlapped.push({
          between: 'header → tabBar',
          gap: tabBarTop - headerBottom,
          overlapping: tabBarTop < headerBottom,
        });
      }

      // Check for overlap between header and bottom nav
      if (result.header && result.bottomNav && result.header.visible && result.bottomNav.visible) {
        result.overlapped.push({
          between: 'header → bottomNav',
          gap: result.bottomNav.top - (result.header.top + result.header.h),
          overlapping: result.bottomNav.top < result.header.top + result.header.h,
        });
      }

      // Tab bar width analysis
      const tabButtons = Array.from(document.querySelectorAll('nav button, [class*="tab-bar"] button')).map(b => ({
        text: (b.textContent || '').trim().slice(0, 20),
        visible: (b as HTMLElement).offsetParent !== null,
        w: Math.round((b as HTMLElement).getBoundingClientRect().width),
      }));

      result.tabButtons = tabButtons;
      result.tabButtonCount = tabButtons.length;
      result.tabButtonsVisible = tabButtons.filter(t => t.visible).length;

      return result;
    });

    console.log('\n--- 768px NAVIGATION DEEP-DIVE ---');
    console.log('  Header:', navDetail.header);
    console.log('  Tab bar:', navDetail.tabBar);
    console.log('  Bottom nav:', navDetail.bottomNav);
    console.log('  All fixed elements:', JSON.stringify(navDetail.allFixed, null, 2));
    console.log('  Overlaps:', navDetail.overlapped);
    console.log('  Tab buttons count:', navDetail.tabButtonCount);
    console.log('  Tab buttons visible:', navDetail.tabButtonsVisible);
    console.log('  Tab buttons:', navDetail.tabButtons);

    // Also test tab switching at 768px
    const tabSwitchResult = await page.evaluate(async () => {
      const results: any[] = [];
      const tabs = document.querySelectorAll('nav button, [class*="tab-bar"] button');
      for (const tab of tabs) {
        const text = (tab as HTMLElement).textContent?.trim().slice(0, 20);
        if (text && ['Home', 'Inventory', 'Analytics', 'Settings', 'Admin'].includes(text)) {
          (tab as HTMLElement).click();
          await new Promise(r => setTimeout(r, 500));
          const active = document.querySelector('[class*="border-accent"], [aria-selected="true"], .active');
          results.push({ tab: text, activeClass: active?.className?.slice(0, 80) });
        }
      }
      return results;
    });
    console.log('  Tab switching:', tabSwitchResult);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE METRICS SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Full App Metrics', () => {
  test('comprehensive metrics collection', async ({ page }) => {
    await loginIfNeeded(page);
    await setVP(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const result: any = {};

      // 1. Color system
      const allElements = document.querySelectorAll('*');
      const colorMap: Record<string, number> = {};
      allElements.forEach(el => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor;
        const color = s.color;
        const borderColor = s.borderColor;
        [bg, color, borderColor].forEach(c => {
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
            colorMap[c] = (colorMap[c] || 0) + 1;
          }
        });
      });
      result.colors = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([color, count]) => ({ color, count }));

      // 2. Border radius consistency
      const radiusMap: Record<string, number> = {};
      allElements.forEach(el => {
        const s = getComputedStyle(el);
        const r = s.borderRadius;
        if (r && r !== '0px') {
          radiusMap[r] = (radiusMap[r] || 0) + 1;
        }
      });
      result.borderRadii = Object.entries(radiusMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([r, count]) => ({ radius: r, count }));

      // 3. Typography scale
      const typeScale: Record<string, { size: number; count: number }> = {};
      document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,button,a').forEach(el => {
        const s = getComputedStyle(el);
        const size = s.fontSize;
        const weight = s.fontWeight;
        const key = `${size}/${weight}`;
        if (!typeScale[key]) typeScale[key] = { size: parseFloat(size), count: 0 };
        typeScale[key].count++;
      });
      result.typographyScale = Object.entries(typeScale)
        .sort((a, b) => a[1].size - b[1].size)
        .slice(0, 12)
        .map(([key, v]) => ({ key, size: v.size, count: v.count }));

      // 4. Spacing / padding
      const paddingMap: Record<string, number> = {};
      allElements.forEach(el => {
        const s = getComputedStyle(el);
        const p = s.padding;
        const pl = s.paddingLeft;
        if (p && p !== '0px' && pl !== '0px') {
          paddingMap[p] = (paddingMap[p] || 0) + 1;
        }
      });
      result.paddingScale = Object.entries(paddingMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([p, count]) => ({ padding: p, count }));

      // 5. Icon consistency
      const icons = document.querySelectorAll('svg');
      const iconSet = new Set<string>();
      icons.forEach(icon => {
        const path = icon.querySelector('path')?.getAttribute('d')?.slice(0, 50);
        const use = icon.querySelector('use')?.getAttribute('href');
        if (path) iconSet.add(path);
        if (use) iconSet.add(use);
      });
      result.iconCount = icons.length;
      result.uniqueIcons = iconSet.size;

      // 6. Animation usage
      const animatedEls = document.querySelectorAll('[class*="animate-"]');
      const animClasses = new Set<string>();
      animatedEls.forEach(el => {
        const m = (el as HTMLElement).className.match(/animate-[\w-]+/g);
        if (m) m.forEach(c => animClasses.add(c));
      });
      result.animations = [...animClasses];
      result.animatedElementCount = animatedEls.length;

      return result;
    });

    console.log('\n--- FULL APP METRICS ---');
    console.log('  Top colors:', JSON.stringify(metrics.colors.slice(0, 8), null, 2));
    console.log('  Border radii:', JSON.stringify(metrics.borderRadii, null, 2));
    console.log('  Typography scale:', JSON.stringify(metrics.typographyScale, null, 2));
    console.log('  Padding scale:', JSON.stringify(metrics.paddingScale, null, 2));
    console.log('  Icons:', metrics.iconCount, 'unique:', metrics.uniqueIcons);
    console.log('  Animations:', metrics.animations);

    await snap(page, 'metrics-overview.png');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EDIT DIALOG
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Edit Dialog', () => {
  test('edit entry dialog', async ({ page }) => {
    await loginIfNeeded(page);
    await setVP(page, 1440, 900);
    await page.goto('/app');
    await page.waitForTimeout(500);

    // Go to inventory, find edit button
    const invTab = page.getByRole('button', { name: 'Inventory' });
    if (await invTab.count() > 0) await invTab.click();
    await page.waitForTimeout(500);

    // Look for edit/edit icon buttons in table rows
    const editBtn = page.locator('button[aria-label*="Edit"], button:has([class*="pencil"]), button:has([class*="edit"])').first();
    if (await editBtn.count() > 0 && await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'edit-dialog-desktop.png');

      const dm = await collectDialogMetrics(page);
      console.log('\n--- EDIT DIALOG ---');
      console.log('  Overlay:', dm.overlay ? { w: Math.round(dm.overlay.rect?.width || 0), h: Math.round(dm.overlay.rect?.height || 0) } : 'null');
    } else {
      console.log('  No edit button found (inventory may be empty)');
      await snap(page, 'edit-dialog-not-found.png');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE-SPECIFIC (375x812 AND 390x844)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UX Audit — Mobile Detail', () => {
  test('mobile screenshots at 375 and 390', async ({ page }) => {
    await loginIfNeeded(page);

    for (const size of [{ w: 375, h: 812 }, { w: 390, h: 844 }]) {
      await setVP(page, size.w, size.h);
      await page.goto('/app');
      await page.waitForTimeout(500);

      const mobileInfo = await page.evaluate(() => {
        // Touch targets
        const buttons = Array.from(document.querySelectorAll('button'));
        const touchTargets = buttons.map(b => {
          const r = (b as HTMLElement).getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), meets44: r.width >= 44 && r.height >= 44 };
        });
        const targetsUnder44 = touchTargets.filter(t => !t.meets44);
        const under44Count = targetsUnder44.length;

        // Density
        const bodyText = document.body.textContent || '';
        const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

        // Bottom nav
        const bottomNav = document.querySelector('[class*="bottom"], [class*="BottomNav"]');
        const bottomNavInfo = bottomNav
          ? { h: Math.round((bottomNav as HTMLElement).getBoundingClientRect().height) }
          : null;

        // Text sizes
        const textSizes = new Set<number>();
        document.querySelectorAll('*').forEach(el => {
          const s = getComputedStyle(el);
          if (s.fontSize !== '0px') textSizes.add(parseFloat(s.fontSize));
        });

        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          touchTargetUnder44: under44Count,
          touchTargetDetails: targetsUnder44.slice(0, 5),
          density: wordCount,
          bottomNav: bottomNavInfo,
          textSizes: [...textSizes].sort((a, b) => a - b).slice(0, 10),
        };
      });

      console.log(`\n--- MOBILE ${size.w}x${size.h} ---`);
      console.log('  Viewport:', mobileInfo.viewport);
      console.log('  Touch targets under 44px:', mobileInfo.touchTargetUnder44);
      console.log('  Under 44px details:', mobileInfo.touchTargetDetails);
      console.log('  Word density:', mobileInfo.density);
      console.log('  Bottom nav:', mobileInfo.bottomNav);
      console.log('  Text sizes:', mobileInfo.textSizes);

      await snap(page, `mobile-${size.w}x${size.h}-home.png`);

      // Open form on mobile
      const addBtn = page.locator('button:has-text("Log Entry")').first();
      if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);
      }
      await snap(page, `mobile-${size.w}x${size.h}-form.png`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Inventory on mobile
      const invTab = page.getByRole('button', { name: 'Inventory' });
      if (await invTab.count() > 0) await invTab.click();
      await page.waitForTimeout(800);
      await snap(page, `mobile-${size.w}x${size.h}-inventory.png`);
    }
  });
});
