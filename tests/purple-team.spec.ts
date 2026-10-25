import { test, expect } from '@playwright/test';

/**
 * Purple Team Page Tests
 *
 * Based on requirements (purple-team-page):
 * - The homepage has a Purple Team section that links to /purple-team
 * - /purple-team explains the offering with the agents, charts and an FAQ
 * - An enquiry form validates before sending
 * - Sallie is docked bottom left, with her voice option visible
 */
test.describe('Purple Team Page', () => {
  test('Homepage section and header link go to the Purple Team page', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#purple-team');
    await expect(section).toBeVisible();
    await section.getByRole('link', { name: 'Meet the Purple Team' }).click();
    await expect(page).toHaveURL(/\/purple-team$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Break it');
  });

  test('Shows the loop, charts and FAQ', async ({ page }) => {
    await page.goto('/purple-team');
    const steps = page.locator('#how-it-works li');
    await expect(steps).toHaveCount(4);
    await expect(steps.first()).toContainText('Pennie attacks');
    await expect(
      page.getByRole('group', { name: 'Bar chart of new CVEs published per year' })
    ).toBeVisible();
    await expect(page.getByRole('img', { name: /Security score \d+ out of 100/ })).toBeVisible();

    // Every real figure links to its public source.
    const numbers = page.locator('#numbers');
    await expect(
      numbers.getByRole('link', { name: 'NIST National Vulnerability Database' })
    ).toHaveAttribute('href', 'https://nvd.nist.gov/vuln/search');
    await expect(
      numbers.getByRole('link', { name: "CISA's Known Exploited Vulnerabilities catalogue" })
    ).toHaveAttribute('href', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog');

    // Integrations, grouped by job.
    const integrations = page.getByTestId('integrations');
    await expect(integrations.getByRole('heading', { level: 4 })).toHaveCount(6);
    await expect(integrations.getByText('Microsoft Foundry', { exact: true })).toBeVisible();
    await expect(integrations.getByText('ZAP (Zed Attack Proxy)', { exact: true })).toBeVisible();
    await expect(
      integrations.getByText('Thyme and Business Central', { exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Is it legal to attack our systems?' }).click();
    await expect(page.getByText('Only with your written permission.')).toBeVisible();
  });

  test('Enquiry form shows errors before sending', async ({ page }) => {
    await page.goto('/purple-team');
    const form = page.getByTestId('purple-team-form');
    await form.getByRole('button', { name: 'Talk to the Purple Team' }).click();
    await expect(form.getByText('Please enter your name')).toBeVisible();
    await expect(form.getByText('Please choose where your code lives')).toBeVisible();
    await expect(form.getByText('Please choose at least one area')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View the Purple Team presentation' })
    ).toHaveAttribute('href', '/presentations/purple-team.html');
    // Or skip the form and just email us.
    await expect(form.getByRole('link', { name: 'hello@knowall.ai' })).toHaveAttribute(
      'href',
      'mailto:hello@knowall.ai?subject=Purple%20Team%20enquiry'
    );
  });

  test('Sallie is docked bottom left with her voice option', async ({ page }) => {
    await page.goto('/purple-team');
    const dock = page.getByTestId('sallie-dock');
    await expect(dock.getByRole('button', { name: 'Chat with Sallie' })).toBeVisible();
    await expect(dock.getByRole('button', { name: /(Mute|Unmute) Sallie/ })).toBeVisible();

    // Her chips are about the Purple Team here, not the homepage topics.
    await dock.getByRole('button', { name: 'Chat with Sallie' }).click();
    await expect(dock.getByRole('button', { name: 'How fast can you patch?' })).toBeVisible();
    await expect(dock.getByRole('button', { name: 'How does Bitcoin fit in?' })).toHaveCount(0);
    const box = await dock.boundingBox();
    const viewport = page.viewportSize();
    expect(box && box.x < 40).toBeTruthy();
    expect(box && viewport && box.y + box.height > viewport.height - 40).toBeTruthy();
  });
});
