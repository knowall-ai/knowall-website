/**
 * Lightning payment availability for checkout.
 *
 * GET /api/payments-status (app/api/payments-status/route.ts) probes the
 * shop's Lightning Address server-side — the same LNURL-pay endpoint the order
 * service invoices from (order-service/lib/lightningHealth.js) — caches the
 * answer for a minute and returns:
 *
 *   { "lightning": "ok" | "unavailable", "checkedAt": "<ISO timestamp>" }
 *
 * Checkout only blocks ordering on an explicit "unavailable". If the route
 * can't be reached or answers anything else, the status is "unknown", which
 * never blocks buying.
 */

/**
 * The order service's LIGHTNING_ADDRESS (docs/ORDER-SERVICE.adoc). Not a
 * secret. Override with the SHOP_LIGHTNING_ADDRESS app setting if the order
 * service's address changes.
 */
export const DEFAULT_SHOP_LIGHTNING_ADDRESS = 'shop@bank.knowall.ai';

export const PAYMENTS_STATUS_URL = '/api/payments-status';
/** How often an open checkout re-checks, and how long the route caches. */
export const PAYMENTS_STATUS_POLL_MS = 60_000;
const PROBE_TIMEOUT_MS = 8000;
const CLIENT_FETCH_TIMEOUT_MS = 5000;

export type LightningAvailability = 'ok' | 'unavailable' | 'unknown';

export interface PaymentsStatus {
  lightning: 'ok' | 'unavailable';
  checkedAt: string;
}

/** The LNURL-pay discovery URL for a Lightning Address, or null if malformed. */
export function lnurlpUrl(address: string | undefined | null): string | null {
  const parts = (address ?? '').trim().split('@');
  if (parts.length !== 2) return null;
  const [name, domain] = parts;
  if (!/^[a-z0-9._+-]+$/i.test(name) || !/^[a-z0-9.-]+(:\d+)?$/i.test(domain)) return null;
  return `https://${domain}/.well-known/lnurlp/${name}`;
}

/** Healthy = HTTP 200 + a JSON body with a `callback`. Never throws. */
export async function probeLightningAddress(
  address: string | undefined | null,
  {
    timeoutMs = PROBE_TIMEOUT_MS,
    fetchImpl = fetch,
  }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  const url = lnurlpUrl(address);
  if (!url) return false;
  try {
    const res = await fetchImpl(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) return false;
    const data = (await res.json()) as { callback?: unknown } | null;
    return typeof data?.callback === 'string' && data.callback.length > 0;
  } catch {
    return false;
  }
}

/**
 * Server side: the current status, probing at most once per `ttlMs` (and
 * coalescing concurrent requests onto one probe).
 */
export function createPaymentsStatusCache({
  address,
  probe = probeLightningAddress,
  ttlMs = PAYMENTS_STATUS_POLL_MS,
  now = Date.now,
}: {
  address: () => string | undefined;
  probe?: (address: string | undefined) => Promise<boolean>;
  ttlMs?: number;
  now?: () => number;
}) {
  let cached: { status: PaymentsStatus; expires: number } | null = null;
  let inFlight: Promise<PaymentsStatus> | null = null;

  return function getPaymentsStatus(): Promise<PaymentsStatus> {
    if (cached && cached.expires > now()) return Promise.resolve(cached.status);
    if (!inFlight) {
      inFlight = probe(address())
        .then((healthy) => {
          const status: PaymentsStatus = {
            lightning: healthy ? 'ok' : 'unavailable',
            checkedAt: new Date(now()).toISOString(),
          };
          cached = { status, expires: now() + ttlMs };
          return status;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
}

export function parsePaymentsStatus(raw: unknown): LightningAvailability {
  const lightning = (raw as { lightning?: unknown } | null)?.lightning;
  return lightning === 'ok' || lightning === 'unavailable' ? lightning : 'unknown';
}

/** Client side: fetch the status. Never throws: any failure means "unknown". */
export async function fetchPaymentsStatus({
  fetchImpl = fetch,
  url = PAYMENTS_STATUS_URL,
}: { fetchImpl?: typeof fetch; url?: string } = {}): Promise<LightningAvailability> {
  try {
    const res = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return 'unknown';
    return parsePaymentsStatus(await res.json());
  } catch {
    return 'unknown';
  }
}
