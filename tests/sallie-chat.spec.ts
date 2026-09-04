import { test, expect } from '@playwright/test';

/**
 * Sallie Chat Tests
 *
 * Based on requirements (sallie-chat):
 * - Sallie's animated avatar renders with her welcome greeting
 * - Sending a message displays a response in the chat interface
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
    // The chat input is only rendered once the page has hydrated
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({ timeout: 60000 });
  });

  test('Chat interface renders with Sallie header and greeting', async ({ page }) => {
    // Scope to the chat card via its test id, so the "Sallie" heading in the
    // Meet the Agents section (Sallie the Salesperson) can't be matched instead.
    await expect(
      page.getByTestId('sallie-chat').getByRole('heading', { name: 'Sallie', exact: true })
    ).toBeVisible();
    // Her animated avatar (the robot rig) renders alongside the greeting
    await expect(
      page.getByTestId('sallie-chat').getByRole('img', { name: /Sallie, KnowAll's robot/ })
    ).toBeVisible();
    // The greeting is revealed with a typewriter effect, so allow it time to finish.
    await expect(page.getByText(/welcome to KnowAll AI/)).toBeVisible({ timeout: 15000 });
    // The conversation ID is used internally (logging/lead follow-up) but is
    // deliberately not surfaced to visitors.
    await expect(page.getByText(/Our conversation will be saved with the ID/)).toHaveCount(0);
  });

  test('Chat input and send button are available', async ({ page }) => {
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('Sending a message shows a fallback reply without a valid API key', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...');
    await input.fill('Hello Sallie');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The user's message appears in the conversation
    await expect(page.getByText('Hello Sallie', { exact: true })).toBeVisible();

    // Sallie replies. Without a valid OPENAI_API_KEY the server responds with
    // its fallback message acknowledging the user's input.
    await expect(page.getByText(/I received your message: "Hello Sallie"/)).toBeVisible({
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
