/**
 * Pure shipping-selection core for the country-first checkout (Gamma Markets
 * kind 30406), ported from robotechy.com's lib/shippingSelection. Deliberately
 * UI-free so hooks/components stay thin and this stays unit-testable.
 *
 * The checkout flow: collect the cart's `shipping_option` refs → resolve them
 * to the merchant's kind-30406 zone events → filter by the buyer's ship-to
 * country → charge the zone's base price plus the product's per-option
 * extra cost.
 */

import { toAlpha2 } from './countries';
import { MAX_SHIPPING_AMOUNT, parseNonNegativeAmount } from './nip99';
import type { ListingShippingRef } from './nip99';

// Re-exported so the shipping cap stays reachable from the checkout module
// that owns the rest of the checkout surface.
export { MAX_SHIPPING_AMOUNT };
import type { ShippingZone } from './shop-admin';

/** A resolved shipping option the buyer can pick at checkout. */
export interface CheckoutShippingOption extends ShippingZone {
  /** The zone event's author (merchant) pubkey — used for the order's ref. */
  pubkey: string;
  /** Optional per-product extra cost from the listing's shipping_option tag. */
  extraCost?: string;
}

/**
 * Does a shipping option cover the given ship-to country?
 * Per the Gamma spec, `country` tags carry ISO 3166-1 alpha-2 codes; an option
 * with NO country restriction is treated as worldwide. Real events in the wild
 * also carry alpha-3 codes ("GBR"), so every code is normalised to alpha-2
 * before comparing.
 */
export function shipsToCountry(option: CheckoutShippingOption, countryCode: string): boolean {
  if (!option.countries || option.countries.length === 0) {
    return true; // no restriction -> worldwide
  }
  const code = toAlpha2(countryCode);
  if (!code) return false;
  return option.countries.some((c) => toAlpha2(c) === code);
}

/**
 * Filter options to those that ship to the selected country. An empty/missing
 * country keeps the full list (nothing chosen yet).
 */
export function filterShippingOptions(
  options: CheckoutShippingOption[],
  countryCode: string | undefined
): CheckoutShippingOption[] {
  if (!countryCode) return options;
  return options.filter((option) => shipsToCountry(option, countryCode));
}

/**
 * The cost of a shipping option: the 30406 base `price` plus the product's
 * per-option `extra-cost` (third element of the product's shipping_option
 * tag). Malformed or negative values count as 0 rather than poisoning the
 * total.
 */
export function shippingCostFor(option: CheckoutShippingOption): {
  amount: number;
  currency: string;
} {
  return {
    amount: parseNonNegativeAmount(option.price.amount) + parseNonNegativeAmount(option.extraCost),
    currency: option.price.currency,
  };
}

/** The order's `shipping` tag value per the Gamma spec: "30406:<pubkey>:<d-tag>". */
export function shippingOptionRef(option: CheckoutShippingOption): string {
  return `30406:${option.pubkey}:${option.id}`;
}

/**
 * Collect the distinct shipping refs across the cart's listings. When several
 * products reference the same option with an extra cost, the LARGEST extra
 * cost wins — a conservative single-charge reading of the spec (the per-order
 * shipping method is chosen once, so extra costs are not stacked per product).
 */
export function collectCartShippingRefs(
  perListingRefs: ListingShippingRef[][]
): ListingShippingRef[] {
  const byRef = new Map<string, ListingShippingRef>();
  for (const refs of perListingRefs) {
    for (const { ref, extraCost } of refs) {
      const existing = byRef.get(ref);
      if (!existing) {
        byRef.set(ref, { ref, ...(extraCost ? { extraCost } : {}) });
        continue;
      }
      // Compare with the same strict parser that charges the cost later —
      // parseFloat would let partial junk ("3junk" -> 3) beat a valid value
      // that shippingCostFor then charges as 0, undercharging shipping.
      const a = parseNonNegativeAmount(existing.extraCost);
      const b = parseNonNegativeAmount(extraCost);
      if (b > a) {
        byRef.set(ref, { ref, ...(extraCost ? { extraCost } : {}) });
      }
    }
  }
  return [...byRef.values()];
}
