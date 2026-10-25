# KnowAll AI Order Service

A standalone Node daemon (ported from robotechy.com's order-service) that answers shop orders automatically. It subscribes to the shop relays for NIP-17 gift wraps (kind 1059) addressed to the KnowAll npub with a 2-day lookback, unwraps each to its inner Gamma Markets rumor, and:

1. **Kind 16 type 1 (order creation)** → **prices the order itself** from KnowAll's signed catalog (see _Server-side pricing_), then generates a BOLT11 invoice for that server-computed total via LNURL-pay and replies with a gift-wrapped **kind 16 type 2 payment request** (plus a kind-14 chat-note copy for generic DM clients). An order that doesn't price correctly gets a gift-wrapped **kind 16 type 3 `cancelled`** status with the reason instead.
2. **Kind 17 (payment receipt)** → **verifies the payment** against the invoice it issued (see _Payment verification_) and only then replies with a gift-wrapped **kind 16 type 3 `confirmed`** thank-you (plus a readable kind-14 line).

Every gift wrap's kind-13 seal must carry a valid signature from the sender (NIP-59), and the inner rumor's pubkey must equal the seal's; anything else is dropped before it is parsed.

## Server-side pricing

The buyer's `amount` tag is untrusted and is **never invoiced**. For each order the service (`lib/catalog.js`, `lib/pricing.js`):

1. Fetches the ordered kind-30402 listings and all kind-30406 shipping options from `CATALOG_RELAYS`, keeps only events **authored by the company pubkey whose signature verifies**, newest per d-tag.
2. Recomputes the total exactly as the website checkout does (`lib/gamma-order.ts` `orderTotalSats`): price × quantity summed per currency, each currency converted to sats once, plus the chosen shipping option's base price and the largest per-product `shipping_option` extra cost. Fiat is converted with the same rate source as the checkout (`lib/exchangeRate.js`, a port of the site's `lib/exchange-rate.ts`: the CoinGecko/Kraken/Coinbase average, cached 5 minutes) — but with no hard-coded fallback rate: if every source fails the order stays retryable rather than being invoiced at a guess.
3. Rejects — with a buyer-readable `cancelled` status — unknown or forged items, items by any other author, sold-out items, quantities outside 1–999 or above the listing's `stock`, a missing or unavailable shipping method, and an `amount` that differs from the recomputed total. Sat-priced parts must match exactly; the fiat-converted part may differ by up to 5% (`FIAT_RATE_TOLERANCE`), since the buyer's page and the service fetch rates at different moments. Accepted orders are invoiced for the **server's** figure.

A relay outage (no catalog events at all, or listings that reference shipping options but none came back) or a rate outage leaves the order retryable instead of cancelling it. A retry re-sends the invoice already recorded for the order rather than issuing a new one, so a buyer who paid the first copy can still be confirmed. A "paid" confirmation only becomes final once it is published; if delivery fails, the receipt is re-checked on its next delivery.

## Payment verification

When an invoice is issued the service decodes it (`light-bolt11-decoder`), checks its amount equals the server total, and persists `{ invoice, paymentHash, amountSats, buyerPubkey, verifyUrl }` per order in the store **before** sending it. A kind-17 receipt (`lib/payment.js`) confirms the order only when:

- the order has a recorded invoice, the receipt comes from that order's buyer, and the order isn't already confirmed;
- the receipt's invoice, if present, is ours;
- `sha256(preimage)` equals the invoice's payment hash; and
- when the LNURL-pay callback returned a [LUD-21](https://github.com/lnurl/luds/blob/luds/21.md) `verify` URL, that endpoint reports `settled: true` (retried briefly). If the endpoint can't be reached, the preimage check stands alone.

Bogus receipts are logged and get no reply. A receipt the provider reports unsettled gets a neutral "couldn't confirm the payment yet" note and is not persisted, so a restart re-checks it.

All commerce traffic is NIP-17 end-to-end encrypted — customer PII never appears in plaintext events, and the service never writes buyer PII (address, email, order notes) to its logs; only presence is logged.

## One invoice, two surfaces

The service generates **exactly one** BOLT11 per order. That single invoice is delivered two ways, both gift-wrapped to the buyer and both tagged `['order', <id>]`:

- the **kind-16 type-2 card** — the very event the website's checkout panel (`lib/gamma-order.ts` → `parsePaymentRequest`) decrypts and renders as its invoice QR, and
- a **kind-14 chat note** carrying the same BOLT11, so generic NIP-17 clients (0xchat, Amethyst's DM view) that can't render kind-16 cards still show the invoice.

The two can never diverge (one `generateInvoice` call, asserted by `test/single-invoice.test.js`), and one BOLT11 settles only once, so the copy cannot enable double payment. Orders are claimed in-memory while being processed (so the same order can never invoice twice concurrently) and recorded in a persistent dedup store (`data/.processed.json`, atomic writes, pruned to the 2-day lookback) **only once the payment request has been delivered** — a transient LNURL or relay failure leaves the order retryable on its next re-delivery instead of dropping it, while a delivered order is never re-invoiced across restarts. Relay errors are classified (`lib/relayErrors.js`) so a flaky relay can never crash order processing.

## Configuration (environment only)

| Variable            | Required | Description                                                                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ORDER_SERVICE_KEY` | yes      | The **KnowAll AI company identity's** secret key, as `nsec1...` or 64-char hex. Supplied at deployment, never committed. |
| `LIGHTNING_ADDRESS` | yes      | Lightning Address (LNURL-pay) invoices are generated from, e.g. `shop@getalby.com`.                                      |
| `RELAYS`            | no       | Comma-separated relay URLs. Defaults to the site's shop set: `relay.damus.io`, `nos.lol`, `relay.primal.net`.            |
| `CATALOG_RELAYS`    | no       | Relays the catalog is read from when pricing. Defaults to the website's `SHOP_RELAYS` (Plebeian Market relay first).     |

Copy `.env.example` to `.env` for local runs (gitignored); in deployment set the variables on the host (App Service settings, container env, systemd `EnvironmentFile`).

### Key custody

By decision, the service runs **as the KnowAll AI company npub** (`npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar`) — the same identity the shop listings are published under, so buyers' orders and the replies stay in one conversation. Startup derives the pubkey from `ORDER_SERVICE_KEY` and **refuses to run** unless it equals the company pubkey (the same safety-stop pattern as our Amber signing scripts) — a wrong or typo'd key can never silently listen on the wrong npub.

**Security note:** this means the host running the service holds the company identity key. Protect the host accordingly (restrict access, keep the key only in the environment/secret store, never in the image or repo), and rotate the key if the host is ever compromised.

## Running

```bash
cd order-service
npm install
node index.js        # or: npm start, or npm run dev  # dev = watch mode
npm test             # node --test (hermetic — no relays, no keys, no network)
```

The service is **not part of the Next.js deployment** — `server.js`/App Service serve the website only. Run the order service as its own long-lived process. On Azure the natural fits are a container (Azure Container Apps / App Service container with a volume or Azure Files mount at `order-service/data/` so the dedup store survives rebuilds) or a small VM with a systemd unit; whichever host is chosen must inject `ORDER_SERVICE_KEY` from a secret store (e.g. Key Vault reference) rather than baking it into an image.

## Tests

- `test/orderParser.test.js` — receipt parsing + stable dedup key
- `test/pricing.test.js` — server-side pricing: exact sats match, fiat tolerance, mismatch, unknown item, wrong author, forged signature, quantity cap, shipping rules
- `test/payment.test.js` — BOLT11 decoding, preimage check, LUD-21 settled/unsettled/unreachable, and the receipt handler (valid/wrong preimage, unknown order, wrong sender, already paid)
- `test/nostr.test.js` — NIP-59 unwrap authentication (seal signature, spoof/tamper rejection), monotonic poll cursor
- `test/processedStore.test.js` — dedup and invoice-record persistence across restarts, pruning, fresh-dir creation
- `test/relayErrors.test.js` — relay-noise classification (transient errors swallowed, real bugs fatal)
- `test/single-invoice.test.js` — the one-invoice invariant (single `generateInvoice` call, identical BOLT11 in card + note, dedup on replay, no NIP-04), invoicing the server-computed total, and cancelling mispriced/unknown orders
- `test/config.test.js` — key decoding (nsec + hex) and the company-identity safety stop

The site-side integration round-trip lives in the website's Vitest suite (`tests/unit/lib/order-service-roundtrip.test.ts`): the payment request this service creates must parse exactly with the checkout panel's `parsePaymentRequest`, and the checkout's order tags must parse with this service's `parseOrderEvent`.
