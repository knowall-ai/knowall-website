# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server (uses server.js, port 8080)
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run format:check # Check formatting without modifying files
npm run test         # Run Playwright end-to-end tests
npm run test:ui      # Run tests with Playwright UI
npm run test:headed  # Run tests with visible browser
npm run test:unit    # Run Vitest unit tests
npm run test:unit:watch # Run unit tests in watch mode
```

Run a single test:

```bash
npx playwright test tests/primary-navigation.spec.ts
npx vitest run tests/unit/lib/utils.test.ts
```

## Architecture

**Next.js 15 App Router with custom server** - Uses `server.js` for Azure App Service deployment (listens on `PORT` env var, defaults to 8080).

**Key API routes:**

- `app/api/chat/route.ts` - OpenAI GPT-4o chat endpoint with fallback responses
- `app/api/chat/system-prompt.ts` - Sally AI assistant persona configuration
- `app/api/chat/logger.ts` - Logs conversations to `logs/` directory as JSON
- `app/api/logs/route.ts` - Admin endpoint for viewing chat logs (requires ADMIN_API_KEY)

**Chat flow:** Browser → `/api/chat` (POST) → OpenAI API → Response logged → JSON response returned (not streaming)

**Components:** `components/conversation-interface.tsx` handles the chat UI with speech recognition. UI components in `components/ui/` are shadcn/ui.

## Environment Variables

Required for development (`.env.local`):

- `OPENAI_API_KEY` - For chat functionality
- `ADMIN_API_KEY` - For `/admin/logs` access

## CI/CD

**CI workflow** (`.github/workflows/ci.yml`) runs on push/PR to `master`:

- ESLint check
- Prettier format check

**Deployment** (`.github/workflows/azure-app-service.yml`) deploys to Azure App Service on push to `master`. Resource group: `KnowAllAIRG`, App name: `knowall-website`.

**Production URL:** https://www.knowall.ai

See `docs/TROUBLESHOOTING.adoc` for Azure-specific issues.

## Testing

End-to-end (Playwright) tests are in `tests/` following the `[feature-name].spec.ts` convention. Unit tests (Vitest + React Testing Library) are in `tests/unit/` following the `[name].test.ts(x)` convention. Tests reference requirement IDs in `docs/requirements.yaml`.

Playwright starts a production server (`npm run build && npm run start` on port 3000, see `playwright.config.ts`) and always injects a placeholder (invalid) `OPENAI_API_KEY`, so the chat tests deterministically exercise the API's fallback response path and never call OpenAI — even when a real key is present in the environment. Set `E2E_USE_REAL_OPENAI_KEY=1` to explicitly opt in to passing the real key through. `ADMIN_API_KEY` falls back to a placeholder when unset.
