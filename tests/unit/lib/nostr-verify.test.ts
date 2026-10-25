import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { isVerifiedEvent, verifiedEvents } from '@/lib/nostr-verify';

/**
 * Relay signature checks (lib/nostr-verify). Events are JSON round-tripped
 * before checking, exactly as they arrive from a relay — nostr-tools caches a
 * "verified" marker on the object it signed, which a spread would carry over.
 */

const sk = generateSecretKey();
const fromRelay = <T>(event: T): T => JSON.parse(JSON.stringify(event)) as T;

function signedListing(price = '9.99') {
  return fromRelay(
    finalizeEvent(
      {
        kind: 30402,
        created_at: 1_700_000_000,
        content: '',
        tags: [
          ['d', 'book'],
          ['title', 'Book'],
          ['price', price, 'GBP'],
        ],
      },
      sk
    )
  );
}

describe('isVerifiedEvent', () => {
  it('keeps a validly signed event', () => {
    expect(isVerifiedEvent(signedListing())).toBe(true);
  });

  it('drops an event whose content/tags were altered after signing (forged price)', () => {
    const forged = {
      ...signedListing(),
      tags: [
        ['d', 'book'],
        ['title', 'Book'],
        ['price', '0.01', 'GBP'],
      ],
    };
    expect(isVerifiedEvent(forged)).toBe(false);
  });

  it('drops an event re-attributed to another pubkey', () => {
    const other = getPublicKey(generateSecretKey());
    expect(isVerifiedEvent({ ...signedListing(), pubkey: other })).toBe(false);
  });

  it('drops a recomputed id with someone else’s signature', () => {
    const genuine = signedListing();
    const otherSig = signedListing('1').sig;
    expect(isVerifiedEvent({ ...genuine, sig: otherSig })).toBe(false);
  });

  it('drops unsigned and malformed input without throwing', () => {
    const { sig: _sig, ...unsigned } = signedListing();
    expect(isVerifiedEvent(unsigned)).toBe(false);
    expect(isVerifiedEvent({ ...signedListing(), sig: 'nothex' })).toBe(false);
    expect(isVerifiedEvent({ ...signedListing(), tags: 'nope' })).toBe(false);
    expect(isVerifiedEvent(null)).toBe(false);
    expect(isVerifiedEvent('event')).toBe(false);
  });
});

describe('verifiedEvents', () => {
  it('filters a relay batch down to the genuine events', () => {
    const genuine = signedListing();
    const forged = { ...signedListing(), content: 'tampered' };
    expect(verifiedEvents([genuine, forged])).toEqual([genuine]);
  });
});
