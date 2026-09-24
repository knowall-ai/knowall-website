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

- `app/api/chat/route.ts` - Chat endpoint (Azure OpenAI `gpt-5.6-sol`, OpenAI as fallback) with static fallback responses
- `app/api/chat/provider.ts` - Picks Azure OpenAI or OpenAI from env; see `docs/AZURE-OPENAI.adoc` for the TPM cap and budget
- `app/api/speak/route.ts`, `app/api/listen/route.ts` - Sallie's voice and ears; `lib/voice-provider.ts` picks the separate Azure voice resource (East US 2) or OpenAI
- `app/api/chat/system-prompt.ts` - Sallie AI assistant persona configuration
- `app/api/chat/logger.ts` - Logs conversations to `logs/` directory as JSON
- `app/api/logs/route.ts` - Admin endpoint for viewing chat logs (requires ADMIN_API_KEY)

**Security headers:** `proxy.ts` sets a per-request nonce CSP on pages (so the root layout awaits `connection()` and pages render per request); `next.config.mjs` adds the baseline headers to every response and a hash-based CSP for `/presentations`, built from the decks' inline scripts at build time. Policies live in `lib/security-headers.mjs`.

**Chat flow:** Browser → `/api/chat` (POST) → Azure OpenAI (v1 base URL via the `openai` SDK) → Response logged → JSON response returned (not streaming). HTTP 429 from Azure (deployment TPM cap hit) yields a "busy" reply rather than the outage fallback.

**Components:** `components/sallie-assistant.tsx` is Sallie's welcome + chat (band, porthole or dock layouts, chosen in `app/page.tsx`); `components/sallie-stage.tsx` is her animated avatar (static robot rig, animated starfield backdrop). UI components in `components/ui/` are shadcn/ui.

**Presentation decks:** reveal.js HTML. Edit the sources in `presentations-src/` (shared head, closing slide and Security/Partners/Products slides are `<!-- @include name {json} -->` partials in `presentations-src/partials/`), then `npm run decks:build` writes `public/presentations/*.html`, which is committed. `public/presentations/decks.json` lists the decks (gallery cards, QA harness, site-index test). Shared styles and behaviour live in `knowall-deck.css` / `knowall-deck.js`; decks must not redefine shared classes. QA: `node scripts/verify-presentations.mjs`.

## Environment Variables

Required for development (`.env.local`):

- `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` - For chat (preferred); `AZURE_OPENAI_DEPLOYMENT` optional
- `AZURE_OPENAI_VOICE_ENDPOINT` + `AZURE_OPENAI_VOICE_API_KEY` - For voice (`/api/speak`, `/api/listen`), a separate resource
- `OPENAI_API_KEY` - Fallback for chat and voice when the Azure settings are absent
- `ADMIN_API_KEY` - For `/admin/logs` access
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - Optional locally (set on App Service). Cookieless page views (`/api/collect`, from `components/page-view-beacon.tsx`) and one `SallieChatTurn` event per chat turn go to the `knowall-website` App Insights resource via `lib/analytics/` (no SDK, no IPs: only a truncated network for geolocation). Read by the sales portal's Website page (knowall-ai/sallie `web/`)
- `ANALYTICS_SALT` - Secret the day's visitor-hash salt is derived from (HMAC of it and the UTC date; only today's salt is held, in memory); without it each process uses a random one
- `COLLECT_LIMIT_PER_IP` / `COLLECT_BUDGET_PER_DAY` - Optional: page-view beacon limits (120 per IP per window, 20,000 a day). `/api/collect` needs an Origin from one of the site's hosts (`lib/request-guards.ts`) and is capped at 2 KB a body
- Chat log retention: `logs/chat-logs.json` entries older than 30 days are pruned on each write and read (`LOG_RETENTION_DAYS`)
- `CONTACT_MAIL_TENANT_ID` + `CONTACT_MAIL_CLIENT_ID` + `CONTACT_MAIL_CLIENT_SECRET` - Contact form email (Sallie → hello@ via Graph); without them `/api/contact` returns 503. See `docs/CONTACT.adoc`

## CI/CD

**CI workflow** (`.github/workflows/ci.yml`) runs on push/PR to `master`:

- ESLint check
- Prettier format check
- TypeScript check (`npm run typecheck`)
- Unit tests (`npm run test:unit`, Vitest)
- Playwright e2e tests (Chromium; no secrets needed — chat API falls back without `OPENAI_API_KEY`)
- Production build (`npm run build`)

**PR lint** (`.github/workflows/pr-lint.yml`) enforces conventional-commit PR titles, a meaningful body, `Fixes #nnn` for feat/fix/perf/refactor, and a `## Test plan` section.

**Claude Code Review** (`.github/workflows/claude-code-review.yml`) is manually dispatched with a PR number (requires `ANTHROPIC_API_KEY` secret).

**Dependabot** (`.github/dependabot.yml`) opens weekly npm and github-actions update PRs.

**Deployment** (`.github/workflows/azure-app-service.yml`) deploys to Azure App Service when a `v*` tag is pushed (e.g. `git tag v0.1.1 && git push origin v0.1.1`), or manually via `workflow_dispatch`. Resource group: `KnowAllAIRG`, App name: `knowall-website`.

**Production URL:** https://www.knowall.ai

See `docs/TROUBLESHOOTING.adoc` for Azure-specific issues.

## Testing

End-to-end (Playwright) tests are in `tests/` following the `[feature-name].spec.ts` convention. Unit tests (Vitest + React Testing Library) are in `tests/unit/` following the `[name].test.ts(x)` convention.

Playwright starts a production server (`npm run build && npm run start` on port 3000, see `playwright.config.ts`) and always injects a placeholder (invalid) `OPENAI_API_KEY`, so the chat tests deterministically exercise the API's fallback response path and never call OpenAI — even when a real key is present in the environment. Set `E2E_USE_REAL_OPENAI_KEY=1` to explicitly opt in to passing the real key through. `ADMIN_API_KEY` falls back to a placeholder when unset.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
