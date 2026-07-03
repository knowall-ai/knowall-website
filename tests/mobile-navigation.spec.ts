import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile Navigation Tests
 *
 * Based on requirements (primary-navigation, responsive-design):
 * - On mobile the navigation collapses behind a menu toggle button
 * - Tapping the toggle opens the menu with all navigation links
 * - Tapping the toggle again or selecting a link closes the menu
 */

const mobileNavSelector = 'header .md\\:hidden nav';

// Clicks can land before React has hydrated the page, so retry the toggle
// until the menu actually opens (the click is a no-op pre-hydration).
async function openMobileMenu(page: Page) {
  const mobileNav = page.locator(mobileNavSelector);
  await expect(async () => {
    if (!(await mobileNav.isVisible())) {
      await page.getByRole('button', { name: 'Toggle menu' }).click();
    }
    await expect(mobileNav).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // Hydration of the dev build can be slow on a loaded machine
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The chat input is only rendered once the page has hydrated, so use it
    // as a signal that click handlers are attached
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({ timeout: 60000 });
  });

  test('Menu toggle button is visible on mobile', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeVisible();
  });

  test('Desktop navigation is hidden on mobile', async ({ page }) => {
    await expect(page.locator('header nav.hidden')).toBeHidden();
  });

  test('Tapping the toggle opens the mobile menu with all links', async ({ page }) => {
    await openMobileMenu(page);

    const mobileNav = page.locator(mobileNavSelector);
    await expect(mobileNav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Services' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Zaplie' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Copilots' })).toBeVisible();
    // Contact Us was replaced by the Nostr Sign In button in the mobile menu
    await expect(mobileNav.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('Tapping the toggle again closes the mobile menu', async ({ page }) => {
    await openMobileMenu(page);

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await expect(page.locator(mobileNavSelector)).toHaveCount(0);
  });

  test('Selecting a link closes the mobile menu', async ({ page }) => {
    await openMobileMenu(page);

    await page.locator(mobileNavSelector).getByRole('link', { name: 'Services' }).click();
    await expect(page.locator(mobileNavSelector)).toHaveCount(0);
  });
});
