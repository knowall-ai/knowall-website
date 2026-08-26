'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CountryCombobox } from './country-combobox';
import {
  filterShippingOptions,
  shippingCostFor,
  shippingOptionRef,
  type CheckoutShippingOption,
} from '@/lib/checkout-shipping';
import { countryName, detectLocaleCountry } from '@/lib/countries';
import type { ShippingInfo } from '@/lib/gamma-order';
import { formatPrice } from '@/lib/nip99';

const inputDark =
  'border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500';

// Legacy fallback zones, used ONLY when the merchant has no kind-30406
// options at all. Their costs are charged like real options; `countries`
// uses ISO codes so country-first filtering applies to them too
// ([] = worldwide). Ported from robotechy's ShippingForm.
const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'ES',
  'CH',
];

const DEFAULT_SHIPPING_OPTIONS: CheckoutShippingOption[] = [
  {
    id: 'uk',
    title: 'UK',
    price: { amount: '0', currency: 'GBP' },
    countries: ['GB'],
    service: 'standard',
    pubkey: '',
  },
  {
    id: 'europe',
    title: 'Europe',
    price: { amount: '15', currency: 'GBP' },
    countries: EU_COUNTRIES,
    service: 'standard',
    pubkey: '',
  },
  {
    id: 'worldwide',
    title: 'Worldwide',
    price: { amount: '25', currency: 'GBP' },
    countries: [], // worldwide
    service: 'standard',
    pubkey: '',
  },
];

const shippingSchema = z.object({
  countryCode: z.string().min(1, 'Please select your country'),
  shippingZone: z.string().min(1, 'Please select a shipping method'),
  name: z.string().optional(),
  address: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type ShippingFormData = z.infer<typeof shippingSchema>;

interface ShippingFormProps {
  onSubmit: (data: ShippingInfo) => void;
  isSubmitting: boolean;
  currency?: string;
  /** Real kind-30406 options for this cart (falls back to legacy zones). */
  shippingOptions?: CheckoutShippingOption[];
  /** True while the real options are still resolving from relays. */
  optionsLoading?: boolean;
  /** Cart items subtotal, for the subtotal/shipping/total summary row. */
  subtotal?: number;
}

/**
 * Country-first shipping form, ported from robotechy.com: the buyer picks
 * their ship-to country, the methods list filters to zones covering it, and
 * the summary shows subtotal + shipping = the total that will be invoiced.
 */
export function ShippingForm({
  onSubmit,
  isSubmitting,
  currency = 'GBP',
  shippingOptions,
  optionsLoading = false,
  subtotal,
}: ShippingFormProps) {
  // Use the merchant's real options when available; legacy zones otherwise.
  const options =
    shippingOptions && shippingOptions.length > 0 ? shippingOptions : DEFAULT_SHIPPING_OPTIONS;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<ShippingFormData>({
    resolver: zodResolver(shippingSchema),
    mode: 'onChange',
    defaultValues: {
      // Country FIRST: pre-select from the browser locale; the buyer can
      // change it. Methods are filtered to those covering this country.
      countryCode: detectLocaleCountry() || '',
      shippingZone: '',
    },
  });

  const countryCode = watch('countryCode');
  const selectedZone = watch('shippingZone');

  // Only methods that ship to the selected country ([] countries = worldwide).
  const availableOptions = useMemo(
    () => (countryCode ? filterShippingOptions(options, countryCode) : []),
    [options, countryCode]
  );

  const selectedOption = availableOptions.find((option) => option.id === selectedZone);

  // Keep the selection coherent as the country (or options) change: clear a
  // selection that no longer ships there; auto-select when exactly one fits.
  useEffect(() => {
    if (selectedZone && !availableOptions.some((option) => option.id === selectedZone)) {
      setValue('shippingZone', '', { shouldValidate: true });
    } else if (!selectedZone && availableOptions.length === 1) {
      setValue('shippingZone', availableOptions[0].id, { shouldValidate: true });
    }
  }, [availableOptions, selectedZone, setValue]);

  const shippingCost = selectedOption ? shippingCostFor(selectedOption) : null;
  const sameCurrency =
    !!shippingCost && shippingCost.currency.toUpperCase() === currency.toUpperCase();

  const handleFormSubmit = (data: ShippingFormData) => {
    if (!selectedOption) return; // guarded by disabled submit; belt and braces
    const cost = shippingCostFor(selectedOption);
    const address = data.address || '';
    onSubmit({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address2 ? `${address}, ${data.address2}` : address,
      city: data.city || '',
      state: '',
      postalCode: data.postalCode || '',
      country: countryName(data.countryCode),
      countryCode: data.countryCode,
      shippingZone: selectedOption.id,
      // Legacy fallback zones aren't real 30406 events (pubkey '') — they
      // get costs but no order `shipping` reference tag.
      shippingRef: selectedOption.pubkey ? shippingOptionRef(selectedOption) : undefined,
      shippingCost: cost.amount,
      shippingCurrency: cost.currency,
      shippingTitle: selectedOption.title,
      message: data.message || '',
    });
  };

  const formatOptionLabel = (option: CheckoutShippingOption) => {
    const cost = shippingCostFor(option);
    return `${option.title} - ${formatPrice({ amount: cost.amount, currency: cost.currency })}`;
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Ship-to country — chosen FIRST so only compatible methods show. */}
      <div className="space-y-2">
        <Label htmlFor="countryCode" className="text-gray-200">
          Ship to *
        </Label>
        <CountryCombobox
          id="countryCode"
          value={countryCode}
          onChange={(code) => setValue('countryCode', code, { shouldValidate: true })}
        />
        {errors.countryCode && <p className="text-sm text-red-400">{errors.countryCode.message}</p>}
      </div>

      {/* Shipping method, filtered to the selected country. */}
      <div className="space-y-2">
        <Label htmlFor="shippingZone" className="text-gray-200">
          Shipping Method *
        </Label>
        {optionsLoading ? (
          <Skeleton className="h-10 w-full bg-gray-800" data-testid="shipping-options-loading" />
        ) : !countryCode ? (
          <p className="text-sm text-gray-400">Select your country first.</p>
        ) : availableOptions.length === 0 ? (
          <p className="text-sm text-gray-400" data-testid="no-shipping-options">
            We don&apos;t ship to {countryName(countryCode)} yet — message the shop and we&apos;ll
            see what we can do.
          </p>
        ) : (
          <Select
            value={selectedZone}
            onValueChange={(value) => setValue('shippingZone', value, { shouldValidate: true })}
          >
            <SelectTrigger
              id="shippingZone"
              className={`${inputDark} ${errors.shippingZone ? 'border-red-500' : ''}`}
            >
              <SelectValue placeholder="Select shipping method" />
            </SelectTrigger>
            <SelectContent className="border-gray-700 bg-gray-900 text-gray-200">
              {availableOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {formatOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.shippingZone && countryCode && availableOptions.length > 0 && (
          <p className="text-sm text-red-400">{errors.shippingZone.message}</p>
        )}
      </div>

      {/* Order summary: subtotal + shipping = the total to be invoiced. */}
      {subtotal != null && (
        <div
          className="space-y-1 rounded-lg bg-gray-800/60 p-3 text-sm text-gray-200"
          data-testid="order-totals"
        >
          <div className="flex justify-between">
            <span className="text-gray-400">Subtotal</span>
            <span>{formatPrice({ amount: subtotal, currency })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Shipping</span>
            <span>
              {shippingCost
                ? formatPrice({ amount: shippingCost.amount, currency: shippingCost.currency })
                : '—'}
            </span>
          </div>
          <Separator className="my-1 bg-gray-700" />
          <div className="flex justify-between font-semibold text-white">
            <span>Total</span>
            <span>
              {shippingCost
                ? sameCurrency
                  ? formatPrice({ amount: subtotal + shippingCost.amount, currency })
                  : `${formatPrice({ amount: subtotal, currency })} + ${formatPrice({ amount: shippingCost.amount, currency: shippingCost.currency })}`
                : formatPrice({ amount: subtotal, currency })}
            </span>
          </div>
        </div>
      )}

      <Separator className="bg-gray-800" />

      {/* Shipping Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Shipping Address (optional)</h3>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-gray-200">
            Full Name
          </Label>
          <Input id="name" placeholder="John Doe" {...register('name')} className={inputDark} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-gray-200">
            Address Line 1
          </Label>
          <Input
            id="address"
            placeholder="123 Main Street"
            {...register('address')}
            className={inputDark}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address2" className="text-gray-200">
            Address Line 2
          </Label>
          <Input
            id="address2"
            placeholder="Apartment, suite, etc."
            {...register('address2')}
            className={inputDark}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city" className="text-gray-200">
              City
            </Label>
            <Input id="city" placeholder="Belfast" {...register('city')} className={inputDark} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode" className="text-gray-200">
              Postcode
            </Label>
            <Input
              id="postalCode"
              placeholder="BT1 1AA"
              {...register('postalCode')}
              className={inputDark}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-gray-800" />

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Contact Information</h3>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-200">
            Email (optional)
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            className={`${inputDark} ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-gray-200">
            Phone (optional)
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+44 7700 900000"
            {...register('phone')}
            className={inputDark}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-gray-200">
            Order Notes (optional)
          </Label>
          <Textarea
            id="message"
            placeholder="Any special instructions for your order..."
            {...register('message')}
            rows={3}
            className={inputDark}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-lime-600 font-semibold text-white hover:bg-lime-700"
        disabled={!isValid || !selectedOption || isSubmitting || optionsLoading}
      >
        {isSubmitting ? 'Processing...' : 'Place Order'}
      </Button>
    </form>
  );
}
