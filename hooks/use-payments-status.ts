'use client';

import { useEffect, useState } from 'react';
import {
  fetchPaymentsStatus,
  PAYMENTS_STATUS_POLL_MS,
  type LightningAvailability,
} from '@/lib/payments-status';

/**
 * Lightning payment availability for checkout. Fetched when `enabled` turns on
 * (checkout opened) and re-checked every minute while it stays on. "unknown"
 * (route unreachable or unreadable) must never block buying.
 */
export function usePaymentsStatus(enabled: boolean): LightningAvailability {
  const [status, setStatus] = useState<LightningAvailability>('unknown');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = () =>
      fetchPaymentsStatus().then((next) => {
        if (!cancelled) setStatus(next);
      });
    check();
    const timer = setInterval(check, PAYMENTS_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return status;
}
