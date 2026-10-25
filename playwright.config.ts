import { defineConfig, devices } from '@playwright/test';

/** Opt in to real Azure OpenAI calls from e2e tests (off by default). */
const useRealAzure = process.env.E2E_USE_REAL_AZURE === '1';

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
      // Shop specs script unsigned relay events "by" the KnowAll pubkey (the
      // tests can't sign as the company). This build-time flag lets ONLY
      // unsigned events through lib/nostr-verify, on localhost only; real
      // builds never set it. See lib/nostr-verify.ts.
      NEXT_PUBLIC_E2E_ALLOW_UNSIGNED_RELAY_EVENTS: '1',
      // server.js defaults to port 8080 and dev mode; tests expect a
      // production server on the configured port
      PORT,
      NODE_ENV: 'production',
      // Tests must pass without real secrets. Chat is Azure OpenAI only, so an
      // invalid Azure endpoint and key are forced by default: the chat specs
      // deterministically exercise the API's fallback response path and never
      // reach a real model. Set E2E_USE_REAL_AZURE=1 to explicitly opt in to
      // passing the real Azure settings through. Voice is off unless opted in.
      // The admin key gates /api/logs.
      AZURE_OPENAI_ENDPOINT: useRealAzure
        ? (process.env.AZURE_OPENAI_ENDPOINT ?? '')
        : 'https://e2e-invalid-knowall.openai.azure.com',
      AZURE_OPENAI_API_KEY: useRealAzure
        ? (process.env.AZURE_OPENAI_API_KEY ?? '')
        : 'e2e-invalid-key',
      AZURE_OPENAI_VOICE_ENDPOINT: useRealAzure
        ? (process.env.AZURE_OPENAI_VOICE_ENDPOINT ?? '')
        : '',
      AZURE_OPENAI_VOICE_API_KEY: useRealAzure
        ? (process.env.AZURE_OPENAI_VOICE_API_KEY ?? '')
        : '',
      ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'test-admin-key-for-e2e',
    },
  },
});
