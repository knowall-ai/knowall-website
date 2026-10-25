/**
 * Server-side order pricing (lib/pricing.js): the order total is recomputed from
 * KnowAll's signed catalog; the buyer's `amount` is only compared.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import {
  buildVerifiedCatalog,
  convertToSats,
  FIAT_RATE_TOLERANCE,
  MAX_QUANTITY,
  needsExchangeRates,
  priceOrder,
} from '../lib/pricing.js';

const merchantSk = generateSecretKey();
const MERCHANT = getPublicKey(merchantSk);
const now = Math.floor(Date.now() / 1000);

// 1 GBP = 1,250 sats (BTC at £80,000), 1 USD = 1,000, 1 EUR = 1,087.
const RATES = { satsPerGbp: 1250, satsPerUsd: 1000, satsPerEur: 1087 };

function listing(d, priceTags, extraTags = [], { sk = merchantSk, created_at = now } = {}) {
  return finalizeEvent(
    {
      kind: 30402,
      created_at,
      content: '',
      tags: [['d', d], ['title', d], ['price', ...priceTags], ...extraTags],
    },
    sk
  );
}

function shippingOption(d, priceTags, { sk = merchantSk } = {}) {
  return finalizeEvent(
    {
      kind: 30406,
      created_at: now,
      content: '',
      tags: [
        ['d', d],
        ['title', d],
        ['price', ...priceTags],
      ],
    },
    sk
  );
}

const ref = (d) => `30402:${MERCHANT}:${d}`;
const shipRef = (d) => `30406:${MERCHANT}:${d}`;

const STICKERS = listing('stickers', ['10000', 'SATS']);
const BOOK = listing('book', ['9.99', 'GBP'], [['shipping_option', shipRef('uk'), '1.50']]);
const UK = shippingOption('uk', ['5', 'GBP']);

const catalog = (events) => buildVerifiedCatalog(events, MERCHANT);
const price = (order, events = [STICKERS, BOOK, UK]) =>
  priceOrder(order, catalog(events), { merchantPubkey: MERCHANT, rates: RATES });

test('a sats-priced order with the exact amount is accepted at the server total', () => {
  const result = price(
    { amount: 20000, items: [{ ref: ref('stickers'), quantity: 2 }], shippingRef: shipRef('uk') },
    [STICKERS]
  );
  // No shipping options in this catalog -> but a shippingRef was sent: rejected.
  assert.equal(result.ok, false);

  const ok = price({ amount: 20000, items: [{ ref: ref('stickers'), quantity: 2 }] }, [STICKERS]);
  assert.deepEqual(ok, {
    ok: true,
    totalSats: 20000,
    itemsSats: 20000,
    shippingSats: 0,
    fiatSats: 0,
  });
});

test('a sats-only order must match to the sat (no tolerance)', () => {
  const result = price({ amount: 19999, items: [{ ref: ref('stickers'), quantity: 2 }] }, [
    STICKERS,
  ]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not match/);
});

test('fiat items + shipping: total mirrors the website (price x qty + base + extra cost)', () => {
  // Items 2 x £9.99 = £19.98 -> round(19.98 * 1250) = 24975
  // Shipping £5 + £1.50 extra = £6.50 -> 8125
  const result = price({
    amount: 33100,
    items: [{ ref: ref('book'), quantity: 2 }],
    shippingRef: shipRef('uk'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.itemsSats, 24975);
  assert.equal(result.shippingSats, 8125);
  assert.equal(result.totalSats, 33100);
});

test('fiat totals tolerate small rate drift but reject a lowballed amount', () => {
  const order = (amount) => ({
    amount,
    items: [{ ref: ref('book'), quantity: 2 }],
    shippingRef: shipRef('uk'),
  });
  const drift = Math.floor(33100 * FIAT_RATE_TOLERANCE);
  const within = price(order(33100 - drift));
  assert.equal(within.ok, true);
  assert.equal(within.totalSats, 33100, 'the invoice uses the server figure, not the buyer figure');

  const lowball = price(order(1000));
  assert.equal(lowball.ok, false);
  assert.match(lowball.reason, /does not match/);
});

test('mixed-currency cart: each currency is converted on its own', () => {
  // 10000 sats + £9.99 (12488 sats, rounded) + £6.50 shipping (8125)
  const result = price({
    amount: 30613,
    items: [
      { ref: ref('stickers'), quantity: 1 },
      { ref: ref('book'), quantity: 1 },
    ],
    shippingRef: shipRef('uk'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.totalSats, 10000 + 12488 + 8125);
});

test('an unknown item is rejected', () => {
  const result = price({ amount: 1000, items: [{ ref: ref('does-not-exist'), quantity: 1 }] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no longer in the KnowAll catalogue/);
});

test('an item authored by someone else is rejected', () => {
  const otherSk = generateSecretKey();
  const other = getPublicKey(otherSk);
  const theirs = listing('stickers', ['1', 'SATS'], [], { sk: otherSk });
  const result = priceOrder(
    { amount: 1, items: [{ ref: `30402:${other}:stickers`, quantity: 1 }] },
    buildVerifiedCatalog([STICKERS, theirs], MERCHANT),
    { merchantPubkey: MERCHANT, rates: RATES }
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /not sold by KnowAll/);
});

test('a forged (bad-signature) cheaper listing is ignored in favour of the signed one', () => {
  // JSON round-trip, as from a relay: a spread would carry nostr-tools' cached
  // "verified" symbol over from the genuine event.
  const forged = {
    ...JSON.parse(JSON.stringify(STICKERS)),
    created_at: now + 60,
    tags: [
      ['d', 'stickers'],
      ['title', 'x'],
      ['price', '1', 'SATS'],
    ],
  };
  const verified = buildVerifiedCatalog([STICKERS, forged], MERCHANT);
  assert.equal(
    verified.listings.get(ref('stickers')).id,
    STICKERS.id,
    'forged newer event dropped'
  );

  const accepted = priceOrder(
    { amount: 1, items: [{ ref: ref('stickers'), quantity: 1 }] },
    verified,
    {
      merchantPubkey: MERCHANT,
    }
  );
  assert.equal(accepted.ok, false, 'the forged 1-sat price cannot be used');

  // A forged event alone (no genuine one) leaves the item unknown.
  const onlyForged = buildVerifiedCatalog([forged], MERCHANT);
  assert.equal(onlyForged.listings.size, 0);
});

test('quantity must be 1..MAX_QUANTITY', () => {
  for (const quantity of [null, 0, MAX_QUANTITY + 1]) {
    const result = price({ amount: 10000, items: [{ ref: ref('stickers'), quantity }] }, [
      STICKERS,
    ]);
    assert.equal(result.ok, false, `quantity ${quantity}`);
    assert.match(result.reason, /quantity/);
  }
});

test('a shipping method is required when the merchant offers one', () => {
  const result = price({ amount: 12488, items: [{ ref: ref('book'), quantity: 1 }] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no shipping method/);
});

test('a shipping option the listing does not reference is refused when referenced ones exist', () => {
  const eu = shippingOption('eu', ['0', 'GBP']);
  const result = price(
    { amount: 12488, items: [{ ref: ref('book'), quantity: 1 }], shippingRef: shipRef('eu') },
    [BOOK, UK, eu]
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /shipping method is not available/);
});

test('convertToSats mirrors the website hook', () => {
  assert.equal(convertToSats(10000.4, 'SATS'), 10000);
  assert.equal(convertToSats(0.001, 'BTC'), 100000);
  assert.equal(convertToSats(2, 'gbp', RATES), 2500);
  assert.equal(convertToSats(2, 'EUR', RATES), 2174);
  assert.equal(convertToSats(2, 'CAD', RATES), 2000, 'unknown fiat prices as USD');
  assert.throws(() => convertToSats(1, 'GBP'), /Exchange rates required/);
});

test('needsExchangeRates is false for a sats-only order', () => {
  const order = { amount: 10000, items: [{ ref: ref('stickers'), quantity: 1 }] };
  assert.equal(needsExchangeRates(order, catalog([STICKERS])), false);
  assert.equal(
    needsExchangeRates({ ...order, items: [{ ref: ref('book'), quantity: 1 }] }, catalog([BOOK])),
    true
  );
});

test('sold-out listings and quantities above stock are refused', () => {
  const sold = listing('sold', ['100', 'SATS'], [['status', 'sold']]);
  const empty = listing('empty', ['100', 'SATS'], [['stock', '0']]);
  const two = listing('two', ['100', 'SATS'], [['stock', '2']]);
  const events = [sold, empty, two];
  for (const d of ['sold', 'empty']) {
    const result = price({ amount: 100, items: [{ ref: ref(d), quantity: 1 }] }, events);
    assert.match(result.reason, /sold out/, d);
  }
  const over = price(
    {
      amount: 300,
      items: [
        { ref: ref('two'), quantity: 2 },
        { ref: ref('two'), quantity: 1 },
      ],
    },
    events
  );
  assert.match(over.reason, /only 2 of an item are in stock/);
  assert.equal(price({ amount: 200, items: [{ ref: ref('two'), quantity: 2 }] }, events).ok, true);
});

test('loadCatalog: listings needing shipping but no shipping options returned is retryable', async () => {
  const { loadCatalog } = await import('../lib/catalog.js');
  const pool = {
    querySync: async (_relays, filter) => (filter.kinds[0] === 30402 ? [BOOK] : []),
  };
  const order = { items: [{ ref: ref('book'), quantity: 1 }] };
  await assert.rejects(loadCatalog(pool, ['wss://x'], order, MERCHANT), /Catalog unavailable/);

  const ok = { querySync: async (_r, f) => (f.kinds[0] === 30402 ? [BOOK] : [UK]) };
  const catalog = await loadCatalog(ok, ['wss://x'], order, MERCHANT);
  assert.equal(catalog.shippingOptions.size, 1);
});
