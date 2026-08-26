'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { useCart } from '@/hooks/use-cart';
import { useCheckout, useCheckoutShippingOptions } from '@/hooks/use-checkout';
import type { ShippingInfo } from '@/lib/gamma-order';
import { formatPrice } from '@/lib/nip99';
import { OrderConfirmation } from './order-confirmation';
import { PaymentDisplay } from './payment-display';
import { ShippingForm } from './shipping-form';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

/**
 * Three-step checkout, ported from robotechy.com's CheckoutDialog: shipping
 * (country-first zone selection + address form) → payment (Lightning invoice
 * from the merchant's gift-wrapped payment request) → confirmation.
 *
 * Unlike robotechy, no sign-in gate: anonymous buyers order under a local
 * browser key (see lib/nip17), so checkout works without a Nostr account.
 */
export function CheckoutDialog({ open, onOpenChange }: CheckoutDialogProps) {
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

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after the close animation finishes.
    setTimeout(() => {
      setStep('shipping');
      setLocalError(null);
      resetCheckout();
    }, 300);
  };

  const titles: Record<CheckoutStep, string> = {
    shipping: 'Checkout',
    payment: 'Payment',
    confirmation: 'Order Complete',
  };

  // Skip the payment step if the receipt already landed.
  if (isPaid && step === 'payment') {
    setStep('confirmation');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-900 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{titles[step]}</DialogTitle>
          <DialogDescription className="sr-only">
            Complete your order by filling in the shipping details and payment information.
          </DialogDescription>
        </DialogHeader>

        {(hasError || localError) && (
          <div className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{checkoutState.error || localError}</p>
          </div>
        )}

        {step === 'shipping' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-800/60 p-3">
              <p className="text-sm">
                <span className="font-medium">{totalItems} item(s)</span>
                <span className="text-gray-400"> · </span>
                <span className="font-medium">{formatPrice({ amount: totalPrice, currency })}</span>
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
          </div>
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
          <OrderConfirmation orderId={checkoutState.orderId} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
