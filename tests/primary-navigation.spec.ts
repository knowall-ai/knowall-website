import { test, expect } from '@playwright/test';

/**
 * Primary Navigation Tests
 * 
 * Based on requirements:
 * - Logo should link to the top of the page
 * - Home navigation link should navigate to the top of the page
 */
test.describe('Primary Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the homepage
    await page.goto('/');
    
    // Scroll down the page to simulate user being somewhere in the middle
    await page.evaluate(() => window.scrollTo(0, 500));
    
    // Verify we're scrolled down
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('Logo navigates to top of page', async ({ page }) => {
    // Click the logo
    await page.click('header a img[alt*="KnowAll"]');
    
    // Wait for the scroll action to complete (smooth scrolling may take time)
    await page.waitForTimeout(5000);
    
    // Verify we're at the top of the page
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('Home navigation link navigates to top of page', async ({ page }) => {
    // Find and click the Home navigation link
    await page.click('header nav a:has-text("Home")');
    
    // Wait for the scroll action to complete (smooth scrolling may take time)
    await page.waitForTimeout(5000);
    
    // Verify we're at the top of the page
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
