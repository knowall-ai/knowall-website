import { test, expect } from '@playwright/test';

/**
 * Sallie Chat Tests
 *
 * Based on requirements (sallie-chat):
 * - On the homepage Sallie is docked bottom right from load (the hero belongs
 *   to the processing-power scene), with her animated avatar and greeting
 * - Opening the dock shows the chat; sending a message displays a response
 * - When the OpenAI API is unavailable (e.g. no valid API key), Sallie replies
 *   with a fallback response instead of an error
 *
 * The Playwright web server is started with an invalid OPENAI_API_KEY
 * (see playwright.config.ts) so these tests exercise the fallback path and
 * never require real secrets.
 */
test.describe('Sallie Chat', () => {
  // Hydration of the dev build can be slow on a loaded machine
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The dock is only portalled in once the page has hydrated
    await expect(
      page.getByTestId('sallie-dock').getByRole('button', { name: 'Chat with Sallie' })
    ).toBeVisible({ timeout: 60000 });
  });

  test('Sallie is docked bottom right from load, not in the hero', async ({ page }) => {
    const dock = page.getByTestId('sallie-dock');
    // No hero chat card any more
    await expect(page.getByTestId('sallie-chat')).toHaveCount(0);
    // Her animated avatar (the robot rig) is the dock button
    await expect(dock.getByRole('img', { name: /Sallie, KnowAll's robot/ })).toBeVisible();
    await expect(dock.getByRole('button', { name: /(Mute|Unmute) Sallie/ })).toBeVisible();
    // One of several openers is picked per visit and typed into her greeting bubble.
    await expect(dock.getByText(/Sallie/).first()).toBeVisible({ timeout: 15000 });

    const box = await dock.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x + box.width > viewport.width - 40).toBeTruthy();
    expect(box && viewport && box.y + box.height > viewport.height - 40).toBeTruthy();
    // The conversation ID is used internally (logging/lead follow-up) but is
    // deliberately not surfaced to visitors.
    await expect(page.getByText(/Our conversation will be saved with the ID/)).toHaveCount(0);
  });

  test('Opening the dock shows the chat input and send button', async ({ page }) => {
    const dock = page.getByTestId('sallie-dock');
    await dock.getByRole('button', { name: 'Chat with Sallie' }).click();
    await expect(dock.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(dock.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('An obvious "Talk to Sallie" mic button sits beside her in the dock', async ({ page }) => {
    const mic = page.getByTestId('sallie-dock').getByRole('button', { name: 'Talk to Sallie' });
    await expect(mic).toBeVisible();
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    // At least a 44px touch target
    const box = await mic.boundingBox();
    expect(box && box.height >= 44 && box.width >= 44).toBeTruthy();
  });

  test('Her greeting shows on arrival and tucks away once you scroll', async ({ page }) => {
    const dock = page.getByTestId('sallie-dock');
    await expect(dock.getByRole('button', { name: 'Dismiss greeting' })).toBeVisible();
    await page.locator('#services').scrollIntoViewIfNeeded();
    await expect(dock.getByRole('button', { name: 'Dismiss greeting' })).toHaveCount(0);
    // She stays docked with her voice option
    await expect(dock.getByRole('button', { name: 'Chat with Sallie' })).toBeVisible();
  });

  test('Keyboard users move from her button into the chat and back', async ({ page }) => {
    const dock = page.getByTestId('sallie-dock');
    const open = dock.getByRole('button', { name: 'Chat with Sallie' });
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(dock.getByPlaceholder('Type your message...')).toBeVisible();
    // The open chat follows her button in the tab order
    await page.keyboard.press('Tab');
    expect(await dock.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await dock.getByRole('button', { name: 'Close chat', exact: true }).click();
    await expect(open).toBeFocused();
  });

  test('Sending a message shows a fallback reply without a valid API key', async ({ page }) => {
    const dock = page.getByTestId('sallie-dock');
    await dock.getByRole('button', { name: 'Chat with Sallie' }).click();
    const input = dock.getByPlaceholder('Type your message...');
    await input.fill('Hello Sallie');
    await dock.getByRole('button', { name: 'Send message' }).click();

    // The user's message appears in the conversation
    await expect(dock.getByText('Hello Sallie', { exact: true })).toBeVisible();

    // Sallie replies. Without a valid OPENAI_API_KEY the server responds with
    // its fixed fallback, which never echoes the visitor's text.
    await expect(dock.getByText(/having trouble thinking right now/)).toBeVisible({
      timeout: 25000,
    });
  });

  test('Chat API returns a well-formed fallback response', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        conversationId: 'e2e-test-conversation',
        messages: [{ role: 'user', content: 'What services do you offer?' }],
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.role).toBe('assistant');
    expect(body.conversationId).toBe('e2e-test-conversation');
    expect(body.content).toBeTruthy();
  });

  test('Chat API diagnostic endpoint responds', async ({ request }) => {
    const response = await request.get('/api/chat?diagnostic=true');

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
