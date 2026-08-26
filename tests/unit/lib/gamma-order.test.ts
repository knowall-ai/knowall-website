import { describe, it, expect } from 'vitest';
import {
  createOrderTags,
  createPaymentReceiptTemplate,
  formatAddress,
  formatOrderSummary,
  ORDER_MESSAGE_TYPE,
  PAYMENT_RECEIPT_KIND,
  parseCommerceAmount,
  parsePaymentRequest,
  toGammaPaymentOptions,
  type ShippingInfo,
} from '@/lib/gamma-order';
import type { CartItem } from '@/lib/cart';
import { PRODUCT_KIND } from '@/lib/shop-admin';
import type { Listing } from '@/lib/nip99';

/**
 * Gamma Markets order building/parsing (lib/gamma-order), ported from
 * robotechy.com's gammaOrderUtils.
 *
 * Requirements: shop-cart-checkout
 */

const MERCHANT = 'c'.repeat(64);

function buildItem(overrides: Partial<Listing> = {}, quantity = 2): CartItem {
  const listing: Listing = {
    id: 'event-1',
    pubkey: 'a'.repeat(64),
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
    ...overrides,
  };
  return { productId: listing.dTag, quantity, listing, addedAt: Date.now() };
}

function buildShipping(overrides: Partial<ShippingInfo> = {}): ShippingInfo {
  return {
    name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '+447700900000',
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

describe('createOrderTags', () => {
  it('builds the structured kind-16 type-1 order tags', () => {
    const tags = createOrderTags('order-12345678', [buildItem()], buildShipping(), MERCHANT, 1000);

    expect(tags).toContainEqual(['p', MERCHANT]);
    expect(tags).toContainEqual(['type', ORDER_MESSAGE_TYPE.ORDER_CREATION]);
    expect(tags).toContainEqual(['order', 'order-12345678']);
    expect(tags).toContainEqual(['amount', '1000']);
    expect(tags).toContainEqual(['item', `${PRODUCT_KIND}:${'a'.repeat(64)}:tminus15-book`, '2']);
    expect(tags).toContainEqual(['shipping', `30406:${MERCHANT}:ship-uk`]);
    expect(tags).toContainEqual(['email', 'buyer@example.com']);
    expect(tags).toContainEqual(['phone', '+447700900000']);
    expect(tags.find((t) => t[0] === 'address')?.[1]).toContain('123 Lime Street');
  });

  it('omits the shipping tag for legacy fallback zones (no real 30406 event)', () => {
    const tags = createOrderTags(
      'order-1',
      [buildItem()],
      buildShipping({ shippingRef: undefined }),
      MERCHANT,
      1000
    );
    expect(tags.some((t) => t[0] === 'shipping')).toBe(false);
  });

  it('omits the phone tag when not provided', () => {
    const tags = createOrderTags(
      'order-1',
      [buildItem()],
      buildShipping({ phone: '' }),
      MERCHANT,
      1000
    );
    expect(tags.some((t) => t[0] === 'phone')).toBe(false);
  });

  it('omits address and email tags when the optional fields are blank', () => {
    const tags = createOrderTags(
      'order-1',
      [buildItem()],
      buildShipping({
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        email: '',
      }),
      MERCHANT,
      1000
    );
    expect(tags.some((t) => t[0] === 'address')).toBe(false);
    expect(tags.some((t) => t[0] === 'email')).toBe(false);
  });
});

describe('createPaymentReceiptTemplate', () => {
  it('builds a kind-17 receipt with the payment proof', () => {
    const receipt = createPaymentReceiptTemplate(
      'order-1',
      MERCHANT,
      'lightning',
      'lnbc1invoice',
      'preimage123',
      1000
    );
    expect(receipt.kind).toBe(PAYMENT_RECEIPT_KIND);
    expect(receipt.tags).toContainEqual(['order', 'order-1']);
    expect(receipt.tags).toContainEqual(['payment', 'lightning', 'lnbc1invoice', 'preimage123']);
    expect(receipt.tags).toContainEqual(['amount', '1000']);
  });
});

describe('parsePaymentRequest', () => {
  const requestRumor = (tags: string[][], content = 'Please pay') => ({
    kind: 16,
    content,
    tags,
  });

  it('parses a kind-16 type-2 payment request', () => {
    const parsed = parsePaymentRequest(
      requestRumor([
        ['type', ORDER_MESSAGE_TYPE.PAYMENT_REQUEST],
        ['order', 'order-1'],
        ['amount', '32100'],
        ['payment', 'lightning', 'lnbc1invoice'],
      ])
    );
    expect(parsed).toEqual({
      orderId: 'order-1',
      amount: 32100,
      paymentOptions: [{ type: 'lightning', detail: 'lnbc1invoice' }],
      message: 'Please pay',
    });
  });

  it('returns null for other message types or missing tags', () => {
    expect(
      parsePaymentRequest(requestRumor([['type', ORDER_MESSAGE_TYPE.STATUS_UPDATE]]))
    ).toBeNull();
    expect(
      parsePaymentRequest(requestRumor([['type', ORDER_MESSAGE_TYPE.PAYMENT_REQUEST]]))
    ).toBeNull();
  });

  it('drops malformed payment tags missing their type or detail', () => {
    const parsed = parsePaymentRequest(
      requestRumor([
        ['type', ORDER_MESSAGE_TYPE.PAYMENT_REQUEST],
        ['order', 'order-1'],
        ['amount', '32100'],
        ['payment', 'lightning'], // truncated: no detail
        ['payment'], // no type at all
        ['payment', 'lightning', 'lnbc1invoice'],
      ])
    );
    expect(parsed?.paymentOptions).toEqual([{ type: 'lightning', detail: 'lnbc1invoice' }]);
  });

  it('rejects a request whose amount tag is not a plain integer', () => {
    expect(
      parsePaymentRequest(
        requestRumor([
          ['type', ORDER_MESSAGE_TYPE.PAYMENT_REQUEST],
          ['order', 'order-1'],
          ['amount', '32100.5 sats'],
          ['payment', 'lightning', 'lnbc1invoice'],
        ])
      )
    ).toBeNull();
  });
});

describe('toGammaPaymentOptions', () => {
  it('maps lightning options to ln links and drops everything else', () => {
    expect(
      toGammaPaymentOptions([
        { type: 'lightning', detail: 'lnbc1invoice' },
        { type: 'bitcoin', detail: 'bc1qonchain' },
        { type: 'fiat', detail: 'iban' },
      ])
    ).toEqual([{ type: 'ln', link: 'lnbc1invoice' }]);
  });

  it('drops lightning options with an empty link', () => {
    expect(toGammaPaymentOptions([{ type: 'lightning', detail: '' }])).toEqual([]);
  });
});

describe('parseCommerceAmount', () => {
  it('accepts non-negative numerics and rejects junk', () => {
    expect(parseCommerceAmount('1000')).toBe(1000);
    expect(parseCommerceAmount('0')).toBe(0);
    expect(parseCommerceAmount('')).toBeUndefined();
    expect(parseCommerceAmount(undefined)).toBeUndefined();
    expect(parseCommerceAmount('-5')).toBeUndefined();
    expect(parseCommerceAmount('NaN')).toBeUndefined();
    // Sats are whole numbers: decimals, exponents and hex forms are rejected.
    expect(parseCommerceAmount('10.5')).toBeUndefined();
    expect(parseCommerceAmount('1e3')).toBeUndefined();
    expect(parseCommerceAmount('0x10')).toBeUndefined();
  });
});

describe('formatAddress / formatOrderSummary', () => {
  it('joins only the present address parts', () => {
    expect(formatAddress(buildShipping({ state: '' }))).toBe(
      '123 Lime Street, Belfast, BT1 1AA, United Kingdom'
    );
  });

  it('summarises items, shipping and the all-in total', () => {
    const summary = formatOrderSummary(
      'order-12345678-x',
      [buildItem()],
      buildShipping(),
      19.98,
      'GBP'
    );
    expect(summary).toContain('New Order #order-12');
    expect(summary).toContain('- 2x T-Minus-15 Book @ £9.99 = £19.98');
    expect(summary).toContain('Shipping: United Kingdom (£2.50)');
    // All-in total: £19.98 items + £2.50 shipping.
    expect(summary).toContain('Total: £22.48');
    expect(summary).toContain('Email: buyer@example.com');
    expect(summary).toContain('Note: Leave at door');
  });

  it('shows both amounts rather than adding mixed currencies', () => {
    const summary = formatOrderSummary(
      'order-1',
      [buildItem()],
      buildShipping({ shippingCost: 5000, shippingCurrency: 'SATS' }),
      19.98,
      'GBP'
    );
    expect(summary).toContain('Total: £19.98 + 5,000 sats shipping');
  });
});
