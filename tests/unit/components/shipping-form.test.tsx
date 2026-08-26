import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShippingForm } from '@/components/checkout/shipping-form';
import type { CheckoutShippingOption } from '@/lib/checkout-shipping';

// Pin the locale-detected country so the tests don't depend on the test
// runner's navigator.language.
vi.mock('@/lib/countries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/countries')>();
  return { ...actual, detectLocaleCountry: () => 'GB' };
});

/**
 * ShippingForm zone guard: a shipping method is mandatory. No order can be
 * placed until a zone covering the ship-to country is selected; a single
 * matching zone is pre-selected automatically.
 *
 * Requirements: shop-cart-checkout
 */

function makeOption(overrides: Partial<CheckoutShippingOption> = {}): CheckoutShippingOption {
  return {
    id: 'ship-uk',
    title: 'UK Tracked',
    price: { amount: '5', currency: 'GBP' },
    countries: ['GB'],
    service: 'standard',
    pubkey: 'a'.repeat(64),
    ...overrides,
  };
}

describe('ShippingForm shipping-method guard', () => {
  it('marks the shipping method as required and keeps Place Order disabled until a zone is chosen', () => {
    const onSubmit = vi.fn();
    render(
      <ShippingForm
        onSubmit={onSubmit}
        isSubmitting={false}
        shippingOptions={[makeOption(), makeOption({ id: 'ship-uk-express', title: 'UK Express' })]}
      />
    );

    // The field is visibly marked mandatory.
    expect(screen.getByText('Shipping Method *')).toBeInTheDocument();

    // Two zones match GB, so none is pre-selected and ordering is blocked.
    const placeOrder = screen.getByRole('button', { name: 'Place Order' });
    expect(placeOrder).toBeDisabled();

    // Belt and braces: even a forced form submit must not place an order.
    fireEvent.submit(placeOrder.closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('pre-selects the zone when exactly one covers the country, enabling Place Order', async () => {
    const onSubmit = vi.fn();
    render(
      <ShippingForm onSubmit={onSubmit} isSubmitting={false} shippingOptions={[makeOption()]} />
    );

    // The only GB-covering zone auto-selects, so the order can proceed.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Place Order' })).toBeEnabled());

    fireEvent.submit(
      screen.getByRole('button', { name: 'Place Order' }).closest('form') as HTMLFormElement
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      shippingZone: 'ship-uk',
      shippingCost: 5,
      shippingCurrency: 'GBP',
      countryCode: 'GB',
    });
  });

  it('blocks ordering entirely when no zone ships to the chosen country', () => {
    const onSubmit = vi.fn();
    render(
      <ShippingForm
        onSubmit={onSubmit}
        isSubmitting={false}
        shippingOptions={[makeOption({ id: 'ship-us', title: 'US Only', countries: ['US'] })]}
      />
    );

    expect(screen.getByTestId('no-shipping-options')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeDisabled();

    fireEvent.submit(
      screen.getByRole('button', { name: 'Place Order' }).closest('form') as HTMLFormElement
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
