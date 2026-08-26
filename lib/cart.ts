/**
 * Shopping-cart types and pure helpers, ported from robotechy.com's
 * useCart/cartTypes. The cart stores full parsed listings (lib/nip99) so the
 * drawer can render titles/images/prices without re-querying relays; state
 * itself lives in localStorage via hooks/use-cart.
 */

import type { Listing } from './nip99';

/** One cart line: a listing plus quantity. */
export interface CartItem {
  /** The listing's `d` tag — the stable per-product identifier. */
  productId: string;
  quantity: number;
  /** Full parsed listing for display and order building. */
  listing: Listing;
  /** Timestamp for stable ordering in the drawer. */
  addedAt: number;
}

export interface CartState {
  items: CartItem[];
  updatedAt: number;
}

export const EMPTY_CART: CartState = { items: [], updatedAt: 0 };

/**
 * Add a listing to the cart (merging quantity when it's already there),
 * refreshing the stored listing so edits to the product propagate.
 */
export function addCartItem(state: CartState, listing: Listing, quantity = 1): CartState {
  const existingIndex = state.items.findIndex((item) => item.productId === listing.dTag);
  const items =
    existingIndex >= 0
      ? state.items.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + quantity, listing } : item
        )
      : [...state.items, { productId: listing.dTag, quantity, listing, addedAt: Date.now() }];
  return { items, updatedAt: Date.now() };
}

/** Remove a line from the cart. */
export function removeCartItem(state: CartState, productId: string): CartState {
  return {
    items: state.items.filter((item) => item.productId !== productId),
    updatedAt: Date.now(),
  };
}

/** Set a line's quantity; zero or less removes the line. */
export function updateCartQuantity(
  state: CartState,
  productId: string,
  quantity: number
): CartState {
  if (quantity <= 0) return removeCartItem(state, productId);
  return {
    items: state.items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    updatedAt: Date.now(),
  };
}

/** Total number of units across all lines. */
export function cartTotalItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Items subtotal and its currency. Assumes one currency per cart (the KnowAll
 * catalog prices everything in GBP); the first priced item's currency wins,
 * matching robotechy's cart. Unpriced listings contribute 0.
 */
export function cartTotalPrice(items: CartItem[]): { totalPrice: number; currency: string } {
  if (items.length === 0) return { totalPrice: 0, currency: 'GBP' };
  const currency = items[0].listing.price?.currency ?? 'GBP';
  const totalPrice = items.reduce(
    (sum, item) => sum + (item.listing.price?.amount ?? 0) * item.quantity,
    0
  );
  return { totalPrice, currency };
}
