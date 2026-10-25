/**
 * Server-side order pricing. The buyer's `amount` tag is untrusted: this module
 * recomputes the order total from KnowAll's OWN signed catalog (kind-30402
 * listings and kind-30406 shipping options) and decides whether the order may be
 * invoiced. The service then invoices the figure computed here, never the
 * buyer's.
 *
 * The arithmetic is a faithful port of the website checkout so honest orders
 * always agree with it:
 *   - listing price          lib/nip99.ts            parsePrice
 *   - shipping option price  lib/shop-admin.ts       parseShippingZone
 *   - shipping refs + extra  lib/nip99.ts            parseShippingRefs
 *                            lib/checkout-shipping.ts collectCartShippingRefs / shippingCostFor
 *   - fiat -> sats           hooks/use-exchange-rate.ts convertToSats
 *   - order total            lib/gamma-order.ts      orderTotalSats
 *
 * Everything here is pure (no network, no clock): the catalog and the exchange
 * rates are passed in, so every branch is unit-testable.
 */

import { verifyEvent } from 'nostr-tools/pure';
import { MAX_ORDER_SATS } from './orderParser.js';

export const PRODUCT_KIND = 30402;
export const SHIPPING_OPTION_KIND = 30406;
export const SATS_PER_BTC = 100_000_000;

/** Same cap as the website cart (lib/cart.ts MAX_QUANTITY). */
export const MAX_QUANTITY = 999;

/** Same cap as lib/nip99.ts MAX_SHIPPING_AMOUNT. */
export const MAX_SHIPPING_AMOUNT = 1_000_000;

/**
 * Allowed relative difference between the buyer's amount and ours for the part
 * of the total that was converted from fiat. The buyer's browser and this
 * service fetch BTC rates from the same three sources, but at different moments
 * (the checkout page caches its rates from page load), so they never agree to
 * the sat. Sat-priced parts must match exactly.
 */
export const FIAT_RATE_TOLERANCE = 0.05;

/** First value of the first `d` tag, or undefined. */
function dTagOf(event) {
  const tag = event.tags?.find((t) => t[0] === 'd' && typeof t[1] === 'string');
  return tag ? tag[1] : undefined;
}

/** True when the event's id and Schnorr signature verify; never throws. */
export function isSignedEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.sig !== 'string') return false;
  try {
    return verifyEvent(event);
  } catch {
    return false;
  }
}

/**
 * Reduce relay events to the merchant's VERIFIED catalog: only kind 30402/30406
 * events authored by `merchantPubkey` whose signature verifies, newest per
 * (kind, d-tag) — both kinds are parameterized-replaceable.
 *
 * Signature check runs last (after the cheap kind/author/d filters), so junk a
 * relay returns costs nothing.
 *
 * @param {import('nostr-tools').Event[]} events
 * @param {string} merchantPubkey
 * @returns {{ listings: Map<string, import('nostr-tools').Event>, shippingOptions: Map<string, import('nostr-tools').Event> }}
 *   keyed by coordinate "<kind>:<pubkey>:<d>"
 */
export function buildVerifiedCatalog(events, merchantPubkey) {
  const newest = new Map();
  for (const event of events) {
    if (event?.kind !== PRODUCT_KIND && event?.kind !== SHIPPING_OPTION_KIND) continue;
    if (event.pubkey !== merchantPubkey) continue;
    const d = dTagOf(event);
    if (d === undefined) continue;
    const coord = `${event.kind}:${event.pubkey}:${d}`;
    const existing = newest.get(coord);
    if (existing && existing.created_at >= event.created_at) continue;
    if (!isSignedEvent(event)) continue;
    newest.set(coord, event);
  }
  const listings = new Map();
  const shippingOptions = new Map();
  for (const [coord, event] of newest) {
    (event.kind === PRODUCT_KIND ? listings : shippingOptions).set(coord, event);
  }
  return { listings, shippingOptions };
}

/** lib/nip99.ts parsePrice: Number(), finite, >= 0; currency upper-cased, default SATS. */
export function parseListingPrice(event) {
  const tag = event.tags.find((t) => t[0] === 'price' && typeof t[1] === 'string');
  if (!tag) return null;
  const amount = Number(tag[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = typeof tag[2] === 'string' && tag[2] ? tag[2].toUpperCase() : 'SATS';
  return { amount, currency };
}

/** lib/nip99.ts parseNonNegativeAmount: strict decimal within the cap, else 0. */
export function parseNonNegativeAmount(raw) {
  if (!raw) return 0;
  const trimmed = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) && value <= MAX_SHIPPING_AMOUNT ? value : 0;
}

/** lib/nip99.ts parseShippingRefs: `shipping_option` refs, largest valid extra cost per ref. */
export function parseListingShippingRefs(event) {
  const byRef = new Map();
  for (const tag of event.tags) {
    if (tag[0] !== 'shipping_option' || typeof tag[1] !== 'string') continue;
    if (tag[1].split(':').length < 3 || !tag[1].startsWith(`${SHIPPING_OPTION_KIND}:`)) continue;
    const extraCost = typeof tag[2] === 'string' && tag[2] ? tag[2] : undefined;
    const existing = byRef.get(tag[1]);
    if (existing && parseNonNegativeAmount(extraCost) <= parseNonNegativeAmount(existing.extraCost))
      continue;
    byRef.set(tag[1], { ref: tag[1], extraCost });
  }
  return [...byRef.values()];
}

/** lib/checkout-shipping.ts collectCartShippingRefs: largest extra cost wins across products. */
export function collectShippingRefs(perListingRefs) {
  const byRef = new Map();
  for (const refs of perListingRefs) {
    for (const { ref, extraCost } of refs) {
      const existing = byRef.get(ref);
      if (
        !existing ||
        parseNonNegativeAmount(extraCost) > parseNonNegativeAmount(existing.extraCost)
      ) {
        byRef.set(ref, { ref, extraCost });
      }
    }
  }
  return byRef;
}

/** lib/shop-admin.ts parseShippingZone price: raw amount string + upper-cased currency (default SATS). */
function parseShippingOptionPrice(event) {
  const tag = event.tags.find(([name]) => name === 'price');
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!tag || !title) return null;
  return { amount: tag[1] ?? '', currency: (tag[2] ?? 'SATS').toUpperCase() };
}

/** lib/nip99.ts parseListing `stock`: a non-negative number, or null when untracked. */
function parseStock(event) {
  const raw = event.tags.find((t) => t[0] === 'stock' && typeof t[1] === 'string')?.[1];
  if (raw === undefined) return null;
  const stock = Number(raw);
  return Number.isFinite(stock) && stock >= 0 ? stock : null;
}

/** lib/nip99.ts isSoldOut: NIP-99 `status` sold, or Gamma `stock` 0. */
export function isSoldOut(event) {
  const status = event.tags.find((t) => t[0] === 'status' && typeof t[1] === 'string')?.[1];
  return status === 'sold' || parseStock(event) === 0;
}

/** Is a currency code priced in bitcoin units (exact, no exchange rate)? */
function isBitcoinCurrency(currency) {
  const upper = currency.toUpperCase();
  return upper === 'SAT' || upper === 'SATS' || upper === 'BTC';
}

/**
 * hooks/use-exchange-rate.ts convertToSats, with the rates passed in. `rates`
 * is `{ satsPerGbp, satsPerUsd, satsPerEur }` (each Math.round(1e8 / btcPrice),
 * exactly as the hook derives them). Unknown fiat codes price as USD, as the
 * website does. Throws when a fiat conversion is needed but no rates are given.
 */
export function convertToSats(amount, currency, rates) {
  const upper = currency.toUpperCase();
  if (upper === 'SAT' || upper === 'SATS') return Math.round(amount);
  if (upper === 'BTC') return Math.round(amount * SATS_PER_BTC);
  if (!rates) throw new Error(`Exchange rates required to price ${upper}`);
  if (upper === 'GBP' || upper === '£') return Math.round(amount * rates.satsPerGbp);
  if (upper === 'EUR' || upper === '€') return Math.round(amount * rates.satsPerEur);
  return Math.round(amount * rates.satsPerUsd);
}

/** Every currency the order will need converted (so callers fetch rates only when needed). */
export function currenciesNeeded(order, catalog) {
  const currencies = new Set();
  for (const item of order.items) {
    const event = catalog.listings.get(item.ref);
    const price = event && parseListingPrice(event);
    if (price) currencies.add(price.currency);
  }
  const option = order.shippingRef && catalog.shippingOptions.get(order.shippingRef);
  const price = option && parseShippingOptionPrice(option);
  if (price) currencies.add(price.currency);
  return [...currencies];
}

/** True when pricing this order needs a fiat exchange rate. */
export function needsExchangeRates(order, catalog) {
  return currenciesNeeded(order, catalog).some((c) => !isBitcoinCurrency(c));
}

const reject = (reason) => ({ ok: false, reason });

/**
 * Recompute an order's total in sats from the verified catalog and decide
 * whether to accept it.
 *
 * Rejects (with a buyer-readable reason) when:
 *   - the order has no items, or a line's quantity is missing/over MAX_QUANTITY
 *   - an item ref isn't "30402:<merchant>:<d>" (wrong author) or isn't in the
 *     verified catalog (unknown / forged / deleted item), or has no price
 *   - a shipping ref isn't a verified merchant option the cart may use, or no
 *     shipping method was chosen although the merchant offers some
 *   - the buyer's amount differs from ours (beyond the fiat tolerance)
 *
 * @param {{ amount: number, items: Array<{ref: string, quantity: number|null}>, shippingRef?: string }} order
 * @param {{ listings: Map<string, any>, shippingOptions: Map<string, any> }} catalog - from buildVerifiedCatalog
 * @param {{ merchantPubkey: string, rates?: { satsPerGbp: number, satsPerUsd: number, satsPerEur: number } }} opts
 * @returns {{ ok: true, totalSats: number, itemsSats: number, shippingSats: number, fiatSats: number }
 *   | { ok: false, reason: string }}
 */
export function priceOrder(order, catalog, { merchantPubkey, rates }) {
  if (!order.items.length) return reject('the order has no items');

  // Items: sum per currency first, then convert each currency once — for the
  // usual single-currency cart this is exactly the website's
  // convertToSats(cartTotal, currency).
  const perCurrency = new Map();
  const listingEvents = [];
  for (const item of order.items) {
    if (item.quantity === null || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return reject(`each item quantity must be between 1 and ${MAX_QUANTITY}`);
    }
    const parts = typeof item.ref === 'string' ? item.ref.split(':') : [];
    if (parts.length < 3 || parts[0] !== String(PRODUCT_KIND)) {
      return reject('an item reference is malformed');
    }
    if (parts[1] !== merchantPubkey) return reject('an item is not sold by KnowAll AI');
    const event = catalog.listings.get(item.ref);
    if (!event) return reject('an item is no longer in the KnowAll catalogue');
    if (isSoldOut(event)) return reject('an item is sold out');
    const price = parseListingPrice(event);
    if (!price) return reject('an item has no price');
    perCurrency.set(
      price.currency,
      (perCurrency.get(price.currency) ?? 0) + price.amount * item.quantity
    );
    listingEvents.push(event);
  }

  // Stock (Gamma `stock` tag), summed per product across lines.
  const quantityByRef = new Map();
  for (const item of order.items) {
    quantityByRef.set(item.ref, (quantityByRef.get(item.ref) ?? 0) + item.quantity);
  }
  for (const [ref, quantity] of quantityByRef) {
    const stock = parseStock(catalog.listings.get(ref));
    if (stock !== null && quantity > stock) {
      return reject(`only ${stock} of an item ${stock === 1 ? 'is' : 'are'} in stock`);
    }
  }

  let itemsSats = 0;
  let fiatSats = 0;
  for (const [currency, amount] of perCurrency) {
    const sats = convertToSats(amount, currency, rates);
    itemsSats += sats;
    if (!isBitcoinCurrency(currency)) fiatSats += sats;
  }

  // Shipping (hooks/use-checkout.ts useCheckoutShippingOptions): the options
  // the ordered products reference, or every merchant option when none of
  // those resolve. Cost = base price + the largest per-product extra cost.
  const refs = collectShippingRefs(listingEvents.map(parseListingShippingRefs));
  // Only usable options count, as on the website (parseShippingZone needs a title and price).
  const usable = [...catalog.shippingOptions.keys()].filter((ref) =>
    parseShippingOptionPrice(catalog.shippingOptions.get(ref))
  );
  const referenced = usable.filter((ref) => refs.has(ref));
  const allowed = new Set(referenced.length > 0 ? referenced : usable);

  let shippingSats = 0;
  if (order.shippingRef) {
    if (!allowed.has(order.shippingRef)) {
      return reject('the chosen shipping method is not available for these items');
    }
    const price = parseShippingOptionPrice(catalog.shippingOptions.get(order.shippingRef));
    const cost =
      parseNonNegativeAmount(price.amount) +
      parseNonNegativeAmount(refs.get(order.shippingRef)?.extraCost);
    shippingSats = cost ? convertToSats(cost, price.currency, rates) : 0;
    if (!isBitcoinCurrency(price.currency)) fiatSats += shippingSats;
  } else if (allowed.size > 0) {
    return reject('no shipping method was chosen');
  }

  const totalSats = itemsSats + shippingSats;
  if (!Number.isSafeInteger(totalSats) || totalSats <= 0 || totalSats > MAX_ORDER_SATS) {
    return reject('the order total is outside the range we can invoice');
  }

  const tolerance = Math.ceil(fiatSats * FIAT_RATE_TOLERANCE);
  if (Math.abs(order.amount - totalSats) > tolerance) {
    return reject(
      `the order amount (${order.amount.toLocaleString('en-GB')} sats) does not match the current price (${totalSats.toLocaleString('en-GB')} sats)`
    );
  }

  return { ok: true, totalSats, itemsSats, shippingSats, fiatSats };
}
