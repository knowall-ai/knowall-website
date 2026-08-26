'use client';

/**
 * Live BTC exchange rates for the checkout, ported from robotechy.com's
 * useExchangeRate: fetches the averaged rates once on mount and exposes
 * fiat<->sats converters that fall back to fixed approximate rates when every
 * source fails (so the checkout never dead-ends on a rate outage).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FALLBACK_BTC_EUR,
  FALLBACK_BTC_GBP,
  FALLBACK_BTC_USD,
  getExchangeRates,
  SATS_PER_BTC,
} from '@/lib/exchange-rate';

export interface UseExchangeRateReturn {
  satsPerGbp: number | null;
  satsPerUsd: number | null;
  satsPerEur: number | null;
  isLoading: boolean;
  convertToSats: (amount: number, currency: string) => number;
  convertToFiat: (sats: number, currency: string) => number;
}

export function useExchangeRate(): UseExchangeRateReturn {
  const [satsPerGbp, setSatsPerGbp] = useState<number | null>(null);
  const [satsPerUsd, setSatsPerUsd] = useState<number | null>(null);
  const [satsPerEur, setSatsPerEur] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guards the async fetch against setState-after-unmount.
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    getExchangeRates()
      .then((rates) => {
        if (!mountedRef.current) return;
        setSatsPerGbp(Math.round(SATS_PER_BTC / rates.btcToGbp));
        setSatsPerUsd(Math.round(SATS_PER_BTC / rates.btcToUsd));
        setSatsPerEur(Math.round(SATS_PER_BTC / rates.btcToEur));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setSatsPerGbp(Math.round(SATS_PER_BTC / FALLBACK_BTC_GBP));
        setSatsPerUsd(Math.round(SATS_PER_BTC / FALLBACK_BTC_USD));
        setSatsPerEur(Math.round(SATS_PER_BTC / FALLBACK_BTC_EUR));
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const convertToSats = useCallback(
    (amount: number, currency: string): number => {
      const upper = currency.toUpperCase();
      if (upper === 'SAT' || upper === 'SATS') return Math.round(amount);
      if (upper === 'BTC') return Math.round(amount * SATS_PER_BTC);
      if (upper === 'GBP' || upper === '£') {
        return Math.round(amount * (satsPerGbp || Math.round(SATS_PER_BTC / FALLBACK_BTC_GBP)));
      }
      if (upper === 'EUR' || upper === '€') {
        return Math.round(amount * (satsPerEur || Math.round(SATS_PER_BTC / FALLBACK_BTC_EUR)));
      }
      // Default to USD for unknown fiat currencies.
      return Math.round(amount * (satsPerUsd || Math.round(SATS_PER_BTC / FALLBACK_BTC_USD)));
    },
    [satsPerGbp, satsPerUsd, satsPerEur]
  );

  const convertToFiat = useCallback(
    (sats: number, currency: string): number => {
      const upper = currency.toUpperCase();
      if (upper === 'GBP' || upper === '£') {
        return sats / (satsPerGbp || Math.round(SATS_PER_BTC / FALLBACK_BTC_GBP));
      }
      if (upper === 'EUR' || upper === '€') {
        return sats / (satsPerEur || Math.round(SATS_PER_BTC / FALLBACK_BTC_EUR));
      }
      return sats / (satsPerUsd || Math.round(SATS_PER_BTC / FALLBACK_BTC_USD));
    },
    [satsPerGbp, satsPerUsd, satsPerEur]
  );

  return { satsPerGbp, satsPerUsd, satsPerEur, isLoading, convertToSats, convertToFiat };
}
