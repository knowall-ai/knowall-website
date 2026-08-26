'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Zap } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import type { GammaPaymentRequest } from '@/lib/gamma-order';

interface PaymentDisplayProps {
  orderId: string;
  paymentRequest?: GammaPaymentRequest;
  /** Fiat currency for the ≈ conversion line. */
  fiatCurrency?: string;
  onPaymentComplete: (invoice: string, preimage: string) => void;
}

/**
 * Lightning payment step, ported from robotechy.com's PaymentDisplay: waits
 * for the merchant's gift-wrapped payment request, then renders its BOLT11
 * invoice as a QR code with copy / open-in-wallet actions — plus one-click
 * WebLN payment when the browser exposes a wallet, which is the path that
 * yields a preimage and lets us send the kind-17 receipt automatically.
 * (Robotechy's NWC wallet connections are not ported — no NWC infrastructure
 * exists in this site yet.)
 */
export function PaymentDisplay({
  orderId,
  paymentRequest,
  fiatCurrency = 'GBP',
  onPaymentComplete,
}: PaymentDisplayProps) {
  const { convertToFiat } = useExchangeRate();

  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [webln, setWebln] = useState<WebLNProvider | null>(null);

  // WebLN is injected by extensions after load; read it client-side only.
  useEffect(() => {
    setWebln(window.webln ?? null);
  }, []);

  const invoice = paymentRequest?.payment_options.find(
    (o) => o.type === 'ln' || o.type === 'lnurl'
  )?.link;
  const satsAmount = paymentRequest?.amount ?? 0;
  const fiatAmount = satsAmount > 0 ? convertToFiat(satsAmount, fiatCurrency) : 0;

  // Generate the QR code when the invoice arrives.
  useEffect(() => {
    let cancelled = false;
    if (!invoice) {
      setQrCodeUrl('');
      return;
    }
    // Uppercasing is a QR alphanumeric-mode optimisation that is only valid
    // for bech32 payloads (BOLT11 invoices / bech32 lnurl); an lnurl option
    // can also carry a case-sensitive https URL, which must be encoded as-is.
    const qrPayload = /^(lightning:)?ln[a-z0-9]+$/i.test(invoice) ? invoice.toUpperCase() : invoice;
    QRCode.toDataURL(qrPayload, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrCodeUrl(url);
      })
      .catch((err) => console.error('Failed to generate QR code:', err));
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  const handleCopy = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission denied) — the
      // invoice input stays selectable for manual copy.
      setPayError('Could not copy automatically — select the invoice text and copy it manually.');
    }
  };

  const openInWallet = () => {
    if (invoice) window.open(`lightning:${invoice}`, '_blank');
  };

  const handlePayWithWebLN = async () => {
    if (!invoice || !webln) return;
    setIsPaying(true);
    setPayError(null);
    try {
      // WebLN requires enable() before sendPayment.
      await webln.enable();
      const result = await webln.sendPayment(invoice);
      if (result.preimage) {
        onPaymentComplete(invoice, result.preimage);
      }
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Failed to send payment');
    } finally {
      setIsPaying(false);
    }
  };

  // Waiting state while we watch for the merchant's payment request.
  if (!paymentRequest || !invoice) {
    return (
      <div className="flex flex-col items-center space-y-4 py-12" data-testid="awaiting-invoice">
        <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
        <div className="space-y-2 text-center">
          <p className="font-medium text-white">Waiting for invoice...</p>
          <p className="text-sm text-gray-400">
            The merchant will send a Lightning invoice shortly.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Order ID: {orderId.slice(0, 8)}...{orderId.slice(-8)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="payment-display">
      {/* Amount */}
      <div className="py-2 text-center">
        <p className="text-2xl font-bold text-white">{satsAmount.toLocaleString()} sats</p>
        {fiatAmount > 0 && (
          <p className="text-sm text-gray-400">
            ≈ {fiatCurrency === 'GBP' ? '£' : fiatCurrency === 'USD' ? '$' : '€'}
            {fiatAmount.toFixed(2)}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-400">
          {paymentRequest.message || 'Please pay this invoice to complete your order'}
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="rounded-lg border border-gray-800 bg-white p-3">
          {qrCodeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI generated in-page
            <img
              src={qrCodeUrl}
              alt="Lightning Invoice QR Code"
              className="h-48 w-48 object-contain"
            />
          ) : (
            <div className="h-48 w-48 animate-pulse rounded bg-gray-200" />
          )}
        </div>
      </div>

      {/* Invoice with copy */}
      <div className="space-y-2">
        <Label htmlFor="invoice" className="text-gray-200">
          Lightning Invoice
        </Label>
        <div className="flex gap-2">
          <Input
            id="invoice"
            value={invoice}
            readOnly
            className="border-gray-700 bg-gray-800 font-mono text-xs text-white"
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0 border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-lime-500"
            aria-label="Copy invoice"
          >
            {copied ? <Check className="h-4 w-4 text-lime-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {payError && <p className="text-sm text-red-400">{payError}</p>}

      {/* Payment buttons */}
      <div className="space-y-3">
        {webln && (
          <Button
            onClick={handlePayWithWebLN}
            disabled={isPaying}
            className="w-full bg-lime-600 text-white hover:bg-lime-700"
            size="lg"
          >
            {isPaying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Pay with WebLN
              </>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          onClick={openInWallet}
          className="w-full border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
          size="lg"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Lightning Wallet
        </Button>

        <p className="text-center text-xs text-gray-500">
          Scan the QR code or copy the invoice to pay with any Lightning wallet.
        </p>
      </div>
    </div>
  );
}
