/**
 * Tests for ORDER_SERVICE_KEY decoding and the company-identity safety stop.
 * No real keys: everything uses freshly generated throwaway keys.
 *
 *   node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { decodeServiceKey, assertServiceKey } from '../lib/nostr.js';

test('decodeServiceKey accepts an nsec and returns the same key bytes', () => {
  const sk = generateSecretKey();
  const nsec = nip19.nsecEncode(sk);
  assert.deepEqual(decodeServiceKey(nsec), sk);
});

test('decodeServiceKey accepts 64-char hex (either case) and matches the nsec form', () => {
  const sk = generateSecretKey();
  const hex = Buffer.from(sk).toString('hex');
  assert.deepEqual(decodeServiceKey(hex), sk);
  assert.deepEqual(decodeServiceKey(hex.toUpperCase()), sk);
});

test('decodeServiceKey rejects anything else', () => {
  assert.throws(() => decodeServiceKey(''), /nsec1.*or.*hex/);
  assert.throws(() => decodeServiceKey('not-a-key'), /nsec1.*or.*hex/);
  assert.throws(() => decodeServiceKey('deadbeef'), /nsec1.*or.*hex/); // too short
  // npub is a PUBLIC key — must never be accepted as the secret key.
  const npub = nip19.npubEncode(getPublicKey(generateSecretKey()));
  assert.throws(() => decodeServiceKey(npub));
});

test('assertServiceKey passes when the key derives to the expected pubkey', () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  assert.equal(assertServiceKey(sk, pk), pk);
});

test('assertServiceKey REFUSES a key that derives to any other pubkey (safety stop)', () => {
  const sk = generateSecretKey();
  const otherPk = getPublicKey(generateSecretKey());
  assert.throws(() => assertServiceKey(sk, otherPk), /Refusing to start/);
});
