'use client';

/**
 * Cart context + provider, ported from robotechy.com's useCart. State lives
 * in localStorage so the cart survives reloads; the provider hydrates from
 * storage after mount (SSR renders an empty cart, so server and client markup
 * match) and writes back on every change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addCartItem,
  cartTotalItems,
  cartTotalPrice,
  EMPTY_CART,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
  type CartState,
} from '@/lib/cart';
import type { Listing } from '@/lib/nip99';

const CART_STORAGE_KEY = 'knowall.shop.cart';

export interface CartContextValue {
  items: CartItem[];
  addItem: (listing: Listing, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  currency: string;
  /** Cart drawer visibility (the drawer is mounted globally in the header). */
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

/**
 * Validate one stored cart item. Stored carts are untrusted (older releases,
 * manual edits), and everything downstream trusts the shape — totals read
 * `listing.price`, checkout reads `listing.shippingRefs` — so malformed
 * entries are dropped rather than crashing the drawer.
 */
function isValidStoredItem(item: unknown): item is CartItem {
  if (typeof item !== 'object' || item === null) return false;
  const candidate = item as Partial<CartItem>;
  const listing = candidate.listing as Partial<CartItem['listing']> | undefined;
  return (
    typeof candidate.productId === 'string' &&
    Number.isInteger(candidate.quantity) &&
    (candidate.quantity as number) > 0 &&
    typeof listing === 'object' &&
    listing !== null &&
    typeof listing.dTag === 'string' &&
    typeof listing.title === 'string' &&
    Array.isArray(listing.images) &&
    (listing.price === null ||
      (typeof listing.price === 'object' &&
        listing.price !== null &&
        typeof listing.price.amount === 'number' &&
        typeof listing.price.currency === 'string')) &&
    Array.isArray(listing.shippingRefs)
  );
}

function readStoredCart(): CartState {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.items)) return EMPTY_CART;
    return { items: parsed.items.filter(isValidStoredItem), updatedAt: parsed.updatedAt ?? 0 };
  } catch {
    return EMPTY_CART;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (never during SSR).
  useEffect(() => {
    setCart(readStoredCart());
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated (best-effort).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage unavailable — the in-memory cart still works.
    }
  }, [cart, hydrated]);

  const addItem = useCallback((listing: Listing, quantity = 1) => {
    setCart((prev) => addCartItem(prev, listing, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => removeCartItem(prev, productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) => updateCartQuantity(prev, productId, quantity));
  }, []);

  const clearCart = useCallback(() => {
    setCart({ ...EMPTY_CART, updatedAt: Date.now() });
  }, []);

  const totalItems = useMemo(() => cartTotalItems(cart.items), [cart.items]);
  const { totalPrice, currency } = useMemo(() => cartTotalPrice(cart.items), [cart.items]);

  const value = useMemo(
    () => ({
      items: cart.items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      currency,
      isOpen,
      setIsOpen,
    }),
    [
      cart.items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      currency,
      isOpen,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
