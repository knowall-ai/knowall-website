import { test, expect } from '@playwright/test';

/**
 * Home Hero Tests
 *
 * Based on requirements (home-hero):
 * - The hero shows the processing-power scene (a silicon die lit like a city,
 *   with KnowAll's agents on its traces) behind the headline and two buttons
 * - The scene's animation pauses while it is off screen
 * - Under prefers-reduced-motion the scene is a static frame
 */
test.describe('Home Hero', () => {
  test.slow();

  test('Shows the headline, buttons and the die scene', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Intelligence is processing power' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Our Services' })).toHaveAttribute(
      'href',
      '#services'
    );
    await expect(page.getByRole('link', { name: 'Find out more about Zaplie' })).toHaveAttribute(
      'href',
      '#zaplie'
    );
    await expect(page.getByRole('img', { name: /Macro view of a processor die/ })).toBeVisible();
  });

  test('Pauses the animation while the hero is off screen', async ({ page }) => {
    await page.goto('/');
    const scope = page.locator('.die-hero');
    await expect(scope).toHaveAttribute('data-inview', 'true', { timeout: 60000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(scope).toHaveAttribute('data-inview', 'false');
    const state = await page
      .locator('.die-hero .die-camera')
      .evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(state).toBe('paused');
  });

  test('Shows a static frame under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const animation = await page
      .locator('.die-hero .die-camera')
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });
});
