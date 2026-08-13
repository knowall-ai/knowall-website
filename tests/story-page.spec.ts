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

/**
 * Social actions (comments, zaps, follow) on the story feed. The feed's posts
 * come from live public relays, so post-dependent tests first wait for a
 * terminal feed state and skip when no posts loaded — asserting the gating UX
 * only when there is something to gate.
 */
test.describe('Story Page social actions', () => {
  /** Wait for the feed to settle; true when posts rendered, false otherwise. */
  async function feedHasPosts(page: import('@playwright/test').Page): Promise<boolean> {
    const terminal = page.locator(
      '[data-testid="story-feed"], [data-testid="story-empty"], [data-testid="story-error"]'
    );
    await expect(terminal.first()).toBeVisible({ timeout: 20000 });
    return page.getByTestId('story-feed').isVisible();
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/story');
  });

  test('Posts show comment and zap actions', async ({ page }) => {
    test.skip(!(await feedHasPosts(page)), 'No posts loaded (relays unreachable in this run)');

    await expect(page.getByTestId('story-comments-toggle').first()).toBeVisible();
    await expect(page.getByTestId('story-zap-button').first()).toBeVisible();
  });

  test('Comment thread expands; composer is read-only with a sign-in nudge when signed out', async ({
    page,
  }) => {
    test.skip(!(await feedHasPosts(page)), 'No posts loaded (relays unreachable in this run)');

    await page.getByTestId('story-comments-toggle').first().click();
    const comments = page.getByTestId('story-comments').first();
    await expect(comments).toBeVisible();

    // Signed out: the textarea is disabled and the action is a sign-in nudge.
    const composer = comments.getByTestId('story-comment-composer');
    await expect(composer.locator('textarea')).toBeDisabled();
    await expect(composer.getByRole('button', { name: 'Sign in to comment' })).toBeVisible();
  });

  test('Zap dialog nudges signed-out users to sign in', async ({ page }) => {
    test.skip(!(await feedHasPosts(page)), 'No posts loaded (relays unreachable in this run)');

    await page.getByTestId('story-zap-button').first().click();
    const dialog = page.getByTestId('story-zap-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sign in to zap' })).toBeVisible();
  });

  test('Follow button deep-links to njump when signed out', async ({ page }) => {
    // Relay-independent: the hero renders regardless of feed state.
    const follow = page.getByTestId('story-follow-button');
    await expect(follow).toBeVisible();
    await expect(follow).toHaveAttribute('href', /njump\.me\/npub1/);
  });
});
