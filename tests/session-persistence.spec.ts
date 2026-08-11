import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, '../playwright/.auth/user.json');

test.describe('Session Persistence Verification', () => {
  test('authenticated session survives new browser context', async ({ browser }) => {
    // Create a fresh browser context using the saved storage state
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    const page = await context.newPage();

    // Navigate to the app — should redirect to /app without login
    await page.goto('/app');

    // Wait for page to stabilize
    await page.waitForTimeout;

    // Take a screenshot for debugging
    await page.screenshot({ path: 'playwright/.auth/session-test.png' });

    // Check current URL
    console.log('Current URL:', page.url());

    // Get page content for debugging
    const bodyText = await page.textContent('body');
    console.log('Page text (first 500 chars):', bodyText?.slice(0, 500));

    // Verify we're authenticated (no redirect to /auth)
    const url = page.url();
    expect(url).toContain('/app');

    console.log('✓ Session persisted — user is authenticated in new context');

    await context.close();
  });
});
