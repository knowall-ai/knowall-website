import { readFileSync } from 'node:fs';
import { SimplePool, nip19 } from 'nostr-tools';
import { BunkerSigner } from 'nostr-tools/nip46';
// Renamed import: the "use" prefix trips ESLint's react-hooks rule in this repo.
import { useWebSocketImplementation as setWebSocketImplementation } from 'nostr-tools/pool';
import { hexToBytes } from '@noble/hashes/utils.js';
import WebSocket from 'ws';
import {
  AMBER_TIMEOUT_MS,
  BUNKER,
  COMPANY_NPUB,
  PUBLISH_RELAYS,
  QUERY_TIMEOUT_MS,
} from './config.mjs';
import { LISTING_KIND } from './listing.mjs';

setWebSocketImplementation(WebSocket);

export function companyPubkeyHex() {
  return nip19.decode(COMPANY_NPUB).data;
}

/**
 * Race a signer request against the Amber approval timeout. Every request is
 * approved by a human on a phone, so failures here usually mean "nobody
 * tapped Approve yet", not a bug.
 */
async function awaitAmber(promise, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${AMBER_TIMEOUT_MS / 60000} minutes waiting for Amber to ${what}.\n` +
            'Each request needs manual approval in the Amber app on the phone holding the ' +
            'KnowAll key. Open Amber, approve the pending request, and re-run this command.'
        )
      );
    }, AMBER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Connect to the Amber remote signer using the paired client key and verify
 * we are talking to the KnowAll company key before anything gets signed.
 */
export async function connectSigner(keyPath) {
  let keyHex;
  try {
    keyHex = readFileSync(keyPath, 'utf8').trim();
  } catch (err) {
    throw new Error(
      `cannot read client key file ${keyPath}: ${err.message}\n` +
        'This file holds the NIP-46 client key paired with Amber (see tools/nostr-listings/README.md). ' +
        'Pass --key <path> or set KNOWALL_NOSTR_KEY_FILE if it lives elsewhere.'
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error(`${keyPath} does not contain a 64-char hex key`);
  }
  const signer = BunkerSigner.fromBunker(hexToBytes(keyHex), BUNKER);
  console.log('Connecting to Amber signer (approval may be needed on the phone)...');
  const pubkey = await awaitAmber(signer.getPublicKey(), 'confirm the connection');
  if (pubkey !== companyPubkeyHex()) {
    throw new Error(
      `SAFETY STOP: signer returned pubkey ${pubkey}, which is not the KnowAll company key ` +
        `(${COMPANY_NPUB}). Refusing to sign anything.`
    );
  }
  console.log('Connected — KnowAll company key confirmed.');
  return signer;
}

/** Ask Amber to sign an event, with clear messaging about the manual step. */
export async function signEvent(signer, event, what) {
  console.log(`Awaiting Amber approval on the phone to sign: ${what} (can take minutes)...`);
  const signed = await awaitAmber(signer.signEvent(event), `sign ${what}`);
  console.log('Signed.');
  return signed;
}

/**
 * Fetch all kind-30402 events for the company key from the publish relays.
 * Sends one single-author filter per request — purplepag.es silently drops
 * multi-author filters, so never batch authors here.
 */
export async function fetchListingEvents() {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(
      PUBLISH_RELAYS,
      { kinds: [LISTING_KIND], authors: [companyPubkeyHex()] },
      { maxWait: QUERY_TIMEOUT_MS }
    );
    // querySync deduplicates by id across relays already; return as-is.
    return events;
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/** Publish a signed event to the publish relays; returns per-relay results. */
export async function publishEvent(signedEvent) {
  const pool = new SimplePool();
  try {
    const results = await Promise.allSettled(pool.publish(PUBLISH_RELAYS, signedEvent));
    return PUBLISH_RELAYS.map((relay, i) => ({
      relay,
      ok: results[i].status === 'fulfilled',
      reason: results[i].status === 'rejected' ? String(results[i].reason) : undefined,
    }));
  } finally {
    pool.close(PUBLISH_RELAYS);
  }
}

/** naddr for an addressable listing, e.g. for sharing/preview links. */
export function listingNaddr(dTag) {
  return nip19.naddrEncode({
    kind: LISTING_KIND,
    pubkey: companyPubkeyHex(),
    identifier: dTag,
  });
}
