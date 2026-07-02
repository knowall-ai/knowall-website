import { test, expect } from '@playwright/test';

/**
 * Contact Us Tests
 *
 * Based on requirements (contact-us):
 * - Clicking the email link opens the user's email client with KnowAll's address
 * - Clicking the WhatsApp link opens WhatsApp with KnowAll's contact preloaded
 */
test.describe('Contact Us', () => {
  // Hydration of the dev build can be slow on a loaded machine
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The chat input is only rendered once the page has hydrated, so use it
    // as a signal that click handlers are attached
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({ timeout: 60000 });
  });

  test('Contact section is present with heading', async ({ page }) => {
    const section = page.locator('section#contact');
    await expect(section.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
  });

  test('Email link uses a mailto href with the KnowAll address', async ({ page }) => {
    const emailLink = page.locator('section#contact a[href^="mailto:"]');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute('href', 'mailto:info@knowall.ai');
  });

  test('WhatsApp button opens WhatsApp with the KnowAll contact preloaded', async ({ page }) => {
    // Capture window.open instead of following the external navigation so the
    // test does not depend on network access to wa.me
    await page.evaluate(() => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
      window.open = ((url: string) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(url);
        return null;
      }) as typeof window.open;
    });

    await page
      .locator('section#contact')
      .getByRole('button', { name: /WhatsApp/ })
      .click();

    const openedUrls = await page.evaluate(
      () => (window as unknown as { __openedUrls: string[] }).__openedUrls
    );
    expect(openedUrls).toHaveLength(1);
    expect(openedUrls[0]).toContain('https://wa.me/447968847178');
    expect(openedUrls[0]).toContain(encodeURIComponent('KnowAll.ai'));
  });

  test('Header mail icon opens the contact panel', async ({ page }) => {
    // The header Contact Us link was replaced by a mail icon that opens the
    // Nostr contact panel (slide-out message form)
    await page.locator('header').getByRole('button', { name: 'Contact us' }).first().click();

    const panel = page.getByRole('dialog');
    await expect(panel.getByText('Message us')).toBeVisible();
    await expect(panel.getByLabel('Name')).toBeVisible();
    await expect(panel.getByLabel('Email')).toBeVisible();
    await expect(panel.getByLabel('Message')).toBeVisible();
  });

  test('Footer shows the contact email address', async ({ page }) => {
    await expect(page.locator('footer').getByText('hello@knowall.ai')).toBeVisible();
  });
});
