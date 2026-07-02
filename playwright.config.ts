import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Only run Playwright specs; unit tests in tests/unit/ are run by Vitest
  testMatch: '**/*.spec.ts',
  testIgnore: 'unit/**',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Run against a production build: the dev server compiles on demand,
    // which is too slow/flaky for a full parallel test run. A locally running
    // dev server on port 3000 is still reused when present.
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Allow time for the production build
    timeout: 300000,
    env: {
      ...process.env,
      // server.js defaults to port 8080 and dev mode; tests expect a
      // production server on port 3000
      PORT: '3000',
      NODE_ENV: 'production',
      // Tests must pass without real secrets. An invalid OpenAI key exercises
      // the chat API's fallback response path; the admin key gates /api/logs.
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-invalid-key-for-e2e',
      ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'test-admin-key-for-e2e',
    },
  },
});
