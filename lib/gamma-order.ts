/**
 * Gamma Markets order events — pure builders and parsers, ported from
 * robotechy.com's lib/gammaOrderUtils.
 *
 * The buyer's order travels to the merchant as a structured kind-16 rumor
 * (type 1 = order creation) plus a readable kind-14 summary; the merchant
 * replies with a kind-16 type-2 payment request carrying a Lightning invoice;
 * the buyer answers with a kind-17 payment receipt. All of these ride inside
 * NIP-17 gift wraps (lib/nip17) — nothing here touches the network.
 *
 * Spec: https://github.com/GammaMarkets/market-spec/blob/main/spec.md
 */

import type { CartItem } from './cart';
import { formatPrice } from './nip99';
import { PRODUCT_KIND } from './shop-admin';
import type { EventTemplate } from './story-social';

// Gamma Markets event kinds.
export const ORDER_GENERAL_KIND = 14; // General communication (readable DM)
export const ORDER_PROCESS_KIND = 16; // Order processing
export const PAYMENT_RECEIPT_KIND = 17; // Payment receipts

// Order message types for kind 16.
export const ORDER_MESSAGE_TYPE = {
  ORDER_CREATION: '1',
  PAYMENT_REQUEST: '2',
  STATUS_UPDATE: '3',
  SHIPPING_UPDATE: '4',
} as const;

/** Shipping details captured by the checkout form. */
export interface ShippingInfo {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  /** Localised country display name (for the address tag / summary). */
  country: string;
  /** Ship-to country (ISO 3166-1 alpha-2). */
  countryCode?: string;
  /** Selected shipping option id (kind 30406 d-tag). */
  shippingZone: string;
  /** Order `shipping` tag value: "30406:<pubkey>:<d-tag>". */
  shippingRef?: string;
  /** Option base price + product extra-cost. */
  shippingCost?: number;
  /** Currency of shippingCost. */
  shippingCurrency?: string;
  /** Display title for human-readable summaries. */
  shippingTitle?: string;
  /** Optional note to the merchant. */
  message?: string;
}

/** Kind-16 type-2 payment request, as consumed by the payment UI. */
export interface GammaPaymentRequest {
  /** Order ID. */
  id: string;
  type: 2;
  /** Amount in satoshis. */
  amount: number;
  message?: string;
  payment_options: Array<{
    type: 'ln' | 'lnurl';
    /** BOLT11 invoice or LNURL. */
    link: string;
  }>;
}

/** Checkout state machine (hooks/use-checkout). */
export interface CheckoutState {
  orderId: string | null;
  status: 'idle' | 'submitting' | 'awaiting_payment' | 'paid' | 'error';
  error?: string;
  paymentRequest?: GammaPaymentRequest;
  /**
   * Order total in satoshis, captured at order-creation time. The payment
   * receipt reads this instead of recomputing from the cart, which is cleared
   * once the order is placed (recomputing would yield 0 sats).
   */
  totalSats?: number;
}

/** Generate a unique order ID. */
export function generateOrderId(): string {
  return crypto.randomUUID();
}

/**
 * Parse an untrusted commerce `amount` tag value (sats) into a number
 * suitable for display. Satoshi amounts are whole numbers, and tags are
 * untrusted input, so anything but a plain non-negative integer string
 * (hex/exponent forms, decimals, negatives, junk) returns `undefined` rather
 * than a truncated or `NaN` value the UI would mis-render.
 */
export function parseCommerceAmount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** Format shipping address as a single string. */
export function formatAddress(info: ShippingInfo): string {
  const parts = [info.address, info.city, info.state, info.postalCode, info.country].filter(
    Boolean
  );
  return parts.join(', ');
}

/** Create order tags for kind 16 type 1 (order creation). */
export function createOrderTags(
  orderId: string,
  items: CartItem[],
  shipping: ShippingInfo,
  merchantPubkey: string,
  totalSats: number
): string[][] {
  const tags: string[][] = [
    ['p', merchantPubkey],
    ['subject', `Order ${orderId.slice(0, 8)}`],
    ['type', ORDER_MESSAGE_TYPE.ORDER_CREATION],
    ['order', orderId],
    ['amount', totalSats.toString()],
  ];

  // Item tags: ['item', '30402:<pubkey>:<d-tag>', quantity].
  for (const item of items) {
    const productRef = `${PRODUCT_KIND}:${item.listing.pubkey}:${item.productId}`;
    tags.push(['item', productRef, item.quantity.toString()]);
  }

  // Reference the chosen shipping option per the Gamma spec so the merchant
  // knows exactly which method (and price) the buyer selected:
  // ["shipping", "30406:<pubkey>:<d-tag>"].
  if (shipping.shippingRef) {
    tags.push(['shipping', shipping.shippingRef]);
  }

  // Shipping/contact info — PII, safe only because the whole rumor rides
  // encrypted inside the gift wrap. All fields are optional at checkout, so
  // only emit tags that carry a value: empty-string PII tags are ambiguous
  // for the merchant to parse and needlessly bloat the encrypted payload.
  const address = formatAddress(shipping);
  if (address) {
    tags.push(['address', address]);
  }
  if (shipping.email) {
    tags.push(['email', shipping.email]);
  }
  if (shipping.phone) {
    tags.push(['phone', shipping.phone]);
  }

  return tags;
}

/**
 * Create a kind-16 order-creation rumor template. Unsigned — the NIP-17 wrap
 * path (lib/nip17) seals it; rumors are never independently signed.
 */
export function createOrderEventTemplate(
  orderId: string,
  items: CartItem[],
  shipping: ShippingInfo,
  merchantPubkey: string,
  totalSats: number
): EventTemplate {
  return {
    kind: ORDER_PROCESS_KIND,
    content: shipping.message || '',
    tags: createOrderTags(orderId, items, shipping, merchantPubkey, totalSats),
    created_at: Math.floor(Date.now() / 1000),
  };
}

/** Create a kind-17 payment-receipt rumor template. */
export function createPaymentReceiptTemplate(
  orderId: string,
  merchantPubkey: string,
  paymentMethod: 'lightning' | 'bitcoin',
  invoice: string,
  proof: string,
  amountSats: number
): EventTemplate {
  return {
    kind: PAYMENT_RECEIPT_KIND,
    content: '',
    tags: [
      ['p', merchantPubkey],
      ['subject', `Payment for order ${orderId.slice(0, 8)}`],
      ['order', orderId],
      ['payment', paymentMethod, invoice, proof],
      ['amount', amountSats.toString()],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
}

/** The tag-and-content surface of a decrypted rumor (id/sig irrelevant here). */
interface RumorLike {
  kind: number;
  content: string;
  tags: string[][];
}

/** Parse a payment request from a kind-16 type-2 rumor, or null. */
export function parsePaymentRequest(event: RumorLike): {
  orderId: string;
  amount: number;
  paymentOptions: Array<{ type: string; detail: string }>;
  message?: string;
} | null {
  const typeTag = event.tags.find((t) => t[0] === 'type');
  if (typeTag?.[1] !== ORDER_MESSAGE_TYPE.PAYMENT_REQUEST) {
    return null;
  }

  const orderTag = event.tags.find((t) => t[0] === 'order');
  const amountTag = event.tags.find((t) => t[0] === 'amount');
  const paymentTags = event.tags.filter((t) => t[0] === 'payment');

  if (!orderTag || !amountTag) {
    return null;
  }

  // Sats amounts must be plain non-negative integers; reject the request
  // rather than render a truncated/NaN amount from a malformed tag.
  const amount = parseCommerceAmount(amountTag[1]);
  if (amount === undefined) {
    return null;
  }

  return {
    orderId: orderTag[1],
    amount,
    // Only well-formed payment tags: a malformed/truncated tag would yield
    // detail: undefined while the type claims string, tripping downstream.
    paymentOptions: paymentTags
      .filter((t) => typeof t[1] === 'string' && typeof t[2] === 'string')
      .map((t) => ({ type: t[1], detail: t[2] })),
    message: event.content || undefined,
  };
}

/**
 * Map untrusted, parsed payment options onto the strict
 * `GammaPaymentRequest['payment_options']` shape consumed by the checkout UI.
 *
 * Only `lightning` options are accepted and mapped to `'ln'` (a BOLT11
 * invoice). Every other type (`bitcoin`, `fiat`, or anything a crafted
 * payment request might inject) is DROPPED rather than coerced — the payment
 * UI treats every option as a Lightning invoice (`lightning:<link>`), so
 * misclassifying e.g. an on-chain `bitcoin` address as `'ln'` would route it
 * through the wrong payment flow. Fail closed: unsupported options simply
 * don't appear.
 */
export function toGammaPaymentOptions(
  paymentOptions: Array<{ type: string; detail: string }>
): GammaPaymentRequest['payment_options'] {
  return paymentOptions
    .filter((opt) => opt.type === 'lightning' && typeof opt.detail === 'string' && opt.detail)
    .map((opt) => ({ type: 'ln' as const, link: opt.detail }));
}

/**
 * Format a human-readable order summary. This text is sent as a SECOND,
 * gift-wrapped (NIP-17) inner kind-14 message alongside the structured kind-16
 * order, so the order also renders in generic NIP-17 clients (Damus, Primal,
 * 0xchat). It is fully encrypted — never a plaintext DM.
 */
export function formatOrderSummary(
  orderId: string,
  items: CartItem[],
  shipping: ShippingInfo,
  totalPrice: number,
  currency: string
): string {
  const orderIdShort = orderId.slice(0, 8);

  const itemsText = items
    .map((item) => {
      const price = item.listing.price?.amount ?? 0;
      const itemCurrency = item.listing.price?.currency ?? currency;
      const lineTotal = price * item.quantity;
      return `- ${item.quantity}x ${item.listing.title} @ ${formatPrice({ amount: price, currency: itemCurrency })} = ${formatPrice({ amount: lineTotal, currency: itemCurrency })}`;
    })
    .join('\n');

  const addressParts = [
    shipping.name,
    shipping.address,
    shipping.city,
    shipping.postalCode,
    shipping.country,
  ].filter(Boolean);

  const addressText = addressParts.length > 0 ? `\nShip to:\n${addressParts.join('\n')}` : '';

  const contactParts: string[] = [];
  if (shipping.email) contactParts.push(`Email: ${shipping.email}`);
  if (shipping.phone) contactParts.push(`Phone: ${shipping.phone}`);
  const contactText = contactParts.length > 0 ? `\n${contactParts.join('\n')}` : '';

  const messageText = shipping.message ? `\nNote: ${shipping.message}` : '';

  // Itemise shipping and show the ALL-IN total (items + shipping) — the same
  // total that goes into the order's `amount` tag and gets invoiced.
  const shippingLabel = shipping.shippingTitle || shipping.shippingZone;
  const shippingCurrency = shipping.shippingCurrency || currency;
  const shippingCostText =
    shipping.shippingCost != null
      ? ` (${formatPrice({ amount: shipping.shippingCost, currency: shippingCurrency })})`
      : '';
  // Only sum for display when the currencies actually match; otherwise show
  // both amounts rather than adding apples to oranges (the sats `amount` tag
  // converts each part in its own currency, so it stays correct either way).
  const sameCurrency = shippingCurrency.toUpperCase() === currency.toUpperCase();
  const totalText =
    shipping.shippingCost != null && !sameCurrency
      ? `${formatPrice({ amount: totalPrice, currency })} + ${formatPrice({ amount: shipping.shippingCost, currency: shippingCurrency })} shipping`
      : formatPrice({
          amount: totalPrice + (sameCurrency ? (shipping.shippingCost ?? 0) : 0),
          currency,
        });

  return `📦 New Order #${orderIdShort}

Items:
${itemsText}

Shipping: ${shippingLabel}${shippingCostText}
Total: ${totalText}
${addressText}${contactText}${messageText}`.trim();
}
