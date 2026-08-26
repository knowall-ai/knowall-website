import { describe, it, expect } from 'vitest';
import {
  createOrderTags,
  parsePaymentRequest,
  toGammaPaymentOptions,
  ORDER_MESSAGE_TYPE,
  ORDER_PROCESS_KIND,
  type ShippingInfo,
} from '@/lib/gamma-order';
import type { CartItem } from '@/lib/cart';
import type { Listing } from '@/lib/nip99';
// The standalone order-service daemon (plain Node ESM, its own package) — the
// other end of the wire. These imports are the whole point: the two sides must
// agree on the event shapes without sharing code.
import {
  createPaymentRequestEvent,
  parseOrderEvent,
  ORDER_MESSAGE_TYPE as SERVICE_MESSAGE_TYPE,
} from '../../../order-service/lib/orderParser.js';

/**
 * Integration round-trip between the site checkout and order-service/:
 *
 *   site createOrderTags  --(NIP-17 wire)-->  service parseOrderEvent
 *   service createPaymentRequestEvent  --(NIP-17 wire)-->  site parsePaymentRequest
 *
 * The invoice embedded in the service's kind-16 type-2 payment request is the
 * ONE invoice the checkout panel displays ("one invoice, two surfaces"), so the
 * event shape must parse EXACTLY — lightning-only fail-closed mapping and
 * order-id matching included.
 *
 * Requirements: shop-cart-checkout
 */

const MERCHANT = 'b733ecad265d8df63e15e28d24972141a5ebc21bfdf1532adad2e6701e853892';
const BUYER = 'a'.repeat(64);
const BOLT11 = 'lnbc125690n1roundtrip0invoice';

// The wire rumors are UNSIGNED inner events (no id/sig — that's NIP-17), but
// the JSDoc/TS parameter types on either side nominally ask for fuller event
// shapes; cast through the parameter type to keep the test honest to the wire.
const forService = (rumor: object) => rumor as Parameters<typeof parseOrderEvent>[0];
const forSite = (rumor: object) => rumor as Parameters<typeof parsePaymentRequest>[0];

function buildItem(quantity = 2): CartItem {
  const listing: Listing = {
    id: 'e'.repeat(64),
    pubkey: MERCHANT,
    dTag: 'tminus15-book',
    title: 'T-Minus-15 Book',
    summary: '',
    description: '',
    price: { amount: 9.99, currency: 'GBP' },
    images: [],
    tags: [],
    location: null,
    status: 'active',
    visibility: null,
    stock: null,
    publishedAt: 1_700_000_000,
    createdAt: 1_700_000_000,
    shippingZoneIds: [],
    shippingRefs: [],
  };
  return { productId: listing.dTag, quantity, listing, addedAt: Date.now() };
}

function buildShipping(overrides: Partial<ShippingInfo> = {}): ShippingInfo {
  return {
    name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '',
    address: '123 Lime Street',
    city: 'Belfast',
    state: '',
    postalCode: 'BT1 1AA',
    country: 'United Kingdom',
    countryCode: 'GB',
    shippingZone: 'ship-uk',
    shippingRef: `30406:${MERCHANT}:ship-uk`,
    shippingCost: 2.5,
    shippingCurrency: 'GBP',
    shippingTitle: 'United Kingdom',
    message: 'Leave at door',
    ...overrides,
  };
}

describe('order-service round-trip', () => {
  it('both sides agree on the Gamma message-type constants', () => {
    expect(SERVICE_MESSAGE_TYPE).toEqual(ORDER_MESSAGE_TYPE);
  });

  it("the site's order rumor parses with the service's parseOrderEvent", () => {
    const orderId = 'order-roundtrip-1';
    const rumor = {
      kind: ORDER_PROCESS_KIND,
      pubkey: BUYER,
      content: 'Leave at door',
      created_at: Math.floor(Date.now() / 1000),
      tags: createOrderTags(orderId, [buildItem()], buildShipping(), MERCHANT, 32200),
    };

    const parsed = parseOrderEvent(forService(rumor));
    expect(parsed).not.toBeNull();
    expect(parsed!.orderId).toBe(orderId);
    expect(parsed!.buyerPubkey).toBe(BUYER);
    expect(parsed!.amount).toBe(32200);
    expect(parsed!.items).toEqual([{ ref: `30402:${MERCHANT}:tminus15-book`, quantity: 2 }]);
    expect(parsed!.address).toContain('123 Lime Street');
    expect(parsed!.email).toBe('buyer@example.com');
  });

  it('an anonymous order with all optional PII omitted still parses (omitted tags)', () => {
    const rumor = {
      kind: ORDER_PROCESS_KIND,
      pubkey: BUYER,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags: createOrderTags(
        'order-roundtrip-2',
        [buildItem()],
        buildShipping({
          name: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        }),
        MERCHANT,
        1000
      ),
    };

    const parsed = parseOrderEvent(forService(rumor));
    expect(parsed).not.toBeNull();
    expect(parsed!.orderId).toBe('order-roundtrip-2');
    expect(parsed!.address).toBe('');
    expect(parsed!.email).toBe('');
  });

  it("the service's payment request parses EXACTLY with the checkout's parsePaymentRequest", () => {
    const orderId = 'order-roundtrip-3';
    const rumor = createPaymentRequestEvent(orderId, BUYER, 32200, BOLT11);

    const parsed = parsePaymentRequest(forSite(rumor));
    expect(parsed).toEqual({
      orderId,
      amount: 32200,
      paymentOptions: [{ type: 'lightning', detail: BOLT11 }],
      message: 'Please pay this invoice to complete your order',
    });

    // ...and survives the fail-closed lightning-only mapping into the shape the
    // payment UI renders: the ONE BOLT11 the buyer sees on the website.
    expect(toGammaPaymentOptions(parsed!.paymentOptions)).toEqual([{ type: 'ln', link: BOLT11 }]);
  });

  it('the checkout matches the payment request to its order by the order tag', () => {
    const rumor = createPaymentRequestEvent('order-A', BUYER, 1000, BOLT11);
    const parsed = parsePaymentRequest(forSite(rumor));
    // The checkout's watcher only accepts requests whose orderId equals the
    // just-placed order — a request for a different order must be ignorable.
    expect(parsed!.orderId).toBe('order-A');
    expect(parsed!.orderId).not.toBe('order-B');
  });
});
