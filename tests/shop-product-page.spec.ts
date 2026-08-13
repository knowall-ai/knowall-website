import { test, expect, type Page } from '@playwright/test';
import { KNOWALL_PUBKEY } from '../lib/nostr';

/**
 * Product Detail Page Tests (/shop/<naddr>)
 *
 * The page fetches one NIP-99 listing (kind 30402) client-side by its
 * (kind, pubkey, d-tag) address, so live-relay tests only assert the page
 * settles into ONE of its valid states. The populated, not-found and error
 * states are exercised deterministically by stubbing WebSocket before the
 * page loads — the same pattern as the shop grid tests.
 *
 * The naddr constants are precomputed with nostr-tools
 * `nip19.naddrEncode(...)` (specs avoid importing the ESM-only nostr-tools):
 * - TMINUS15_NADDR: kind 30402, KNOWALL_PUBKEY, d "tminus15-book", relay
 *   hints [relay.damus.io, nos.lol] — the shop's real, live listing.
 * - FOREIGN_NADDR: kind 30402, pubkey aa…aa, d "tminus15-book".
 * - WRONG_KIND_NADDR: kind 30023 (long-form article), KNOWALL_PUBKEY.
 */
const TMINUS15_NADDR =
  'naddr1qvzqqqrkcgpzpdenajkjvhvd7clptc5dyjtjzsd9a0pphl032v4d45hxwq0g2wyjqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hszrthwden5te0dehhxtnvdakqqrt5d45kuatnxy6j6cn0da4s74j5lz';
const FOREIGN_NADDR =
  'naddr1qvzqqqrkcgpzp242424242424242424242424242424242424242424242424242qqxhgmtfde6hxvf4943x7mmtkc33ek';
const WRONG_KIND_NADDR =
  'naddr1qvzqqqr4gupzpdenajkjvhvd7clptc5dyjtjzsd9a0pphl032v4d45hxwq0g2wyjqqz8qmmnwss8vkv6';

/**
 * Stub WebSocket before any page script runs: every relay "responds" to a
 * kind-30402 REQ with the scripted events followed by EOSE (other REQs, e.g.
 * the hero's kind-0 profile query, get a bare EOSE).
 */
async function mockRelays(page: Page, events: object[]) {
  await page.addInitScript(
    ({ scripted }) => {
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

        send(payload: string) {
          const [, subscriptionId, filter] = JSON.parse(payload) as [
            string,
            string,
            { kinds?: number[] },
          ];
          setTimeout(() => {
            if (filter?.kinds?.includes(30402)) {
              for (const event of scripted) {
                this.onmessage?.({ data: JSON.stringify(['EVENT', subscriptionId, event]) });
              }
            }
            this.onmessage?.({ data: JSON.stringify(['EOSE', subscriptionId]) });
          }, 0);
        }

        close() {
          // No-op.
        }
      }

      (window as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    },
    { scripted: events }
  );
}

/** The live tminus15-book listing, as scripted relay data. */
function bookListing(overrides: Partial<{ tags: string[][] }> = {}) {
  return {
    id: 'e'.repeat(64),
    pubkey: KNOWALL_PUBKEY,
    created_at: 1700000000,
    kind: 30402,
    content: 'The playbook for agentic delivery.\n\nShips worldwide from the UK.',
    tags: overrides.tags ?? [
      ['d', 'tminus15-book'],
      ['title', 'T-Minus-15 Book'],
      ['summary', 'Agentic delivery, by the book'],
      ['price', '9.99', 'GBP'],
      ['image', 'https://example.com/front.png'],
      ['image', 'https://example.com/back.png'],
      ['t', 'book'],
      ['location', 'United Kingdom'],
      ['stock', '5'],
      ['status', 'active'],
    ],
  };
}

/** 1x1 transparent PNG served for the listing's stub image URLs — otherwise
 *  the browser's failed loads trigger the gallery's error fallback. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Product Detail Page', () => {
  test('renders the full product page from mocked relay events', async ({ page }) => {
    await mockRelays(page, [bookListing()]);
    await page.route('https://example.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
    );
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    await expect(page.getByTestId('product-detail')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'T-Minus-15 Book' })).toBeVisible();
    await expect(page.getByText('£9.99')).toBeVisible();
    await expect(page.getByText('Agentic delivery, by the book')).toBeVisible();
    await expect(page.getByText('5 available')).toBeVisible();
    await expect(page.getByText('United Kingdom')).toBeVisible();
    await expect(page.getByText('#book')).toBeVisible();
    await expect(page.getByText(/playbook for agentic delivery/)).toBeVisible();

    // Buy deep-links this exact naddr on njump (zap/pay in the user's client).
    await expect(page.getByRole('link', { name: 'Buy' })).toHaveAttribute(
      'href',
      `https://njump.me/${TMINUS15_NADDR}`
    );

    // Gallery: clicking a thumbnail switches the main image.
    const mainImage = page.getByAltText(/T-Minus-15 Book — image/);
    await expect(mainImage).toHaveAttribute('src', 'https://example.com/front.png');
    await page.getByRole('button', { name: 'Show image 2' }).click();
    await expect(mainImage).toHaveAttribute('src', 'https://example.com/back.png');

    // Message opens the contact panel prefilled with the product enquiry
    // (scoped to the detail — the header has its own Message button).
    await page.getByTestId('product-detail').getByRole('button', { name: 'Message' }).click();
    await expect(page.getByText('Message us')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(
      /T-Minus-15 Book \(£9\.99\)/
    );
  });

  test('sold-out listings show the overlay and a view-only action', async ({ page }) => {
    await mockRelays(page, [
      bookListing({
        tags: [
          ['d', 'tminus15-book'],
          ['title', 'T-Minus-15 Book'],
          ['price', '9.99', 'GBP'],
          ['status', 'sold'],
        ],
      }),
    ]);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    await expect(page.getByTestId('product-detail')).toBeVisible();
    await expect(page.getByText('Sold Out').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'View on Nostr' })).toBeVisible();
  });

  test('shows the not-found card when relays have no such listing', async ({ page }) => {
    await mockRelays(page, []);
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    await expect(page.getByTestId('product-not-found')).toBeVisible();
    await expect(page.getByText('Product not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to Shop' }).last().click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('404s for malformed, foreign-pubkey and wrong-kind addresses', async ({ page }) => {
    for (const bad of ['not-an-naddr', FOREIGN_NADDR, WRONG_KIND_NADDR]) {
      const response = await page.goto(`/shop/${bad}`, { waitUntil: 'load' });
      expect(response?.status()).toBe(404);
      await expect(page.getByText('Page not found')).toBeVisible();
    }
  });

  test('shop cards navigate to the product page', async ({ page }) => {
    await mockRelays(page, [bookListing()]);
    await page.goto('/shop', { waitUntil: 'load' });

    await expect(page.getByTestId('shop-listings')).toBeVisible();
    await page.getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(/\/shop\/naddr1/);
    await expect(page.getByTestId('product-detail')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'T-Minus-15 Book' })).toBeVisible();
  });

  test('live page settles into a valid state regardless of relay availability', async ({
    page,
  }) => {
    await page.goto(`/shop/${TMINUS15_NADDR}`, { waitUntil: 'load' });

    // One of: the loaded product, not-found card, or the error fallback.
    // (Relay timeout is 8s, so allow a little longer.)
    const settled = page
      .getByTestId('product-detail')
      .or(page.getByTestId('product-not-found'))
      .or(page.getByTestId('product-error'));
    await expect(settled.first()).toBeVisible({ timeout: 15000 });
  });
});
