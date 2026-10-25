/**
 * Payment verification (lib/payment.js) and the kind-17 receipt handler: a
 * receipt only earns a "paid" reply when it proves payment of OUR invoice.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { testInvoice } from './helpers/bolt11.js';

process.env.ORDER_SERVICE_KEY ||= 'a'.repeat(64);
process.env.LIGHTNING_ADDRESS ||= 'shop@example.com';

const { decodeInvoice, preimageMatches, verifyPayment } = await import('../lib/payment.js');
const { handlePaymentReceipt } = await import('../index.js');

const noSleep = async () => {};
const VERIFY_URL = 'https://ln.example.com/verify/abc';

/** fetch stub answering the LUD-21 verify URL with a sequence of `settled` values. */
function verifyFetch(...answers) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (answer instanceof Error) throw answer;
    return {
      ok: true,
      json: async () => ({ status: 'OK', settled: answer, preimage: null, pr: 'x' }),
    };
  };
  fn.calls = calls;
  return fn;
}

test('decodeInvoice extracts the payment hash and msat amount', () => {
  const { invoice, paymentHash } = testInvoice(2100);
  assert.deepEqual(decodeInvoice(invoice), { paymentHash, amountMsat: 2_100_000 });
  assert.throws(() => decodeInvoice('lnbcnotaninvoice'));
});

test('preimageMatches: sha256(preimage) must equal the payment hash', () => {
  const { preimage, paymentHash } = testInvoice(1);
  assert.equal(preimageMatches(preimage, paymentHash), true);
  assert.equal(preimageMatches(randomBytes(32).toString('hex'), paymentHash), false);
  assert.equal(preimageMatches('zz', paymentHash), false);
  assert.equal(preimageMatches(undefined, paymentHash), false);
});

test('verifyPayment: valid preimage, no verify URL -> confirmed by preimage', async () => {
  const t = testInvoice(500);
  const result = await verifyPayment(
    { invoice: t.invoice, paymentHash: t.paymentHash },
    { invoice: t.invoice, preimage: t.preimage }
  );
  assert.deepEqual(result, { status: 'confirmed', method: 'preimage' });
});

test('verifyPayment: wrong preimage or a different invoice -> invalid', async () => {
  const t = testInvoice(500);
  const record = { invoice: t.invoice, paymentHash: t.paymentHash };
  const wrong = await verifyPayment(record, {
    invoice: t.invoice,
    preimage: randomBytes(32).toString('hex'),
  });
  assert.equal(wrong.status, 'invalid');

  const other = testInvoice(500);
  const swapped = await verifyPayment(record, { invoice: other.invoice, preimage: other.preimage });
  assert.equal(swapped.status, 'invalid', "a paid invoice that isn't ours proves nothing");
});

test('verifyPayment: LUD-21 settled -> confirmed via verify', async () => {
  const t = testInvoice(500);
  const fetch = verifyFetch(true);
  const result = await verifyPayment(
    { invoice: t.invoice, paymentHash: t.paymentHash, verifyUrl: VERIFY_URL },
    { preimage: t.preimage },
    { fetch, sleep: noSleep }
  );
  assert.deepEqual(result, { status: 'confirmed', method: 'lud21' });
  assert.deepEqual(fetch.calls, [VERIFY_URL]);
});

test('verifyPayment: LUD-21 unsettled on every attempt -> unsettled (even with a valid preimage)', async () => {
  const t = testInvoice(500);
  const fetch = verifyFetch(false);
  const result = await verifyPayment(
    { invoice: t.invoice, paymentHash: t.paymentHash, verifyUrl: VERIFY_URL },
    { preimage: t.preimage },
    { fetch, sleep: noSleep, attempts: 3 }
  );
  assert.deepEqual(result, { status: 'unsettled' });
  assert.equal(fetch.calls.length, 3);
});

test('verifyPayment: LUD-21 settles on a retry -> confirmed', async () => {
  const t = testInvoice(500);
  const result = await verifyPayment(
    { invoice: t.invoice, paymentHash: t.paymentHash, verifyUrl: VERIFY_URL },
    { preimage: t.preimage },
    { fetch: verifyFetch(false, true), sleep: noSleep }
  );
  assert.equal(result.status, 'confirmed');
});

test('verifyPayment: verify endpoint unreachable -> falls back to the preimage check', async () => {
  const t = testInvoice(500);
  const record = { invoice: t.invoice, paymentHash: t.paymentHash, verifyUrl: VERIFY_URL };
  const ok = await verifyPayment(
    record,
    { preimage: t.preimage },
    { fetch: verifyFetch(new Error('down')), sleep: noSleep }
  );
  assert.deepEqual(ok, { status: 'confirmed', method: 'preimage' });

  const bad = await verifyPayment(
    record,
    { preimage: randomBytes(32).toString('hex') },
    { fetch: verifyFetch(true), sleep: noSleep }
  );
  assert.equal(bad.status, 'invalid', 'a settled verify never rescues a wrong preimage');
});

/* ---------------------------------------------------------------- handler */

const BUYER = randomBytes(32).toString('hex');

function buildStore() {
  const receipts = new Set();
  const invoices = new Map();
  return {
    invoices,
    hasReceipt: (k) => receipts.has(k),
    addReceipt: (k) => receipts.add(k),
    getInvoice: (id) => invoices.get(id),
    markPaid: (id) => invoices.set(id, { ...invoices.get(id), paidAt: 1 }),
  };
}

function buildClient() {
  const sent = [];
  return {
    sent,
    async sendGiftWrap(recipientPubkey, rumor) {
      sent.push({ recipientPubkey, rumor });
    },
  };
}

function receiptRumor({ orderId, invoice, preimage, pubkey = BUYER }) {
  return {
    kind: 17,
    pubkey,
    content: '',
    tags: [
      ['order', orderId],
      ['payment', 'lightning', invoice, preimage],
      ['amount', '1'],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
}

const statusOf = (rumor) => rumor.tags.find((t) => t[0] === 'status')?.[1];

let store;
let client;
let t;
let orderId;

beforeEach(() => {
  store = buildStore();
  client = buildClient();
  t = testInvoice(4200);
  orderId = randomBytes(16).toString('hex');
  store.invoices.set(orderId, {
    invoice: t.invoice,
    paymentHash: t.paymentHash,
    amountSats: 4200,
    buyerPubkey: BUYER,
    createdAt: 1,
  });
});

test('receipt with a valid preimage -> "confirmed" status + readable thank-you', async () => {
  await handlePaymentReceipt(
    receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage }),
    client,
    { store }
  );
  assert.equal(client.sent.length, 2);
  assert.equal(statusOf(client.sent[0].rumor), 'confirmed');
  assert.match(client.sent[1].rumor.content, /has been paid/);
  assert.ok(store.invoices.get(orderId).paidAt, 'order marked paid');
});

test('receipt with a wrong preimage -> nothing sent, order not paid', async () => {
  const preimage = randomBytes(32).toString('hex');
  await handlePaymentReceipt(receiptRumor({ orderId, invoice: t.invoice, preimage }), client, {
    store,
  });
  assert.equal(client.sent.length, 0);
  assert.equal(store.invoices.get(orderId).paidAt, undefined);
});

test('receipt for an unknown order -> nothing sent', async () => {
  const unknown = randomBytes(16).toString('hex');
  await handlePaymentReceipt(
    receiptRumor({ orderId: unknown, invoice: t.invoice, preimage: t.preimage }),
    client,
    { store }
  );
  assert.equal(client.sent.length, 0);
});

test('receipt from someone other than the buyer -> nothing sent', async () => {
  const pubkey = randomBytes(32).toString('hex');
  await handlePaymentReceipt(
    receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage, pubkey }),
    client,
    { store }
  );
  assert.equal(client.sent.length, 0);
});

test('LUD-21 settled -> confirmed', async () => {
  store.invoices.set(orderId, { ...store.invoices.get(orderId), verifyUrl: VERIFY_URL });
  await handlePaymentReceipt(
    receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage }),
    client,
    {
      store,
      verify: { fetch: verifyFetch(true), sleep: noSleep },
    }
  );
  assert.equal(statusOf(client.sent[0].rumor), 'confirmed');
});

test('LUD-21 unsettled -> neutral note only, never "confirmed", receipt left re-checkable', async () => {
  store.invoices.set(orderId, { ...store.invoices.get(orderId), verifyUrl: VERIFY_URL });
  const rumor = receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage });
  await handlePaymentReceipt(rumor, client, {
    store,
    verify: { fetch: verifyFetch(false), sleep: noSleep },
  });
  assert.equal(client.sent.length, 1);
  assert.equal(client.sent[0].rumor.kind, 14);
  assert.match(client.sent[0].rumor.content, /couldn't confirm the payment yet/);
  assert.ok(client.sent.every(({ rumor: r }) => statusOf(r) !== 'confirmed'));
  assert.equal(store.invoices.get(orderId).paidAt, undefined);

  // Re-delivered once the provider has settled: now confirmed.
  await handlePaymentReceipt(rumor, client, {
    store,
    verify: { fetch: verifyFetch(true), sleep: noSleep },
  });
  assert.equal(statusOf(client.sent[1].rumor), 'confirmed');
});

test('a second receipt after confirmation is a no-op', async () => {
  await handlePaymentReceipt(
    receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage }),
    client,
    { store }
  );
  await handlePaymentReceipt(receiptRumor({ orderId, invoice: '', preimage: t.preimage }), client, {
    store,
  });
  assert.equal(client.sent.length, 2, 'only the first confirmation was sent');
});

test('a verified payment whose confirmation could not be delivered is retried, not marked paid', async () => {
  const rumor = receiptRumor({ orderId, invoice: t.invoice, preimage: t.preimage });
  const offline = {
    async sendGiftWrap() {
      throw new Error('offline');
    },
  };
  await handlePaymentReceipt(rumor, offline, { store });
  assert.equal(store.invoices.get(orderId).paidAt, undefined, 'not final until delivered');

  await handlePaymentReceipt(rumor, client, { store });
  assert.equal(statusOf(client.sent[0].rumor), 'confirmed', 're-delivery confirms');
  assert.ok(store.invoices.get(orderId).paidAt);
});
