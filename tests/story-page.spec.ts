import { test, expect } from '@playwright/test';

/**
 * Story Page Tests
 *
 * Based on requirements (story-page):
 * - /story shows the KnowAll AI Nostr profile hero (banner, avatar, name, bio)
 * - A "Follow us on Nostr" link points at the KnowAll npub on njump.me
 * - The timeline loads live kind-1 notes from Nostr relays, with graceful
 *   loading/empty/error states when relays are slow or unreachable
 * - The header links to the Story page
 *
 * The feed talks to public relays, so tests assert the page reaches ANY
 * terminal feed state (posts, empty, or the error fallback) rather than
 * depending on relay availability in CI.
 */
test.describe('Story Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/story');
  });

  test('Profile hero renders with name and follow link', async ({ page }) => {
    const hero = page.getByTestId('story-hero');
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(hero.getByText('Our Story')).toBeVisible();

    const followLink = hero.getByRole('link', { name: 'Follow us on Nostr' });
    await expect(followLink).toHaveAttribute('href', /njump\.me\/npub1/);
  });

  test('Feed reaches a terminal state (posts, empty, or error fallback)', async ({ page }) => {
    const terminal = page.locator(
      '[data-testid="story-feed"], [data-testid="story-empty"], [data-testid="story-error"]'
    );
    // Relays get up to 8s each (in parallel) before the feed settles.
    await expect(terminal.first()).toBeVisible({ timeout: 20000 });
  });

  test('Header links to the Story page from the homepage', async ({ page }) => {
    await page.goto('/');
    const storyLink = page.locator('header a[href="/story"]').first();
    await expect(storyLink).toBeVisible();
  });
});
