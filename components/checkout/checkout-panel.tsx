'use client';

import { useState } from 'react';
import { AlertCircle, ShoppingBag } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { useCart } from '@/hooks/use-cart';
import { useCheckout, useCheckoutShippingOptions } from '@/hooks/use-checkout';
import type { ShippingInfo } from '@/lib/gamma-order';
import { formatPrice } from '@/lib/nip99';
import { OrderConfirmation } from './order-confirmation';
import { PaymentDisplay } from './payment-display';
import { ShippingForm } from './shipping-form';

interface CheckoutPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

/**
 * Three-step checkout with robotechy.com's flow (shipping → payment →
 * confirmation), presented as a right-hand slide-over panel matching the
 * site's contact panel (components/contact-panel.tsx) rather than
 * robotechy's centered dialog.
 *
 * Unlike robotechy, no sign-in gate: anonymous buyers order under a local
 * browser key (see lib/nip17), so checkout works without a Nostr account.
 */
export function CheckoutPanel({ open, onOpenChange }: CheckoutPanelProps) {
  const { user } = useNostrAuth();
  const { totalPrice, currency, totalItems } = useCart();
  const { options: shippingOptions, isLoading: shippingOptionsLoading } =
    useCheckoutShippingOptions(open);
  const {
    checkoutState,
    submitOrder,
    submitPaymentReceipt,
    resetCheckout,
    isSubmitting,
    isPaid,
    hasError,
  } = useCheckout();

  const [step, setStep] = useState<CheckoutStep>('shipping');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleShippingSubmit = async (shipping: ShippingInfo) => {
    setLocalError(null);
    try {
      await submitOrder(shipping);
      setStep('payment');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to submit order');
    }
  };

  const handlePaymentComplete = async (invoice: string, preimage: string) => {
    try {
      await submitPaymentReceipt(invoice, preimage);
      setStep('confirmation');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to record payment');
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      // Reset state after the close animation finishes.
      setTimeout(() => {
        setStep('shipping');
        setLocalError(null);
        resetCheckout();
      }, 300);
    }
  };

  const titles: Record<CheckoutStep, string> = {
    shipping: 'Checkout',
    payment: 'Payment',
    confirmation: 'Order Complete',
  };
  const descriptions: Record<CheckoutStep, string> = {
    shipping: 'Choose where to ship and place your order.',
    payment: 'Pay the Lightning invoice to complete your order.',
    confirmation: 'Your order is confirmed.',
  };

  // Skip the payment step if the receipt already landed.
  if (isPaid && step === 'payment') {
    setStep('confirmation');
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-gray-800 bg-gray-900 p-0 text-white sm:max-w-md"
      >
        <SheetHeader className="border-b border-gray-800 p-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <ShoppingBag className="h-5 w-5 text-lime-500" aria-hidden="true" />
            {titles[step]}
          </SheetTitle>
          <SheetDescription className="text-gray-400">{descriptions[step]}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4 sm:p-6">
          {(hasError || localError) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{checkoutState.error || localError}</p>
            </div>
          )}

          {step === 'shipping' && (
            <>
              <div className="rounded-lg bg-gray-800/60 p-3">
                <p className="text-sm">
                  <span className="font-medium">{totalItems} item(s)</span>
                  <span className="text-gray-400"> · </span>
                  <span className="font-medium">
                    {formatPrice({ amount: totalPrice, currency })}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {user
                    ? 'Ordering with your Nostr account — updates arrive as encrypted DMs.'
                    : 'No account needed — your order is sent as an encrypted Nostr message and a private order key is kept in this browser for updates.'}
                </p>
              </div>

              <ShippingForm
                onSubmit={handleShippingSubmit}
                isSubmitting={isSubmitting}
                currency={currency}
                shippingOptions={shippingOptions}
                optionsLoading={shippingOptionsLoading}
                subtotal={totalPrice}
              />
            </>
          )}

          {step === 'payment' && checkoutState.orderId && (
            <PaymentDisplay
              orderId={checkoutState.orderId}
              paymentRequest={checkoutState.paymentRequest}
              fiatCurrency={currency}
              onPaymentComplete={handlePaymentComplete}
            />
          )}

          {step === 'confirmation' && checkoutState.orderId && (
            <OrderConfirmation
              orderId={checkoutState.orderId}
              onClose={() => handleOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
