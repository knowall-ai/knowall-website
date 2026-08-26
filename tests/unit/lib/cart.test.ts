import { describe, it, expect } from 'vitest';
import {
  addCartItem,
  cartTotalItems,
  cartTotalPrice,
  EMPTY_CART,
  MAX_QUANTITY,
  normalizeQuantity,
  removeCartItem,
  updateCartQuantity,
} from '@/lib/cart';
import type { Listing } from '@/lib/nip99';

/**
 * Cart state helpers (lib/cart) — the pure core behind hooks/use-cart.
 *
 * Requirements: shop-cart-checkout
 */

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
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
}

describe('addCartItem', () => {
  it('adds a new line with the given quantity', () => {
    const state = addCartItem(EMPTY_CART, buildListing(), 2);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ productId: 'tminus15-book', quantity: 2 });
  });

  it('merges quantity when the product is already in the cart', () => {
    const first = addCartItem(EMPTY_CART, buildListing(), 1);
    const second = addCartItem(first, buildListing(), 2);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].quantity).toBe(3);
  });

  it('refreshes the stored listing on merge so product edits propagate', () => {
    const first = addCartItem(EMPTY_CART, buildListing({ title: 'Old title' }), 1);
    const second = addCartItem(first, buildListing({ title: 'New title' }), 1);
    expect(second.items[0].listing.title).toBe('New title');
  });
});

describe('normalizeQuantity', () => {
  it('coerces untrusted quantities to a bounded positive integer', () => {
    expect(normalizeQuantity(2.9)).toBe(2);
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-4)).toBe(1);
    expect(normalizeQuantity(NaN)).toBe(1);
    expect(normalizeQuantity(Infinity)).toBe(1);
    expect(normalizeQuantity(MAX_QUANTITY + 100)).toBe(MAX_QUANTITY);
  });

  it('is applied by addCartItem and updateCartQuantity', () => {
    const added = addCartItem(EMPTY_CART, buildListing(), 2.5);
    expect(added.items[0].quantity).toBe(2);
    expect(updateCartQuantity(added, 'tminus15-book', 1e6).items[0].quantity).toBe(MAX_QUANTITY);
  });
});

describe('removeCartItem / updateCartQuantity', () => {
  it('removes a line by product id', () => {
    const state = addCartItem(EMPTY_CART, buildListing(), 1);
    expect(removeCartItem(state, 'tminus15-book').items).toHaveLength(0);
  });

  it('updates a quantity in place', () => {
    const state = addCartItem(EMPTY_CART, buildListing(), 1);
    expect(updateCartQuantity(state, 'tminus15-book', 5).items[0].quantity).toBe(5);
  });

  it('removes the line when quantity drops to zero or below', () => {
    const state = addCartItem(EMPTY_CART, buildListing(), 1);
    expect(updateCartQuantity(state, 'tminus15-book', 0).items).toHaveLength(0);
    expect(updateCartQuantity(state, 'tminus15-book', -1).items).toHaveLength(0);
  });
});

describe('cart totals', () => {
  it('sums units across lines', () => {
    let state = addCartItem(EMPTY_CART, buildListing(), 2);
    state = addCartItem(state, buildListing({ dTag: 'knowall-sticker-pack' }), 3);
    expect(cartTotalItems(state.items)).toBe(5);
  });

  it('sums prices in the first item currency', () => {
    let state = addCartItem(EMPTY_CART, buildListing(), 2); // 2 × £9.99
    state = addCartItem(
      state,
      buildListing({ dTag: 'knowall-sticker-pack', price: { amount: 5.99, currency: 'GBP' } }),
      1
    );
    const { totalPrice, currency } = cartTotalPrice(state.items);
    expect(totalPrice).toBeCloseTo(25.97);
    expect(currency).toBe('GBP');
  });

  it('treats unpriced listings as zero and defaults to GBP when empty', () => {
    expect(cartTotalPrice([])).toEqual({ totalPrice: 0, currency: 'GBP' });
    const state = addCartItem(EMPTY_CART, buildListing({ price: null }), 4);
    expect(cartTotalPrice(state.items).totalPrice).toBe(0);
  });
});
