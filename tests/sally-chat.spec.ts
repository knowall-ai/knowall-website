import { test, expect } from '@playwright/test';

/**
 * Sally Chat Tests
 *
 * Based on requirements (sally-chat):
 * - The chat interface renders with Sally's greeting
 * - Sending a message displays a response in the chat interface
 * - When the OpenAI API is unavailable (e.g. no valid API key), Sally replies
 *   with a fallback response instead of an error
 *
 * The Playwright web server is started with an invalid OPENAI_API_KEY
 * (see playwright.config.ts) so these tests exercise the fallback path and
 * never require real secrets.
 */
test.describe('Sally Chat', () => {
  // Hydration of the dev build can be slow on a loaded machine
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The chat input is only rendered once the page has hydrated
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({ timeout: 60000 });
  });

  test('Chat interface renders with Sallie header and greeting', async ({ page }) => {
    // Scope to the first match: the chat header. (The Meet the Agents section
    // also has a "Sallie" heading for Sallie the Salesperson.)
    await expect(page.getByRole('heading', { name: 'Sallie' }).first()).toBeVisible();
    await expect(page.getByText(/I'm Sallie, but I'm not your regular bot!/)).toBeVisible();
    await expect(page.getByText(/Our conversation will be saved with the ID/)).toBeVisible();
  });

  test('Chat input and send button are available', async ({ page }) => {
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Sending a message shows a fallback reply without a valid API key', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...');
    await input.fill('Hello Sally');
    await page.locator('button[type="submit"]').click();

    // The user's message appears in the conversation
    await expect(page.getByText('Hello Sally', { exact: true })).toBeVisible();

    // Sally replies. Without a valid OPENAI_API_KEY the server responds with
    // its fallback message acknowledging the user's input.
    await expect(page.getByText(/I received your message: "Hello Sally"/)).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByText(/technical difficulties/)).toBeVisible();
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
