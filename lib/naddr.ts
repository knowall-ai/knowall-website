/**
 * NIP-19 `naddr` helpers for shop product pages.
 *
 * A kind-30402 listing is addressed by (kind, pubkey, d-tag); `naddr1…` is the
 * shareable bech32 encoding of that address (plus optional relay hints). Our
 * product pages live at /shop/<naddr>, mirroring robotechy.com's /<naddr>
 * routes, and the same string deep-links the listing on njump.me.
 */

import * as nip19 from 'nostr-tools/nip19';
import { CLASSIFIED_LISTING_KIND } from '@/lib/nip99';

export interface ListingAddress {
  /** Author pubkey (hex). */
  pubkey: string;
  /** The `d` tag identifying the product. */
  identifier: string;
  /** Relay hints carried in the naddr (possibly empty). */
  relays: string[];
}

/**
 * Encode a listing address as `naddr1…`. At most two relay hints, matching
 * Robotechy's share pattern (more just bloats the URL).
 */
export function encodeListingNaddr(
  pubkey: string,
  identifier: string,
  relays: string[] = []
): string {
  return nip19.naddrEncode({
    kind: CLASSIFIED_LISTING_KIND,
    pubkey,
    identifier,
    relays: relays.slice(0, 2),
  });
}

/**
 * Decode and validate a product-page naddr. Returns null unless the string is
 * a well-formed `naddr1…` for a kind-30402 listing by `expectedPubkey` — the
 * shop only ever shows KnowAll listings, so anything else is a 404 (stricter
 * than robotechy, which ignores the naddr's pubkey entirely).
 */
export function decodeListingNaddr(naddr: string, expectedPubkey: string): ListingAddress | null {
  let decoded: nip19.DecodedResult;
  try {
    decoded = nip19.decode(naddr);
  } catch {
    return null;
  }
  if (decoded.type !== 'naddr') return null;
  const { kind, pubkey, identifier, relays } = decoded.data;
  if (kind !== CLASSIFIED_LISTING_KIND || pubkey !== expectedPubkey) return null;
  return { pubkey, identifier, relays: relays ?? [] };
}
