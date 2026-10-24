import { test, expect, type Page } from '@playwright/test';

/**
 * Presentation carousel tests
 *
 * Based on requirements (presentations, WCAG 2.2.2 Pause, Stop, Hide):
 * - The Purple Team deck's portal carousel auto-advances while its slide is on screen
 * - A visible pause/play toggle (aria-pressed) stops and resumes it
 * - Once the visitor pauses it, uses an arrow or dot, or focuses one of those, it
 *   stays stopped (hovering away does not resume it) until they press play
 * - Under prefers-reduced-motion it starts paused
 * - Arrow keys on its controls never move the deck
 */

const DECK = '/presentations/purple-team.html';
const ADVANCE_MS = 4500;

async function openCarouselSlide(page: Page, { reducedMotion = false } = {}) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto(DECK);
  await page.waitForFunction(() => (window as any).Reveal?.isReady());
  await page.evaluate(() => {
    const Reveal = (window as any).Reveal;
    const section = document.querySelector('.portal-carousel')!.closest('.slides > section')!;
    const index = [...document.querySelectorAll('.reveal .slides > section')].indexOf(section);
    Reveal.slide(index, 0);
  });
  const carousel = page.locator('.portal-carousel');
  await expect(carousel).toBeVisible();
  return carousel;
}

const activeIndex = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.portal-carousel .pc-slide')].findIndex((s) =>
      s.classList.contains('is-active')
    )
  );

// park the pointer well away from the carousel
const moveAway = (page: Page) => page.mouse.move(5, 5);

test.describe('Presentation carousel', () => {
  test('auto-advances, and a click keeps it stopped until play is pressed', async ({ page }) => {
    const carousel = await openCarouselSlide(page);
    const toggle = carousel.getByRole('button', { name: 'Pause screens' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await moveAway(page);
    expect(await activeIndex(page)).toBe(0);
    await page.clock.runFor(ADVANCE_MS + 100);
    expect(await activeIndex(page)).toBe(1);

    // clicking an arrow stops it; hovering away must not resume it
    await carousel.getByRole('button', { name: 'Next screen' }).click();
    expect(await activeIndex(page)).toBe(2);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await moveAway(page);
    await page.clock.runFor(ADVANCE_MS * 3);
    expect(await activeIndex(page)).toBe(2);

    // play resumes it once the pointer leaves
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await moveAway(page);
    await page.clock.runFor(ADVANCE_MS + 100);
    expect(await activeIndex(page)).toBe(3);

    // pause stops it again
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await moveAway(page);
    await page.clock.runFor(ADVANCE_MS * 3);
    expect(await activeIndex(page)).toBe(3);
  });

  test('hover pauses only while the pointer is over it', async ({ page }) => {
    const carousel = await openCarouselSlide(page);
    await carousel.hover();
    await page.clock.runFor(ADVANCE_MS * 2);
    expect(await activeIndex(page)).toBe(0);
    await moveAway(page);
    await page.clock.runFor(ADVANCE_MS + 100);
    expect(await activeIndex(page)).toBe(1);
  });

  test('focusing a dot stops it, and arrow keys on it do not move the deck', async ({ page }) => {
    const carousel = await openCarouselSlide(page);
    const deckIndex = () => page.evaluate(() => (window as any).Reveal.getIndices().h);
    const before = await deckIndex();
    await carousel.getByRole('button', { name: 'Show Repositories' }).focus();
    await expect(carousel.getByRole('button', { name: 'Pause screens' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    expect(await deckIndex()).toBe(before);
    await page.clock.runFor(ADVANCE_MS * 3);
    expect(await activeIndex(page)).toBe(0);
  });
});

test.describe('Presentation carousel with reduced motion', () => {
  test('starts paused, showing play', async ({ page }) => {
    const carousel = await openCarouselSlide(page, { reducedMotion: true });
    await expect(carousel.getByRole('button', { name: 'Pause screens' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await moveAway(page);
    await page.clock.runFor(ADVANCE_MS * 3);
    expect(await activeIndex(page)).toBe(0);
    await expect(carousel.locator('.pc-icon-play')).toBeVisible();
    await expect(carousel.locator('.pc-icon-pause')).toBeHidden();
  });
});
