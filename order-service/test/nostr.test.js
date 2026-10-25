/**
 * Tests for the order-service NIP-59 unwrap authentication and the polling
 * cursor monotonicity. Uses Node's built-in test runner (no extra deps):
 *   node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSecretKey, getPublicKey, finalizeEvent, nip44, nip59 } from 'nostr-tools';
import { NostrClient } from '../lib/nostr.js';

const now = () => Math.floor(Date.now() / 1000);

function encryptTo(senderSk, recipientPk, plaintext) {
  return nip44.encrypt(plaintext, nip44.getConversationKey(senderSk, recipientPk));
}

/**
 * Build a NIP-59 gift wrap (kind 1059) addressed to `merchantPk`.
 * @param {object} opts
 * @param {Uint8Array} opts.senderSk - signs the seal (the authenticated sender)
 * @param {string} opts.merchantPk - recipient
 * @param {string} [opts.rumorPubkey] - pubkey written into the inner rumor
 *   (defaults to the sender's pubkey; set differently to forge/spoof)
 * @param {boolean} [opts.tamperSealPubkey] - reassign the seal's `pubkey` to a
 *   different (forged) key after signing (fails seal-signature verification).
 * @param {'forge' | 'strip'} [opts.sealSig] - 'forge' swaps in another event's
 *   (well-formed but wrong) signature; 'strip' sends an unsigned seal.
 */
function buildGiftWrap({ senderSk, merchantPk, rumorPubkey, tamperSealPubkey = false, sealSig }) {
  const senderPk = getPublicKey(senderSk);
  const rumor = {
    kind: 16,
    pubkey: rumorPubkey ?? senderPk,
    content: 'test order',
    tags: [['p', merchantPk]],
    created_at: now(),
  };

  const sealTemplate = {
    kind: 13,
    content: encryptTo(senderSk, merchantPk, JSON.stringify(rumor)),
    tags: [],
    created_at: now(),
  };
  let seal = finalizeEvent(sealTemplate, senderSk);

  // JSON round-trip, as a real seal arrives: drops nostr-tools' cached
  // "verified" marker so tampering below is actually re-checked.
  seal = JSON.parse(JSON.stringify(seal));
  if (tamperSealPubkey) {
    const victimPk = getPublicKey(generateSecretKey());
    seal = { ...seal, pubkey: victimPk };
  }
  if (sealSig === 'forge') {
    const other = finalizeEvent({ ...sealTemplate, content: 'x' }, senderSk);
    seal = { ...seal, sig: other.sig };
  } else if (sealSig === 'strip') {
    delete seal.sig;
  }

  const ephemeralSk = generateSecretKey();
  const wrapTemplate = {
    kind: 1059,
    content: encryptTo(ephemeralSk, merchantPk, JSON.stringify(seal)),
    tags: [['p', merchantPk]],
    created_at: now(),
  };
  return finalizeEvent(wrapTemplate, ephemeralSk);
}

test('unwrapGiftWrap returns the rumor for a valid, authenticated gift wrap', () => {
  const merchantSk = generateSecretKey();
  const merchantPk = getPublicKey(merchantSk);
  const senderSk = generateSecretKey();
  const senderPk = getPublicKey(senderSk);

  const client = new NostrClient(merchantSk, []);
  const wrap = buildGiftWrap({ senderSk, merchantPk });

  const rumor = client.unwrapGiftWrap(wrap);
  assert.ok(rumor, 'expected a rumor');
  assert.equal(rumor.kind, 16);
  assert.equal(rumor.pubkey, senderPk, 'rumor pubkey is the authenticated sender');
  client.pool.close([]);
});

test('unwrapGiftWrap rejects a rumor whose pubkey != seal pubkey (spoofing)', () => {
  const merchantSk = generateSecretKey();
  const merchantPk = getPublicKey(merchantSk);
  const attackerSk = generateSecretKey();
  const victimPk = getPublicKey(generateSecretKey());

  const client = new NostrClient(merchantSk, []);
  // Attacker signs the seal but forges the inner rumor's pubkey to the victim.
  const wrap = buildGiftWrap({ senderSk: attackerSk, merchantPk, rumorPubkey: victimPk });

  const rumor = client.unwrapGiftWrap(wrap);
  assert.equal(rumor, null, 'spoofed rumor must be rejected');
  client.pool.close([]);
});

test('unwrapGiftWrap rejects a seal with a bad signature', () => {
  const merchantSk = generateSecretKey();
  const merchantPk = getPublicKey(merchantSk);
  const senderSk = generateSecretKey();
  const client = new NostrClient(merchantSk, []);
  for (const sealSig of ['forge', 'strip']) {
    const rumor = client.unwrapGiftWrap(buildGiftWrap({ senderSk, merchantPk, sealSig }));
    assert.equal(rumor, null, `seal signature (${sealSig}) must be rejected`);
  }
  client.pool.close([]);
});

test('unwrapGiftWrap accepts a nostr-tools nip59 wrap (the website and service format)', () => {
  const merchantSk = generateSecretKey();
  const senderSk = generateSecretKey();
  const client = new NostrClient(merchantSk, []);
  const wrap = nip59.wrapEvent(
    { kind: 16, content: '', tags: [], created_at: now() },
    senderSk,
    getPublicKey(merchantSk)
  );
  const rumor = client.unwrapGiftWrap(JSON.parse(JSON.stringify(wrap)));
  assert.ok(rumor);
  assert.equal(rumor.pubkey, getPublicKey(senderSk));
  client.pool.close([]);
});

test('unwrapGiftWrap rejects a seal whose pubkey was reassigned', () => {
  const merchantSk = generateSecretKey();
  const merchantPk = getPublicKey(merchantSk);
  const senderSk = generateSecretKey();

  const client = new NostrClient(merchantSk, []);
  const wrap = buildGiftWrap({ senderSk, merchantPk, tamperSealPubkey: true });

  const rumor = client.unwrapGiftWrap(wrap);
  assert.equal(rumor, null, 'seal with a reassigned (forged) pubkey must be rejected');
  client.pool.close([]);
});

test('subscribe keeps the since cursor monotonic (never moves backwards)', async () => {
  const merchantSk = generateSecretKey();
  const client = new NostrClient(merchantSk, []);

  const sinceCalls = [];
  // Fake pool: always returns an event with an OLD created_at (mimicking a
  // NIP-59 randomized past timestamp) and records the `since` it was queried with.
  client.pool = {
    querySync: async (_relays, filter) => {
      sinceCalls.push(filter.since);
      return [{ id: `e${sinceCalls.length}`, created_at: 500 }];
    },
    close: () => {},
  };
  client.relays = ['wss://example'];

  const startSince = 100000;
  const lookback = 100;
  const unsub = client.subscribe({ since: startSince }, () => {}, 10, lookback);

  // Let a few poll cycles run.
  await new Promise((r) => setTimeout(r, 60));
  unsub();

  assert.ok(sinceCalls.length >= 2, 'expected multiple polls');
  for (const since of sinceCalls) {
    assert.ok(since >= startSince, `since cursor moved backwards: ${since} < ${startSince}`);
  }
});
