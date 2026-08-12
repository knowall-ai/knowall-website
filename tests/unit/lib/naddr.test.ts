import { describe, it, expect } from 'vitest';
import * as nip19 from 'nostr-tools/nip19';
import { encodeListingNaddr, decodeListingNaddr } from '@/lib/naddr';
import { KNOWALL_PUBKEY } from '@/lib/nostr';

const OTHER_PUBKEY = 'a'.repeat(64);
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

describe('encodeListingNaddr', () => {
  it('produces a bech32 naddr1 string', () => {
    const naddr = encodeListingNaddr(KNOWALL_PUBKEY, 'tminus15-book');
    expect(naddr).toMatch(/^naddr1[02-9ac-hj-np-z]+$/);
  });

  it('round-trips pubkey, identifier and relay hints through decode', () => {
    const naddr = encodeListingNaddr(KNOWALL_PUBKEY, 'tminus15-book', RELAYS);
    expect(decodeListingNaddr(naddr, KNOWALL_PUBKEY)).toEqual({
      pubkey: KNOWALL_PUBKEY,
      identifier: 'tminus15-book',
      // Hints are capped at two, matching Robotechy's share pattern.
      relays: RELAYS.slice(0, 2),
    });
  });

  it('round-trips without relay hints', () => {
    const naddr = encodeListingNaddr(KNOWALL_PUBKEY, 'sticker-pack');
    expect(decodeListingNaddr(naddr, KNOWALL_PUBKEY)).toEqual({
      pubkey: KNOWALL_PUBKEY,
      identifier: 'sticker-pack',
      relays: [],
    });
  });
});

describe('decodeListingNaddr', () => {
  it('rejects strings that are not bech32 at all', () => {
    expect(decodeListingNaddr('not-an-naddr', KNOWALL_PUBKEY)).toBeNull();
    expect(decodeListingNaddr('', KNOWALL_PUBKEY)).toBeNull();
  });

  it('rejects naddr strings with a corrupted checksum', () => {
    const naddr = encodeListingNaddr(KNOWALL_PUBKEY, 'tminus15-book');
    const corrupted = naddr.slice(0, -1) + (naddr.endsWith('q') ? 'p' : 'q');
    expect(decodeListingNaddr(corrupted, KNOWALL_PUBKEY)).toBeNull();
  });

  it('rejects other NIP-19 entities (npub is not a listing address)', () => {
    const npub = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';
    expect(decodeListingNaddr(npub, KNOWALL_PUBKEY)).toBeNull();
  });

  it('rejects naddrs of the wrong pubkey — the shop only shows KnowAll listings', () => {
    const foreign = encodeListingNaddr(OTHER_PUBKEY, 'tminus15-book');
    expect(decodeListingNaddr(foreign, KNOWALL_PUBKEY)).toBeNull();
  });

  it('rejects naddrs of the wrong kind (e.g. a long-form article)', () => {
    // encodeListingNaddr pins kind 30402, so build a kind-30023 naddr inline.
    const article = nip19.naddrEncode({ kind: 30023, pubkey: KNOWALL_PUBKEY, identifier: 'post' });
    expect(decodeListingNaddr(article, KNOWALL_PUBKEY)).toBeNull();
  });
});
