import { test, expect } from '@playwright/test';

/**
 * Shop Page Tests
 *
 * The shop lists NIP-99 classified listings (kind 30402) fetched client-side
 * from public Nostr relays, so live-relay tests only assert that the feed
 * settles into ONE of its valid states (listings, branded empty state, or
 * error fallback) rather than depending on relay availability or content.
 * The populated state is exercised deterministically by stubbing WebSocket
 * before the page loads.
 */

// Must match lib/nostr.ts KNOWALL_PUBKEY.
const KNOWALL_PUBKEY = 'b733ecad265d8df63e15e28d24972141a5ebc21bfdf1532adad2e6701e853892';

test.describe('Shop Page', () => {
  test('renders the shop hero with Nostr identity', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });

    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View us on Nostr' })).toHaveAttribute(
      'href',
      /njump\.me/
    );
  });

  test('is reachable from the header and footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Desktop header icon link
    await page.locator('header').getByRole('link', { name: 'Shop' }).click();
    await expect(page).toHaveURL(/\/shop$/);

    // Footer link
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('footer').getByRole('link', { name: 'Shop' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('feed settles into a valid state regardless of relay availability', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });

    // One of: populated grid, branded empty state, or the error fallback.
    // (Relay timeout is 8s, so allow a little longer.)
    const settled = page
      .getByTestId('shop-listings')
      .or(page.getByTestId('shop-empty'))
      .or(page.getByText(/couldn't load the shop/i));
    await expect(settled.first()).toBeVisible({ timeout: 15000 });
  });

  test('renders products, search and filters from mocked relay events', async ({ page }) => {
    // Stub WebSocket before any page script runs: every relay "responds" to a
    // REQ with two scripted kind-30402 listings followed by EOSE.
    await page.addInitScript((pubkey) => {
      const listings = [
        {
          id: 'e'.repeat(64),
          pubkey,
          created_at: 1700000000,
          kind: 30402,
          content: 'A pack of ten die-cut vinyl stickers.',
          tags: [
            ['d', 'sticker-pack'],
            ['title', 'KnowAll AI Sticker Pack'],
            ['summary', 'Ten die-cut vinyl stickers'],
            ['price', '10000', 'SATS'],
            ['t', 'merch'],
            ['status', 'active'],
          ],
        },
        {
          id: 'f'.repeat(64),
          pubkey,
          created_at: 1700000001,
          kind: 30402,
          content: 'Multi-agent development training.',
          tags: [
            ['d', 'bootcamp'],
            ['title', 'Agent Bootcamp'],
            ['summary', 'Learn multi-agent development'],
            ['price', '100', 'GBP'],
            ['t', 'training'],
          ],
        },
      ];

      class MockWebSocket {
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((message: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        onclose: (() => void) | null = null;

        constructor(url: string) {
          this.url = url;
          setTimeout(() => this.onopen?.(), 0);
        }

        send() {
          setTimeout(() => {
            for (const event of listings) {
              this.onmessage?.({ data: JSON.stringify(['EVENT', 'shop', event]) });
            }
            this.onmessage?.({ data: JSON.stringify(['EOSE', 'shop']) });
          }, 0);
        }

        close() {
          // No-op.
        }
      }

      // Only relay connections are made over WebSocket on this page.
      (window as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    }, KNOWALL_PUBKEY);

    await page.goto('/shop', { waitUntil: 'load' });

    // Both products render with formatted prices.
    await expect(page.getByTestId('shop-listings')).toBeVisible();
    await expect(page.getByText('KnowAll AI Sticker Pack')).toBeVisible();
    await expect(page.getByText('10,000 sats')).toBeVisible();
    await expect(page.getByText('Agent Bootcamp')).toBeVisible();
    await expect(page.getByText('£100')).toBeVisible();

    // Buy deep-links to the listing on njump (naddr).
    const buyLinks = page.getByRole('link', { name: 'Buy' });
    await expect(buyLinks.first()).toHaveAttribute('href', /njump\.me\/naddr1/);

    // Search narrows the grid.
    await page.getByRole('searchbox', { name: 'Search products' }).fill('sticker');
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByText('Agent Bootcamp')).not.toBeVisible();

    // Clearing the search and filtering by tag chip narrows it again.
    await page.getByRole('searchbox', { name: 'Search products' }).fill('');
    await page.getByRole('button', { name: '#training' }).click();
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByText('Agent Bootcamp')).toBeVisible();

    // Message opens the contact panel prefilled with the product enquiry.
    await page.getByRole('button', { name: 'All' }).click();
    await page
      .getByTestId('product-card')
      .filter({ hasText: 'KnowAll AI Sticker Pack' })
      .getByRole('button', { name: 'Message' })
      .click();
    await expect(page.getByText('Message us')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(
      /Sticker Pack \(10,000 sats\)/
    );
  });
});
