# KnowAll AI Order Service

A standalone Node daemon (ported from robotechy.com's order-service) that answers shop orders automatically. It subscribes to the shop relays for NIP-17 gift wraps (kind 1059) addressed to the KnowAll npub with a 2-day lookback, unwraps each to its inner Gamma Markets rumor, and:

1. **Kind 16 type 1 (order creation)** → generates a BOLT11 invoice via LNURL-pay from the configured Lightning Address and replies with a gift-wrapped **kind 16 type 2 payment request** (plus a kind-14 chat-note copy for generic DM clients).
2. **Kind 17 (payment receipt)** → replies with a gift-wrapped **kind 16 type 3 thank-you** status update (plus a readable kind-14 line).

All commerce traffic is NIP-17 end-to-end encrypted — customer PII never appears in plaintext events.

## One invoice, two surfaces

The service generates **exactly one** BOLT11 per order. That single invoice is delivered two ways, both gift-wrapped to the buyer and both tagged `['order', <id>]`:

- the **kind-16 type-2 card** — the very event the website's checkout panel (`lib/gamma-order.ts` → `parsePaymentRequest`) decrypts and renders as its invoice QR, and
- a **kind-14 chat note** carrying the same BOLT11, so generic NIP-17 clients (0xchat, Amethyst's DM view) that can't render kind-16 cards still show the invoice.

The two can never diverge (one `generateInvoice` call, asserted by `test/single-invoice.test.js`), and one BOLT11 settles only once, so the copy cannot enable double payment. A persistent dedup store (`data/.processed.json`, atomic writes, pruned to the 2-day lookback) guarantees restarts never re-invoice, and relay errors are classified (`lib/relayErrors.js`) so a flaky relay can never crash order processing.

## Configuration (environment only)

| Variable            | Required | Description                                                                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ORDER_SERVICE_KEY` | yes      | The **KnowAll AI company identity's** secret key, as `nsec1...` or 64-char hex. Supplied at deployment, never committed. |
| `LIGHTNING_ADDRESS` | yes      | Lightning Address (LNURL-pay) invoices are generated from, e.g. `shop@getalby.com`.                                      |
| `RELAYS`            | no       | Comma-separated relay URLs. Defaults to the site's shop set: `relay.damus.io`, `nos.lol`, `relay.primal.net`.            |

Copy `.env.example` to `.env` for local runs (gitignored); in deployment set the variables on the host (App Service settings, container env, systemd `EnvironmentFile`).

### Key custody

By decision, the service runs **as the KnowAll AI company npub** (`npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar`) — the same identity the shop listings are published under, so buyers' orders and the replies stay in one conversation. Startup derives the pubkey from `ORDER_SERVICE_KEY` and **refuses to run** unless it equals the company pubkey (the same safety-stop pattern as our Amber signing scripts) — a wrong or typo'd key can never silently listen on the wrong npub.

**Security note:** this means the host running the service holds the company identity key. Protect the host accordingly (restrict access, keep the key only in the environment/secret store, never in the image or repo), and rotate the key if the host is ever compromised.

## Running

```bash
cd order-service
npm install
node index.js        # or: npm start / npm run dev (--watch)
npm test             # node --test (hermetic — no relays, no keys, no network)
```

The service is **not part of the Next.js deployment** — `server.js`/App Service serve the website only. Run the order service as its own long-lived process. On Azure the natural fits are a container (Azure Container Apps / App Service container with a volume or Azure Files mount at `order-service/data/` so the dedup store survives rebuilds) or a small VM with a systemd unit; whichever host is chosen must inject `ORDER_SERVICE_KEY` from a secret store (e.g. Key Vault reference) rather than baking it into an image.

## Tests

- `test/orderParser.test.js` — receipt parsing + stable dedup key
- `test/nostr.test.js` — NIP-59 unwrap authentication (spoof/tamper rejection), monotonic poll cursor
- `test/processedStore.test.js` — dedup persistence across restarts, pruning, fresh-dir creation
- `test/relayErrors.test.js` — relay-noise classification (transient errors swallowed, real bugs fatal)
- `test/single-invoice.test.js` — the one-invoice invariant (single `generateInvoice` call, identical BOLT11 in card + note, dedup on replay, no NIP-04)
- `test/config.test.js` — key decoding (nsec + hex) and the company-identity safety stop

The site-side integration round-trip lives in the website's Vitest suite (`tests/unit/lib/order-service-roundtrip.test.ts`): the payment request this service creates must parse exactly with the checkout panel's `parsePaymentRequest`, and the checkout's order tags must parse with this service's `parseOrderEvent`.
