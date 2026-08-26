import { test, expect } from '@playwright/test';

/**
 * Admin Logs Tests
 *
 * Based on requirements (admin-logs):
 * - The admin logs page requires an API key before showing any logs
 * - The logs API rejects requests without the correct ADMIN_API_KEY
 * - With the correct API key the admin can view chat logs
 *
 * The Playwright web server is started with ADMIN_API_KEY set to a known
 * test value (see playwright.config.ts) so no real secrets are required.
 */
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key-for-e2e';

test.describe('Admin Logs', () => {
  test('Admin logs page shows an authentication gate', async ({ page }) => {
    await page.goto('/admin/logs');

    await expect(page.getByRole('heading', { name: 'Chat Logs Admin' })).toBeVisible();
    await expect(page.getByText('Authentication Required')).toBeVisible();
    await expect(page.getByLabel('API Key')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

    // No logs are shown before authenticating
    await expect(page.getByText('Log ID:')).toHaveCount(0);
  });

  test('Wrong API key shows an unauthorized error and no logs', async ({ page }) => {
    await page.goto('/admin/logs');

    // The form submit can land before React has hydrated the page, so retry
    // until the client-side handler responds
    await expect(async () => {
      await page.getByLabel('API Key').fill('wrong-api-key');
      await page.getByRole('button', { name: 'Authenticate' }).click();
      await expect(page.getByText('Unauthorized: Invalid API key')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    await expect(page.getByText('Authentication Required')).toBeVisible();
    await expect(page.getByText('Log ID:')).toHaveCount(0);
  });

  test('Correct API key unlocks the logs view', async ({ page }) => {
    await page.goto('/admin/logs');

    // The form submit can land before React has hydrated the page, so retry
    // until the client-side handler responds
    await expect(async () => {
      await page.getByLabel('API Key').fill(ADMIN_API_KEY);
      await page.getByRole('button', { name: 'Authenticate' }).click();
      await expect(page.getByRole('button', { name: 'Refresh Logs' })).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    // The authentication gate is replaced by the logs view
    await expect(page.getByText('Authentication Required')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('Logs API returns 401 without an API key', async ({ request }) => {
    const response = await request.get('/api/logs');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('Logs API returns 401 with a wrong API key', async ({ request }) => {
    const response = await request.get('/api/logs', {
      headers: { Authorization: 'Bearer wrong-api-key' },
    });

    expect(response.status()).toBe(401);
  });

  test('Logs API returns logs with the correct API key', async ({ request }) => {
    const response = await request.get('/api/logs', {
      headers: { Authorization: `Bearer ${ADMIN_API_KEY}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
