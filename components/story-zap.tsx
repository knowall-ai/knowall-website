'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SignInButton from '@/components/auth/sign-in-button';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { SOCIAL_RELAYS } from '@/lib/relay';
import { fetchProfiles } from '@/lib/nostr-profiles';
import { buildZapRequestTemplate, lnurlPayUrl, type ZapTotals } from '@/lib/story-social';
import type { NostrEvent } from '@/lib/story-notes';

const PRESET_AMOUNTS = [21, 210, 2100];
const DEFAULT_AMOUNT = 21;

// window.webln (injected by extensions such as Alby) is typed globally in
// types/global.d.ts — shared with the shop checkout's PaymentDisplay.

type ZapStage = 'amount' | 'invoice' | 'paid';

/**
 * NIP-57 zap action for a story post: a button showing the post's running zap
 * total (from kind-9735 receipts), opening a dialog that — for signed-in
 * users — resolves the author's lightning address (lud16/lud06) to an
 * LNURL-pay endpoint, requests an invoice carrying a kind-9734 zap request
 * signed by the user's NIP-07 extension, then pays via WebLN when available
 * or shows the bolt11 as a QR code with a copy button. Signed-out users see
 * the totals and a sign-in nudge. Mirrors the ZapButton/ZapDialog pair on
 * edenweeks.art.
 */
export default function StoryZapButton({ note, totals }: { note: NostrEvent; totals: ZapTotals }) {
  const { user, signEvent } = useNostrAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<ZapStage>('amount');
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT);
  const [customAmount, setCustomAmount] = useState('');
  const [comment, setComment] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Sats zapped from this session, shown immediately (receipts arrive later).
  const [localSats, setLocalSats] = useState(0);

  const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount;
  const totalSats = totals.sats + localSats;

  const resetDialog = () => {
    setStage('amount');
    setInvoice(null);
    setQrDataUrl(null);
    setError(null);
    setCopied(false);
    setIsWorking(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) resetDialog();
  };

  // Render the bolt11 QR whenever an invoice needs manual payment.
  useEffect(() => {
    if (!invoice) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(invoice.toUpperCase(), { width: 512, margin: 2 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // The invoice text + copy button still work without the QR.
      });
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  const handleZap = async () => {
    if (!user || effectiveAmount <= 0 || isWorking) return;
    setIsWorking(true);
    setError(null);

    try {
      // 1. The post author's lightning address, from their kind-0 metadata.
      const profiles = await fetchProfiles([note.pubkey]);
      const metadata = profiles.get(note.pubkey);
      const endpoint = metadata && lnurlPayUrl(metadata);
      if (!endpoint) {
        throw new Error('The author has no lightning address configured.');
      }

      // 2. The LNURL-pay parameters (callback URL, zap support).
      const lnurlResponse = await fetch(endpoint);
      if (!lnurlResponse.ok) throw new Error('Could not reach the lightning service.');
      const lnurl = (await lnurlResponse.json()) as {
        callback?: string;
        allowsNostr?: boolean;
        minSendable?: number;
        maxSendable?: number;
      };
      if (!lnurl.callback) throw new Error('The lightning service returned no callback.');

      const amountMsats = effectiveAmount * 1000;
      if (lnurl.minSendable && amountMsats < lnurl.minSendable) {
        throw new Error(`Minimum zap is ${Math.ceil(lnurl.minSendable / 1000)} sats.`);
      }
      if (lnurl.maxSendable && amountMsats > lnurl.maxSendable) {
        throw new Error(`Maximum zap is ${Math.floor(lnurl.maxSendable / 1000)} sats.`);
      }

      // 3. A kind-9734 zap request signed by the user's extension, so the zap
      //    is publicly attributed to them via the eventual kind-9735 receipt.
      const callbackUrl = new URL(lnurl.callback);
      callbackUrl.searchParams.set('amount', String(amountMsats));
      // NIP-57 zap support is opt-in: only services that advertise
      // `allowsNostr: true` accept a `nostr` param — others may reject the
      // request outright, so plain LNURL-pay (with a LUD-12 comment) is used
      // for them instead.
      if (lnurl.allowsNostr === true) {
        const signedRequest = await signEvent(
          buildZapRequestTemplate({
            recipientPubkey: note.pubkey,
            noteId: note.id,
            amountMsats,
            relays: SOCIAL_RELAYS,
            comment: comment.trim(),
          })
        );
        callbackUrl.searchParams.set('nostr', JSON.stringify(signedRequest));
      } else if (comment.trim()) {
        callbackUrl.searchParams.set('comment', comment.trim());
      }

      // 4. The invoice.
      const invoiceResponse = await fetch(callbackUrl.toString());
      const invoiceData = (await invoiceResponse.json()) as { pr?: string; reason?: string };
      if (!invoiceResponse.ok || !invoiceData.pr) {
        throw new Error(invoiceData.reason || 'The lightning service returned no invoice.');
      }

      // 5. Pay: WebLN when the browser provides it, else QR + copy.
      if (window.webln) {
        try {
          await window.webln.enable?.();
          await window.webln.sendPayment(invoiceData.pr);
          setLocalSats((sats) => sats + effectiveAmount);
          setStage('paid');
          return;
        } catch {
          // WebLN declined or failed — fall through to manual payment.
        }
      }
      setInvoice(invoiceData.pr);
      setStage('invoice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zap failed. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the input is selectable as a fallback.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        data-testid="story-zap-button"
        className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-lime-500"
        aria-label={`Zap this post${totalSats > 0 ? ` (${totalSats.toLocaleString()} sats so far)` : ''}`}
      >
        <Zap className="h-4 w-4" aria-hidden="true" />
        <span>{totalSats > 0 ? totalSats.toLocaleString() : 'Zap'}</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="border-gray-800 bg-gray-900 text-white sm:max-w-md"
          data-testid="story-zap-dialog"
        >
          {!user ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">Zap this post</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Zaps are small Bitcoin lightning payments that support the author. Sign in with
                  your Nostr identity to send one.
                </DialogDescription>
              </DialogHeader>
              <SignInButton label="Sign in to zap" className="w-full" />
            </>
          ) : stage === 'paid' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Zap className="h-5 w-5 text-lime-500" aria-hidden="true" />
                  Zap sent
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {effectiveAmount.toLocaleString()} sats are on their way. Thank you for the
                  support!
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full bg-lime-600 text-white hover:bg-lime-700"
              >
                Done
              </Button>
            </>
          ) : stage === 'invoice' && invoice ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">
                  Pay {effectiveAmount.toLocaleString()} sats
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Scan the QR code or copy the invoice into any lightning wallet.
                </DialogDescription>
              </DialogHeader>
              {qrDataUrl && (
                <div className="mx-auto rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- locally generated data URI */}
                  <img src={qrDataUrl} alt="Lightning invoice QR code" className="h-56 w-56" />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={invoice}
                  readOnly
                  onClick={(event) => event.currentTarget.select()}
                  className="border-gray-800 bg-gray-950 font-mono text-xs text-gray-300"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy invoice"
                  className="shrink-0 border-gray-700 bg-gray-950 text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-lime-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full border-gray-700 bg-gray-950 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <a href={`lightning:${invoice}`}>
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  Open in wallet
                </a>
              </Button>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">Zap this post</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Send sats over the Bitcoin lightning network to show your support. Your zap is
                  signed with your Nostr identity.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(preset);
                        setCustomAmount('');
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        !customAmount && amount === preset
                          ? 'border-lime-500 bg-lime-500/10 text-lime-500'
                          : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={1}
                  placeholder="Custom amount (sats)"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  className="border-gray-800 bg-gray-950 text-gray-200 placeholder:text-gray-500"
                />
                <Textarea
                  rows={2}
                  placeholder="Add a comment (optional)"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="resize-none border-gray-800 bg-gray-950 text-gray-200 placeholder:text-gray-500"
                />
                {error && (
                  <p role="alert" className="text-sm text-red-400">
                    {error}
                  </p>
                )}
                <Button
                  onClick={handleZap}
                  disabled={isWorking || effectiveAmount <= 0}
                  className="w-full bg-lime-600 font-semibold text-white hover:bg-lime-700"
                >
                  <Zap className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isWorking
                    ? 'Creating invoice…'
                    : `Zap ${effectiveAmount > 0 ? effectiveAmount.toLocaleString() : ''} sats`}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
