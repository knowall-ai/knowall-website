import { test, expect } from '@playwright/test';

/**
 * Services Section Tests
 *
 * Based on requirements (services-section):
 * - The homepage shows an "Our Services" heading
 * - Cards for AI Consultancy, Microsoft Copilot Development and
 *   Value-for-Value Transactions are displayed
 * - Each card shows a title and a description
 */
test.describe('Services Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Services section is present with heading', async ({ page }) => {
    const section = page.locator('section#services');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Our Services' })).toBeVisible();
  });

  test('All three service cards are displayed', async ({ page }) => {
    const section = page.locator('section#services');

    await expect(section.getByRole('heading', { name: 'AI Consultancy' })).toBeVisible();
    await expect(
      section.getByRole('heading', { name: 'Microsoft Copilot Development' })
    ).toBeVisible();
    await expect(
      section.getByRole('heading', { name: 'Value-for-Value Transactions' })
    ).toBeVisible();
  });

  test('Service cards show their descriptions', async ({ page }) => {
    const section = page.locator('section#services');

    await expect(
      section.getByText('Expert guidance on implementing AI solutions tailored to your business')
    ).toBeVisible();
    await expect(
      section.getByText('Custom Microsoft Copilots built to enhance productivity')
    ).toBeVisible();
    await expect(
      section.getByText('Revolutionary peer-to-peer Bitcoin transfers between autonomous AI agents')
    ).toBeVisible();
  });

  test('Services navigation link points at the services section', async ({ page }) => {
    const servicesLink = page.locator('header nav a', { hasText: 'Services' });
    await expect(servicesLink).toHaveAttribute('href', '#services');
  });
});
