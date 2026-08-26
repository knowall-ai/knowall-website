// @vitest-environment node
// Node environment: these tests exercise noble-hashes crypto via nostr-tools,
// and jsdom's TextEncoder returns cross-realm Uint8Arrays that noble rejects.
import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { GIFT_WRAP_KIND, localBuyerIdentity, unwrapGiftWrap, wrapRumor } from '@/lib/nip17';
import { ORDER_PROCESS_KIND } from '@/lib/gamma-order';

/**
 * NIP-17 gift wrapping for commerce rumors (lib/nip17): the order (with its
 * PII tags) must survive a wrap → unwrap round-trip, and the plaintext must
 * never leak into the kind-1059 envelope relays see.
 *
 * Requirements: shop-cart-checkout
 */

describe('wrapRumor (local buyer identity)', () => {
  it('round-trips a kind-16 order rumor with PII tags intact', async () => {
    const buyer = localBuyerIdentity(generateSecretKey());
    const merchantSecret = generateSecretKey();
    const merchant = localBuyerIdentity(merchantSecret);

    const template = {
      kind: ORDER_PROCESS_KIND,
      content: 'Leave at door',
      tags: [
        ['p', merchant.pubkey],
        ['order', 'order-1'],
        ['email', 'buyer@example.com'],
        ['address', '123 Lime Street, Belfast'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    const wrap = await wrapRumor(template, buyer, merchant.pubkey);

    // The wrap is a kind 1059 with ONLY the recipient p tag — no PII, no
    // buyer pubkey, and a fuzzed (never future) timestamp.
    expect(wrap.kind).toBe(GIFT_WRAP_KIND);
    expect(wrap.tags).toEqual([['p', merchant.pubkey]]);
    expect(wrap.pubkey).not.toBe(buyer.pubkey);
    expect(wrap.content).not.toContain('buyer@example.com');
    expect(wrap.content).not.toContain('Lime Street');
    expect(wrap.created_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 60);

    // The merchant unwraps and recovers the rumor, authenticated as the buyer.
    const rumor = await unwrapGiftWrap(wrap, merchant);
    expect(rumor).not.toBeNull();
    expect(rumor?.kind).toBe(ORDER_PROCESS_KIND);
    expect(rumor?.pubkey).toBe(buyer.pubkey);
    expect(rumor?.content).toBe('Leave at door');
    expect(rumor?.tags).toContainEqual(['email', 'buyer@example.com']);
    expect(rumor?.tags).toContainEqual(['order', 'order-1']);
  });

  it('returns null when the wrap is not addressed to this identity', async () => {
    const buyer = localBuyerIdentity(generateSecretKey());
    const merchantPubkey = getPublicKey(generateSecretKey());
    const eavesdropper = localBuyerIdentity(generateSecretKey());

    const wrap = await wrapRumor(
      { kind: 14, content: 'secret', tags: [['p', merchantPubkey]], created_at: 1 },
      buyer,
      merchantPubkey
    );

    expect(await unwrapGiftWrap(wrap, eavesdropper)).toBeNull();
  });

  it('ignores non-gift-wrap kinds', async () => {
    const buyer = localBuyerIdentity(generateSecretKey());
    expect(
      await unwrapGiftWrap(
        { id: 'x', pubkey: 'y'.repeat(64), created_at: 1, kind: 1, tags: [], content: 'hi' },
        buyer
      )
    ).toBeNull();
  });
});
