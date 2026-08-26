'use client';

/**
 * Checkout hooks, ported from robotechy.com's useCheckoutShippingOptions and
 * useGammaCheckout.
 *
 * Order flow: the buyer's structured kind-16 order (plus a readable kind-14
 * summary) is NIP-17 gift-wrapped to the KnowAll merchant npub and published
 * to the shop relays. The hook then watches the buyer's own gift wraps for
 * the merchant's kind-16 type-2 payment request (which carries the Lightning
 * invoice) and, once paid, sends back a gift-wrapped kind-17 receipt.
 *
 * Buyer identity, as in robotechy: a signed-in NIP-07 user whose extension
 * supports NIP-44 orders under their own key; everyone else gets a local
 * order key generated (and persisted) in the browser, so anonymous buyers
 * can order — and still decrypt the merchant's replies — without an account.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { useCart } from '@/hooks/use-cart';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { collectCartShippingRefs, type CheckoutShippingOption } from '@/lib/checkout-shipping';
import {
  createOrderEventTemplate,
  createPaymentReceiptTemplate,
  formatOrderSummary,
  generateOrderId,
  ORDER_GENERAL_KIND,
  ORDER_PROCESS_KIND,
  parsePaymentRequest,
  toGammaPaymentOptions,
  type CheckoutState,
  type ShippingInfo,
} from '@/lib/gamma-order';
import {
  getOrCreateLocalBuyerKey,
  GIFT_WRAP_KIND,
  localBuyerIdentity,
  nip07SupportsGiftWrap,
  unwrapGiftWrap,
  wrapRumor,
  type BuyerIdentity,
} from '@/lib/nip17';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import { publishToRelays, queryRelays } from '@/lib/relay';
import { dedupeByDTag, parseShippingZone, SHIPPING_OPTION_KIND } from '@/lib/shop-admin';
import type { NostrEvent } from '@/lib/story-notes';

/* ---------------------------------------------------------------------------
 * Shipping options for the current cart
 * ------------------------------------------------------------------------- */

/**
 * Resolve the real (kind 30406) shipping options for the current cart:
 *
 * 1. Prefer the options the cart's products reference via `shipping_option`
 *    tags — including each tag's optional extra-cost element.
 * 2. Fall back to ALL of the merchant's published shipping options when the
 *    products don't reference any (older listings predating shipping refs)
 *    or the referenced options can't be resolved (deleted/unreachable).
 *
 * @param enabled - pass the checkout dialog's `open` state so the relay
 *   queries only fire while the checkout is actually visible.
 */
export function useCheckoutShippingOptions(enabled = true): {
  options: CheckoutShippingOption[];
  isLoading: boolean;
} {
  const { items } = useCart();
  const [options, setOptions] = useState<CheckoutShippingOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const cartRefs = useMemo(
    () => collectCartShippingRefs(items.map((item) => item.listing.shippingRefs)),
    [items]
  );
  // Effect dependency by value, so re-renders with identical refs don't refetch.
  const cartRefsKey = JSON.stringify(cartRefs);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);

    const refs: typeof cartRefs = JSON.parse(cartRefsKey);
    const extraByRef = new Map(refs.map((r) => [r.ref, r.extraCost]));

    const toOptions = (events: NostrEvent[]): CheckoutShippingOption[] =>
      dedupeByDTag(events.filter((event) => event.kind === SHIPPING_OPTION_KIND))
        .map((event) => {
          const zone = parseShippingZone(event);
          if (!zone) return null;
          const ref = `${SHIPPING_OPTION_KIND}:${event.pubkey}:${zone.id}`;
          const extraCost = extraByRef.get(ref);
          return {
            ...zone,
            pubkey: event.pubkey,
            ...(extraCost ? { extraCost } : {}),
          } satisfies CheckoutShippingOption;
        })
        .filter((option): option is CheckoutShippingOption => option !== null);

    const fetchMerchantFallback = () =>
      queryRelays(SHOP_RELAYS, [
        { kinds: [SHIPPING_OPTION_KIND], authors: [KNOWALL_PUBKEY], limit: 100 },
      ]).then((events) => toOptions(events.filter((event) => event.pubkey === KNOWALL_PUBKEY)));

    const load = async (): Promise<CheckoutShippingOption[]> => {
      if (refs.length > 0) {
        // Resolve the referenced options: group d-tags per author pubkey.
        const byAuthor = new Map<string, string[]>();
        for (const { ref } of refs) {
          const parts = ref.split(':');
          const pubkey = parts[1];
          const dTag = parts.slice(2).join(':');
          if (!pubkey || !dTag) continue;
          byAuthor.set(pubkey, [...(byAuthor.get(pubkey) ?? []), dTag]);
        }
        const filters = [...byAuthor.entries()].map(([pubkey, dTags]) => ({
          kinds: [SHIPPING_OPTION_KIND],
          authors: [pubkey],
          '#d': dTags,
          limit: 50,
        }));
        const events = await queryRelays(SHOP_RELAYS, filters);
        const wanted = new Set(refs.map((r) => r.ref));
        const resolved = toOptions(events).filter((option) =>
          wanted.has(`${SHIPPING_OPTION_KIND}:${option.pubkey}:${option.id}`)
        );
        if (resolved.length > 0) return resolved;
        // Referenced options unresolvable — fall through to the merchant's
        // full set rather than a dead end.
      }
      return fetchMerchantFallback();
    };

    load()
      .then((resolved) => {
        if (!cancelled) setOptions(resolved);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, cartRefsKey]);

  return { options, isLoading };
}

/* ---------------------------------------------------------------------------
 * Gamma checkout state machine
 * ------------------------------------------------------------------------- */

/** How often the awaiting-payment step re-queries for the merchant's reply. */
const PAYMENT_REQUEST_POLL_MS = 5000;
/** NIP-59 fuzzes wrap timestamps up to 2 days back; query wide enough. */
const WRAP_TIMESTAMP_SLACK_SECONDS = 2 * 24 * 60 * 60;

export interface UseCheckoutReturn {
  checkoutState: CheckoutState;
  /** The identity the current order was placed under (null before submit). */
  buyer: BuyerIdentity | null;
  submitOrder: (shipping: ShippingInfo) => Promise<string>;
  submitPaymentReceipt: (invoice: string, preimage: string) => Promise<void>;
  resetCheckout: () => void;
  isSubmitting: boolean;
  isAwaitingPayment: boolean;
  isPaid: boolean;
  hasError: boolean;
}

export function useCheckout(): UseCheckoutReturn {
  const { user } = useNostrAuth();
  const { items, totalPrice, currency, clearCart } = useCart();
  const { convertToSats } = useExchangeRate();

  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    orderId: null,
    status: 'idle',
  });
  const [buyer, setBuyer] = useState<BuyerIdentity | null>(null);
  const [orderPlacedAt, setOrderPlacedAt] = useState<number | null>(null);

  // Gift wraps we've already decrypted (or failed to), so polling never
  // re-prompts an extension for the same event.
  const processedWrapsRef = useRef<Set<string>>(new Set());

  /**
   * Watch for the merchant's gift-wrapped payment request (kind 16 type 2)
   * addressed to the buyer: poll the shop relays for the buyer's kind-1059
   * wraps, decrypt each once, and adopt the first type-2 rumor whose `order`
   * tag matches our order.
   */
  useEffect(() => {
    if (
      checkoutState.status !== 'awaiting_payment' ||
      checkoutState.paymentRequest ||
      !checkoutState.orderId ||
      !buyer ||
      !orderPlacedAt
    ) {
      return;
    }

    let cancelled = false;
    const orderId = checkoutState.orderId;

    const poll = async () => {
      const wraps = await queryRelays(SHOP_RELAYS, [
        {
          kinds: [GIFT_WRAP_KIND],
          '#p': [buyer.pubkey],
          since: orderPlacedAt - WRAP_TIMESTAMP_SLACK_SECONDS,
          limit: 200,
        },
      ]);
      for (const wrap of wraps) {
        if (cancelled) return;
        if (processedWrapsRef.current.has(wrap.id)) continue;
        processedWrapsRef.current.add(wrap.id);

        const rumor = await unwrapGiftWrap(wrap, buyer);
        if (!rumor || rumor.kind !== ORDER_PROCESS_KIND) continue;

        const request = parsePaymentRequest(rumor);
        if (!request || request.orderId !== orderId) continue;

        const paymentOptions = toGammaPaymentOptions(request.paymentOptions);
        if (paymentOptions.length === 0) continue; // no usable Lightning option

        if (!cancelled) {
          setCheckoutState((prev) => ({
            ...prev,
            paymentRequest: {
              id: request.orderId,
              type: 2,
              amount: request.amount,
              message: request.message,
              payment_options: paymentOptions,
            },
          }));
        }
        return;
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), PAYMENT_REQUEST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    checkoutState.status,
    checkoutState.paymentRequest,
    checkoutState.orderId,
    buyer,
    orderPlacedAt,
  ]);

  /** Resolve who this order is placed as (see module docs). */
  const resolveBuyer = useCallback((): BuyerIdentity => {
    if (user && nip07SupportsGiftWrap()) {
      return { pubkey: user.pubkey, kind: 'nip07' };
    }
    return localBuyerIdentity(getOrCreateLocalBuyerKey());
  }, [user]);

  const submitOrder = useCallback(
    async (shipping: ShippingInfo): Promise<string> => {
      if (items.length === 0) {
        throw new Error('Your cart is empty');
      }

      setCheckoutState({ orderId: null, status: 'submitting' });

      try {
        const orderBuyer = resolveBuyer();
        const orderId = generateOrderId();

        // Per the Gamma spec the order `amount` is the ALL-IN total in sats —
        // items PLUS the selected shipping option's cost. Convert each part in
        // its own currency (the shipping option may be priced differently).
        const itemsSats = convertToSats(totalPrice, currency);
        const shippingSats = shipping.shippingCost
          ? convertToSats(shipping.shippingCost, shipping.shippingCurrency || currency)
          : 0;
        const totalSats = itemsSats + shippingSats;

        // Build and gift-wrap the structured kind-16 order rumor. The PII
        // (address/email/phone) rides inside the NIP-44 encrypted, kind-13
        // sealed, kind-1059 wrapped envelope — no plaintext public event.
        const orderTemplate = createOrderEventTemplate(
          orderId,
          items,
          shipping,
          KNOWALL_PUBKEY,
          totalSats
        );
        const orderWrap = await wrapRumor(orderTemplate, orderBuyer, KNOWALL_PUBKEY);
        await publishToRelays(SHOP_RELAYS, orderWrap);

        // Also send a gift-wrapped readable kind-14 summary so the order
        // renders in generic NIP-17 clients (Damus/Primal/0xchat), not just
        // clients that parse the structured kind 16. Both are encrypted —
        // non-blocking so a failed summary never fails the authoritative order.
        const summary = formatOrderSummary(orderId, items, shipping, totalPrice, currency);
        wrapRumor(
          {
            kind: ORDER_GENERAL_KIND,
            content: summary,
            tags: [['p', KNOWALL_PUBKEY]],
            created_at: Math.floor(Date.now() / 1000),
          },
          orderBuyer,
          KNOWALL_PUBKEY
        )
          .then((wrap) => publishToRelays(SHOP_RELAYS, wrap))
          .catch((error) => {
            console.warn('[Checkout] Failed to send readable order summary:', error);
          });

        // Await payment. Persist the sats total here — the cart is cleared
        // below, so recomputing later would yield 0 sats.
        setBuyer(orderBuyer);
        setOrderPlacedAt(Math.floor(Date.now() / 1000));
        setCheckoutState({ orderId, status: 'awaiting_payment', totalSats });
        clearCart();

        return orderId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit order';
        setCheckoutState({ orderId: null, status: 'error', error: message });
        throw error;
      }
    },
    [items, totalPrice, currency, convertToSats, clearCart, resolveBuyer]
  );

  const submitPaymentReceipt = useCallback(
    async (invoice: string, preimage: string): Promise<void> => {
      if (!checkoutState.orderId || !buyer) {
        throw new Error('Cannot submit payment receipt');
      }

      // Use the amount captured when the order was created (the cart is
      // empty by now; the recompute is only a defensive fallback).
      const totalSats = checkoutState.totalSats ?? convertToSats(totalPrice, currency);

      const receiptTemplate = createPaymentReceiptTemplate(
        checkoutState.orderId,
        KNOWALL_PUBKEY,
        'lightning',
        invoice,
        preimage,
        totalSats
      );
      const receiptWrap = await wrapRumor(receiptTemplate, buyer, KNOWALL_PUBKEY);
      await publishToRelays(SHOP_RELAYS, receiptWrap);

      // Readable receipt line for generic NIP-17 clients (non-blocking).
      const receiptSummary = `🧾 Payment sent for order #${checkoutState.orderId.slice(0, 8)} — ${totalSats.toLocaleString()} sats (Lightning).`;
      wrapRumor(
        {
          kind: ORDER_GENERAL_KIND,
          content: receiptSummary,
          tags: [['p', KNOWALL_PUBKEY]],
          created_at: Math.floor(Date.now() / 1000),
        },
        buyer,
        KNOWALL_PUBKEY
      )
        .then((wrap) => publishToRelays(SHOP_RELAYS, wrap))
        .catch((error) => {
          console.warn('[Checkout] Failed to send readable receipt summary:', error);
        });

      setCheckoutState((prev) => ({ ...prev, status: 'paid' }));
    },
    [checkoutState.orderId, checkoutState.totalSats, buyer, totalPrice, currency, convertToSats]
  );

  const resetCheckout = useCallback(() => {
    setCheckoutState({ orderId: null, status: 'idle' });
    setBuyer(null);
    setOrderPlacedAt(null);
    processedWrapsRef.current = new Set();
  }, []);

  return {
    checkoutState,
    buyer,
    submitOrder,
    submitPaymentReceipt,
    resetCheckout,
    isSubmitting: checkoutState.status === 'submitting',
    isAwaitingPayment: checkoutState.status === 'awaiting_payment',
    isPaid: checkoutState.status === 'paid',
    hasError: checkoutState.status === 'error',
  };
}
