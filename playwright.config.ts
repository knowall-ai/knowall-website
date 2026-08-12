import { defineConfig, devices } from '@playwright/test';

// Tests run against port 3000 by default; set E2E_PORT to run the suite on a
// different port (e.g. when a dev server for another checkout already owns
// 3000 on a shared machine).
const PORT = process.env.E2E_PORT || '3000';

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
    baseURL: `http://localhost:${PORT}`,
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
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Allow time for the production build
    timeout: 300000,
    env: {
      ...process.env,
      // server.js defaults to port 8080 and dev mode; tests expect a
      // production server on the configured port
      PORT,
      NODE_ENV: 'production',
      // Tests must pass without real secrets. An invalid OpenAI key is always
      // forced by default so the chat specs deterministically exercise the
      // API's fallback response path and never make real OpenAI calls. Set
      // E2E_USE_REAL_OPENAI_KEY=1 to explicitly opt in to passing the real
      // key through. The admin key gates /api/logs.
      OPENAI_API_KEY:
        process.env.E2E_USE_REAL_OPENAI_KEY === '1' && process.env.OPENAI_API_KEY
          ? process.env.OPENAI_API_KEY
          : 'sk-test-invalid-key-for-e2e',
      ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'test-admin-key-for-e2e',
    },
  },
});
