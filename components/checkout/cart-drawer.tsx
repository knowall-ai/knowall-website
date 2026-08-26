'use client';

import { useState } from 'react';
import { ImageIcon, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/use-cart';
import type { CartItem } from '@/lib/cart';
import { formatPrice } from '@/lib/nip99';
import { CheckoutPanel } from './checkout-panel';

/**
 * Slide-out shopping cart, ported from robotechy.com's CartDrawer (+ its
 * CartItem/CartSummary), restyled for the dark shop theme. Mounted globally
 * in the header so the cart is reachable from every page.
 */
export function CartDrawer() {
  const { items, isOpen, setIsOpen, totalItems, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleCheckout = () => {
    setIsOpen(false);
    // Let the drawer's close animation finish before sliding the checkout
    // panel in, so the two focus traps never overlap.
    setTimeout(() => setCheckoutOpen(true), 350);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-gray-800 bg-gray-900 p-0 text-white sm:max-w-md"
        >
          <SheetHeader className="border-b border-gray-800 p-4">
            <SheetTitle className="flex items-center gap-2 text-white">
              <ShoppingBag className="h-5 w-5 text-lime-500" aria-hidden="true" />
              Shopping Cart
              {totalItems > 0 && (
                <span className="text-sm font-normal text-gray-400">
                  ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">Your shopping cart items</SheetDescription>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-gray-700" />
              <h3 className="mb-1 text-lg font-medium">Your cart is empty</h3>
              <p className="mb-4 text-sm text-gray-400">Add some items to get started</p>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-lime-500"
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {items.map((item) => (
                    <CartLine key={item.productId} item={item} />
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t border-gray-800">
                <div className="px-4 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:bg-gray-800 hover:text-red-400"
                    onClick={clearCart}
                  >
                    Clear Cart
                  </Button>
                </div>
                <CartSummary onCheckout={handleCheckout} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutPanel open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}

/** One cart line: image, title, quantity stepper, line total. */
function CartLine({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();
  const [imageError, setImageError] = useState(false);

  const { listing, quantity } = item;
  const imageUrl = listing.images[0];
  const price = listing.price;
  const lineTotal = price ? { amount: price.amount * quantity, currency: price.currency } : null;

  return (
    <div className="flex flex-col gap-2 border-b border-gray-800 py-3 last:border-b-0">
      {/* Row 1: image | title + unit price | line total. */}
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
          {imageUrl && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element -- image hosts come from Nostr events, unknown at build time
            <img
              src={imageUrl}
              alt={listing.title}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-medium">{listing.title}</h4>
          <p className="text-sm text-gray-400">{formatPrice(price)}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-lime-500">
            {lineTotal ? formatPrice(lineTotal) : '—'}
          </p>
        </div>
      </div>

      {/* Row 2: quantity steppers on the left, remove flush to the right edge. */}
      <div className="flex w-full items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
          onClick={() => updateQuantity(item.productId, quantity - 1)}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-sm font-medium">{quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
          onClick={() => updateQuantity(item.productId, quantity + 1)}
          disabled={listing.stock !== null && quantity >= listing.stock}
          aria-label="Increase quantity"
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7 text-red-400 hover:bg-gray-800 hover:text-red-400"
          onClick={() => removeItem(item.productId)}
          aria-label={`Remove ${listing.title} from cart`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Subtotal + checkout button at the drawer's foot. */
function CartSummary({ onCheckout }: { onCheckout: () => void }) {
  const { totalItems, totalPrice, currency } = useCart();

  if (totalItems === 0) return null;

  return (
    <div className="p-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">
            Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </span>
          <span className="font-medium">{formatPrice({ amount: totalPrice, currency })}</span>
        </div>
        <Separator className="bg-gray-800" />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="text-lime-500">{formatPrice({ amount: totalPrice, currency })}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">Shipping is added at checkout.</p>

      <Button
        className="mt-4 w-full bg-lime-600 font-semibold text-white hover:bg-lime-700"
        onClick={onCheckout}
      >
        Proceed to Checkout
      </Button>
    </div>
  );
}
