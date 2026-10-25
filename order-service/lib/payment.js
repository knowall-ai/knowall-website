/**
 * Payment verification for kind-17 receipts.
 *
 * A receipt is buyer-supplied, so it proves nothing on its own. Before the
 * service tells a buyer their order is paid it checks the receipt against the
 * invoice it issued for that order (persisted in the ProcessedStore):
 *
 *   1. Preimage — sha256(preimage) must equal the invoice's payment hash. Only
 *      the receiving node knows the preimage until the invoice is paid, so a
 *      matching preimage is proof of payment. Always required.
 *   2. LUD-21 verify — when the LNURL-pay callback returned a `verify` URL, the
 *      provider is also asked directly and must report `settled: true`. If the
 *      provider can't be reached, the preimage check stands on its own.
 */

import { createHash } from 'node:crypto';
import bolt11 from 'light-bolt11-decoder';

const VERIFY_TIMEOUT_MS = 10_000;

/**
 * Decode the bits of a BOLT11 invoice the service relies on.
 * @param {string} invoice
 * @returns {{ paymentHash: string, amountMsat: number | null }}
 * @throws when the invoice can't be decoded or has no payment hash
 */
export function decodeInvoice(invoice) {
  const { sections } = bolt11.decode(invoice);
  const paymentHash = sections.find((s) => s.name === 'payment_hash')?.value;
  if (typeof paymentHash !== 'string' || !/^[0-9a-f]{64}$/i.test(paymentHash)) {
    throw new Error('Invoice has no payment hash');
  }
  const amount = sections.find((s) => s.name === 'amount')?.value;
  return {
    paymentHash: paymentHash.toLowerCase(),
    amountMsat: amount != null ? Number(amount) : null,
  };
}

/** sha256(preimage) === paymentHash, for a 32-byte hex preimage. Never throws. */
export function preimageMatches(preimage, paymentHash) {
  if (typeof preimage !== 'string' || !/^[0-9a-f]{64}$/i.test(preimage)) return false;
  if (typeof paymentHash !== 'string') return false;
  const digest = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
  return digest === paymentHash.toLowerCase();
}

/**
 * Ask the LUD-21 verify endpoint whether the invoice settled.
 * @returns {Promise<boolean | null>} true/false from the provider, or null when
 *   it couldn't answer (network error, non-OK HTTP, malformed or ERROR body).
 */
export async function checkLud21(verifyUrl, { fetch: fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(verifyUrl, { signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status === 'ERROR' || typeof data?.settled !== 'boolean') return null;
    return data.settled;
  } catch {
    return null;
  }
}

/**
 * Decide whether a receipt proves payment of the invoice we issued.
 *
 * @param {{ invoice: string, paymentHash: string, verifyUrl?: string }} record - our issued invoice
 * @param {{ invoice?: string, preimage?: string }} receipt - parsed kind-17 receipt
 * @param {{ fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, attempts?: number, retryMs?: number }} [deps]
 * @returns {Promise<{ status: 'confirmed', method: 'lud21' | 'preimage' }
 *   | { status: 'unsettled' }
 *   | { status: 'invalid', reason: string }>}
 */
export async function verifyPayment(
  record,
  receipt,
  {
    fetch: fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    attempts = 3,
    retryMs = 3000,
  } = {}
) {
  if (receipt.invoice && receipt.invoice !== record.invoice) {
    return { status: 'invalid', reason: 'receipt invoice does not match the issued invoice' };
  }
  if (!preimageMatches(receipt.preimage, record.paymentHash)) {
    return { status: 'invalid', reason: 'preimage does not match the invoice payment hash' };
  }
  if (!record.verifyUrl) return { status: 'confirmed', method: 'preimage' };

  // The provider may lag the buyer's wallet by a moment — retry briefly.
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const settled = await checkLud21(record.verifyUrl, { fetch: fetchImpl });
    if (settled === true) return { status: 'confirmed', method: 'lud21' };
    if (settled === null) return { status: 'confirmed', method: 'preimage' };
    if (attempt < attempts) await sleep(retryMs);
  }
  return { status: 'unsettled' };
}
