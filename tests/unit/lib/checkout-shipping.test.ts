import { describe, it, expect } from 'vitest';
import {
  collectCartShippingRefs,
  filterShippingOptions,
  shippingCostFor,
  shippingOptionRef,
  shipsToCountry,
  type CheckoutShippingOption,
} from '@/lib/checkout-shipping';

/**
 * Country-first shipping selection (lib/checkout-shipping), ported from
 * robotechy.com's shippingSelection.
 *
 * Requirements: shop-cart-checkout
 */

const MERCHANT = 'a'.repeat(64);

function buildOption(overrides: Partial<CheckoutShippingOption> = {}): CheckoutShippingOption {
  return {
    id: 'ship-uk',
    title: 'United Kingdom',
    price: { amount: '2.50', currency: 'GBP' },
    countries: ['GB'],
    service: 'standard',
    pubkey: MERCHANT,
    ...overrides,
  };
}

describe('shipsToCountry', () => {
  it('matches a listed alpha-2 country', () => {
    expect(shipsToCountry(buildOption(), 'GB')).toBe(true);
    expect(shipsToCountry(buildOption(), 'FR')).toBe(false);
  });

  it('normalises alpha-3 codes on either side', () => {
    expect(shipsToCountry(buildOption({ countries: ['GBR'] }), 'GB')).toBe(true);
    expect(shipsToCountry(buildOption(), 'GBR')).toBe(true);
  });

  it('treats an option with no country restriction as worldwide', () => {
    expect(shipsToCountry(buildOption({ countries: [] }), 'JP')).toBe(true);
  });

  it('rejects unassigned codes', () => {
    expect(shipsToCountry(buildOption(), 'ZZ')).toBe(false);
  });
});

describe('filterShippingOptions', () => {
  const uk = buildOption();
  const europe = buildOption({ id: 'ship-europe', title: 'Europe', countries: ['FR', 'DE', 'IE'] });
  const world = buildOption({ id: 'ship-worldwide', title: 'Rest of World', countries: [] });

  it('keeps only options covering the selected country (plus worldwide)', () => {
    expect(filterShippingOptions([uk, europe, world], 'GB').map((o) => o.id)).toEqual([
      'ship-uk',
      'ship-worldwide',
    ]);
    expect(filterShippingOptions([uk, europe, world], 'DE').map((o) => o.id)).toEqual([
      'ship-europe',
      'ship-worldwide',
    ]);
    expect(filterShippingOptions([uk, europe, world], 'JP').map((o) => o.id)).toEqual([
      'ship-worldwide',
    ]);
  });

  it('returns everything when no country is selected yet', () => {
    expect(filterShippingOptions([uk, europe], undefined)).toHaveLength(2);
  });
});

describe('shippingCostFor', () => {
  it('charges the zone base price', () => {
    expect(shippingCostFor(buildOption())).toEqual({ amount: 2.5, currency: 'GBP' });
  });

  it('adds the product per-option extra cost', () => {
    expect(shippingCostFor(buildOption({ extraCost: '1.25' })).amount).toBeCloseTo(3.75);
  });

  it('treats malformed and negative numbers as zero instead of NaN', () => {
    expect(shippingCostFor(buildOption({ price: { amount: 'x', currency: 'GBP' } })).amount).toBe(
      0
    );
    expect(shippingCostFor(buildOption({ extraCost: 'x' })).amount).toBe(2.5);
    // parseFloat would accept these; the strict parser must not.
    expect(
      shippingCostFor(buildOption({ price: { amount: '2.50junk', currency: 'GBP' } })).amount
    ).toBe(0);
    expect(shippingCostFor(buildOption({ price: { amount: '-5', currency: 'GBP' } })).amount).toBe(
      0
    );
    expect(shippingCostFor(buildOption({ extraCost: '-1' })).amount).toBe(2.5);
  });
});

describe('shippingOptionRef', () => {
  it('builds the Gamma order shipping tag value', () => {
    expect(shippingOptionRef(buildOption())).toBe(`30406:${MERCHANT}:ship-uk`);
  });
});

describe('collectCartShippingRefs', () => {
  const ref = (id: string, extraCost?: string) => ({
    ref: `30406:${MERCHANT}:${id}`,
    ...(extraCost ? { extraCost } : {}),
  });

  it('deduplicates refs across the cart products', () => {
    const refs = collectCartShippingRefs([
      [ref('ship-uk'), ref('ship-europe')],
      [ref('ship-uk'), ref('ship-worldwide')],
    ]);
    expect(refs.map((r) => r.ref)).toEqual([
      `30406:${MERCHANT}:ship-uk`,
      `30406:${MERCHANT}:ship-europe`,
      `30406:${MERCHANT}:ship-worldwide`,
    ]);
  });

  it('keeps the largest extra cost when products disagree', () => {
    const refs = collectCartShippingRefs([[ref('ship-uk', '1')], [ref('ship-uk', '3')]]);
    expect(refs).toEqual([{ ref: `30406:${MERCHANT}:ship-uk`, extraCost: '3' }]);
  });
});
