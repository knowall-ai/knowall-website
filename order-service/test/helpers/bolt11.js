/**
 * Test-only BOLT11 encoder: builds a syntactically valid invoice with a chosen
 * amount and payment hash. The signature is zero-filled — light-bolt11-decoder
 * (like the service) never checks it — so tests can bind receipts to a known
 * preimage without a Lightning node.
 */

import { bech32 } from '@scure/base';
import { createHash, randomBytes } from 'node:crypto';

/** 5-bit words for an integer, big-endian, fixed length. */
function intToWords(value, length) {
  const words = new Array(length).fill(0);
  for (let i = length - 1; i >= 0; i -= 1) {
    words[i] = value & 31;
    value = Math.floor(value / 32);
  }
  return words;
}

/** Tagged field: type, 10-bit data length, data words. */
function taggedField(type, dataWords) {
  return [type, ...intToWords(dataWords.length, 2), ...dataWords];
}

/**
 * @param {{ amountSats: number, paymentHash: string, timestamp?: number }} opts
 * @returns {string} BOLT11 invoice
 */
export function encodeTestInvoice({ amountSats, paymentHash, timestamp = 1_700_000_000 }) {
  const hrp = `lnbc${amountSats * 10}n`; // 1n = 100 msat
  const words = [
    ...intToWords(timestamp, 7),
    ...taggedField(1, bech32.toWords(Buffer.from(paymentHash, 'hex'))),
    ...new Array(104).fill(0), // signature + recovery id (unchecked)
  ];
  return bech32.encode(hrp, words, false);
}

/** A fresh preimage, its payment hash, and an invoice for `amountSats`. */
export function testInvoice(amountSats) {
  const preimage = randomBytes(32).toString('hex');
  const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  return { preimage, paymentHash, invoice: encodeTestInvoice({ amountSats, paymentHash }) };
}
