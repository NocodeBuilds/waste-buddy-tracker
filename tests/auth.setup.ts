import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../playwright/.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'user.json');

// Load .env.e2e file manually (dotenv not installed)
function loadEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    }
  } catch (e) {
    // File doesn't exist
  }
  return env;
}

const envVars = loadEnvFile(path.resolve(__dirname, '../.env.e2e'));
const E2E_EMAIL = envVars.E2E_TEST_EMAIL || process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = envVars.E2E_TEST_PASSWORD || process.env.E2E_TEST_PASSWORD;

test.describe('E2E Authentication Setup', () => {
  test('log in and save authenticated session', async ({ page }) => {
    // Read credentials from env vars (loaded from .env.e2e or system env)
    const email = E2E_EMAIL;
    const password = E2E_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.e2e or environment. ' +
        'See .env.e2e.example for details.'
      );
    }

    // Navigate to login page
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth/);

    // Wait for the login form to be visible
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Fill credentials
    await page.getByLabel('Email').fill(email);
    await page.locator('#password').fill(password);

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to /app (confirms successful auth) OR error toast (failed auth)
    try {
      await page.waitForURL(/\/app/, { timeout: 15_000 });
      console.log('✓ Login successful — redirected to /app');
    } catch (e) {
      // Check for error toast
      const errorToast = page.locator('text=/Invalid|Error|incorrect|wrong/i');
      if (await errorToast.isVisible({ timeout: 3_000 }).catch(() => false)) {
        console.log('✗ Login failed — invalid credentials');
        throw new Error(
          'Login failed. Verify E2E_TEST_EMAIL and E2E_TEST_PASSWORD are correct, ' +
          'the test user exists in Supabase Auth, and the user has a site membership.'
        );
      }
      throw e;
    }

    // Verify we're on the app page
    await expect(page).toHaveURL(/\/app/);

    // Wait for any app content to load (not just the loading spinner)
    // The app may show "Waste Inventory" (with site) or "Request Site Access" (no site)
    try {
      await page.waitForSelector(
        'text=/Waste Inventory|Dashboard|Request Site Access|In storage|No entries/i',
        { timeout: 15_000 }
      );
      console.log('✓ App content loaded');
    } catch (e) {
      console.log('⚠ App content selector timeout — saving state anyway');
    }

    // Save the authenticated storage state for reuse
    await page.context().storageState({ path: STORAGE_STATE_PATH });

    console.log(`✓ Auth state saved to: ${STORAGE_STATE_PATH}`);
  });
});
