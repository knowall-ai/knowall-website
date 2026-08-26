'use client';

import { useState } from 'react';
import { CheckCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderConfirmationProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Post-payment confirmation, ported from robotechy.com's OrderConfirmation:
 * copyable order id plus the what-happens-next steps.
 */
export function OrderConfirmation({ orderId, onClose }: OrderConfirmationProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyOrderId = async () => {
    await navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex flex-col items-center space-y-6 py-8 text-center"
      data-testid="order-confirmation"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-500/20">
        <CheckCircle className="h-10 w-10 text-lime-500" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Payment Received!</h2>
        <p className="text-gray-400">
          Thank you for your order. You will receive updates via Nostr direct messages.
        </p>
      </div>

      <div className="w-full rounded-lg bg-gray-800/60 p-4">
        <p className="mb-2 text-sm text-gray-400">Order ID</p>
        <div className="flex items-center justify-center gap-2">
          <code className="rounded bg-gray-950 px-3 py-1 font-mono text-sm text-gray-200">
            {orderId.slice(0, 8)}...{orderId.slice(-8)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyOrderId}
            className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-800 hover:text-lime-500"
            aria-label="Copy order ID"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {copied && <p className="mt-2 text-xs text-lime-500">Copied to clipboard!</p>}
      </div>

      <div className="space-y-2 text-sm text-gray-400">
        <p>
          <strong className="text-gray-200">What happens next?</strong>
        </p>
        <ul className="space-y-1 text-left">
          <li className="flex items-start gap-2">
            <span className="text-lime-500">1.</span>
            <span>We&apos;ll process your order shortly</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-lime-500">2.</span>
            <span>You&apos;ll receive shipping updates via Nostr DM</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-lime-500">3.</span>
            <span>Your item will be on its way!</span>
          </li>
        </ul>
      </div>

      <Button className="bg-lime-600 text-white hover:bg-lime-700" onClick={onClose}>
        Continue Shopping
      </Button>
    </div>
  );
}
