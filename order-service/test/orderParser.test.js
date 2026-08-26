/**
 * Tests for payment-receipt parsing and the STABLE dedup key used by
 * handlePaymentReceipt. Uses Node's built-in test runner (no extra deps):
 *   node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ORDER_SATS,
  parseOrderEvent,
  parsePaymentReceipt,
  parseSatAmount,
  receiptDedupKey,
  ORDER_MESSAGE_TYPE,
  ORDER_PROCESS_KIND,
  PAYMENT_RECEIPT_KIND,
} from '../lib/orderParser.js';

const now = () => Math.floor(Date.now() / 1000);

/**
 * Build an UNSIGNED Kind 17 inner rumor (as delivered after gift-wrap unwrap).
 * Crucially it has no `id` - that is the whole point of the dedup-key bug.
 */
function buildReceiptRumor({ orderId, preimage, buyerPk = 'b'.repeat(64) }) {
  return {
    kind: PAYMENT_RECEIPT_KIND,
    pubkey: buyerPk,
    created_at: now(),
    content: '',
    tags: [
      ['p', 'm'.repeat(64)],
      ['order', orderId],
      ['payment', 'lightning', 'lnbc1...', preimage],
      ['amount', '1000'],
    ],
  };
}

test('inner receipt rumor is unsigned (no id) - why event.id dedup breaks', () => {
  const rumor = buildReceiptRumor({ orderId: 'order-1', preimage: 'preimage-1' });
  assert.equal(rumor.id, undefined, 'unsigned rumor has no id; event.id key would be undefined');
});

test('receiptDedupKey is stable for the same payment (true duplicates collapse)', () => {
  const a = parsePaymentReceipt(buildReceiptRumor({ orderId: 'order-1', preimage: 'pre-1' }));
  const b = parsePaymentReceipt(buildReceiptRumor({ orderId: 'order-1', preimage: 'pre-1' }));
  assert.equal(receiptDedupKey(a), receiptDedupKey(b), 'same order+preimage -> same key');
});

test('receiptDedupKey differs for distinct receipts (legit receipts not skipped)', () => {
  const r1 = parsePaymentReceipt(buildReceiptRumor({ orderId: 'order-1', preimage: 'pre-1' }));
  const r2 = parsePaymentReceipt(buildReceiptRumor({ orderId: 'order-2', preimage: 'pre-2' }));
  const r3 = parsePaymentReceipt(buildReceiptRumor({ orderId: 'order-1', preimage: 'pre-3' }));

  const keys = new Set([receiptDedupKey(r1), receiptDedupKey(r2), receiptDedupKey(r3)]);
  assert.equal(keys.size, 3, 'distinct order or preimage must produce distinct keys');
});

function buildOrderRumor(amount, orderId = 'order-1') {
  return {
    kind: ORDER_PROCESS_KIND,
    pubkey: 'b'.repeat(64),
    content: '',
    tags: [
      ['type', ORDER_MESSAGE_TYPE.ORDER_CREATION],
      ['order', orderId],
      ['amount', amount],
      ['item', '30402:pk:book', '1'],
    ],
  };
}

test('parseSatAmount accepts only plain, safe, positive integers within the cap', () => {
  assert.equal(parseSatAmount('1000'), 1000);
  assert.equal(parseSatAmount(String(MAX_ORDER_SATS)), MAX_ORDER_SATS);
  assert.equal(parseSatAmount(String(MAX_ORDER_SATS + 1)), null);
  assert.equal(parseSatAmount('0'), null);
  assert.equal(parseSatAmount('-5'), null);
  assert.equal(parseSatAmount('100abc'), null);
  assert.equal(parseSatAmount('1e3'), null);
  assert.equal(parseSatAmount('10.5'), null);
  assert.equal(parseSatAmount(''), null);
  assert.equal(parseSatAmount(undefined), null);
  assert.equal(parseSatAmount('9'.repeat(320)), null);
});

test('parseOrderEvent rejects orders with malformed or oversized amounts', () => {
  assert.ok(parseOrderEvent(buildOrderRumor('5000')), 'valid amount parses');
  assert.equal(parseOrderEvent(buildOrderRumor('100abc')), null);
  assert.equal(parseOrderEvent(buildOrderRumor('-1')), null);
  assert.equal(parseOrderEvent(buildOrderRumor('0')), null);
  assert.equal(parseOrderEvent(buildOrderRumor(String(MAX_ORDER_SATS + 1))), null);
  // An empty order id is rejected too.
  assert.equal(parseOrderEvent(buildOrderRumor('5000', '')), null);
});
