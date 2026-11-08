// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  createPaymentsStatusCache,
  fetchPaymentsStatus,
  lnurlpUrl,
  parsePaymentsStatus,
  probeLightningAddress,
} from '@/lib/payments-status';

/**
 * Payments status (checkout "Lightning payments are temporarily unavailable")
 * - the route probes the shop's LNURL-pay endpoint: healthy = 200 + callback
 * - probes are cached for a minute and concurrent requests share one probe
 * - the client treats anything but ok/unavailable as "unknown" (never blocks)
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('lnurlpUrl', () => {
  it('maps name@domain to the LUD-16 endpoint and rejects malformed addresses', () => {
    expect(lnurlpUrl('shop@bank.knowall.ai')).toBe(
      'https://bank.knowall.ai/.well-known/lnurlp/shop'
    );
    for (const bad of ['', undefined, 'shop', 'shop@', '@x.ai', 'a@b@c', 'x@ex/ample']) {
      expect(lnurlpUrl(bad)).toBeNull();
    }
  });
});

describe('probeLightningAddress', () => {
  it('is healthy only for HTTP 200 + JSON with a callback', async () => {
    const ok = vi.fn(async () => json({ tag: 'payRequest', callback: 'https://x/cb' }));
    expect(await probeLightningAddress('shop@bank.knowall.ai', { fetchImpl: ok })).toBe(true);
    expect(ok).toHaveBeenCalledWith(
      'https://bank.knowall.ai/.well-known/lnurlp/shop',
      expect.anything()
    );

    const bad: Array<() => Promise<Response>> = [
      async () => json({ callback: 'x' }, 502),
      async () => json({ status: 'ERROR', reason: 'down' }),
      async () => new Response('<html>', { status: 200 }),
      async () => {
        throw new TypeError('fetch failed');
      },
    ];
    for (const fetchImpl of bad) {
      expect(await probeLightningAddress('shop@bank.knowall.ai', { fetchImpl })).toBe(false);
    }
  });

  it('treats an empty address as unavailable without a network call', async () => {
    const fetchImpl = vi.fn();
    expect(await probeLightningAddress('', { fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('createPaymentsStatusCache', () => {
  it('probes at most once per TTL and shares an in-flight probe', async () => {
    let t = Date.parse('2026-11-08T12:00:00Z');
    let healthy = false;
    const probe = vi.fn(async () => healthy);
    const get = createPaymentsStatusCache({
      address: () => 'shop@bank.knowall.ai',
      probe,
      ttlMs: 60_000,
      now: () => t,
    });

    const [a, b] = await Promise.all([get(), get()]);
    expect(a).toEqual({ lightning: 'unavailable', checkedAt: '2026-11-08T12:00:00.000Z' });
    expect(b).toBe(a);
    expect(probe).toHaveBeenCalledTimes(1);

    healthy = true;
    t += 30_000;
    expect((await get()).lightning).toBe('unavailable'); // still cached
    t += 31_000;
    expect((await get()).lightning).toBe('ok');
    expect(probe).toHaveBeenCalledTimes(2);
  });
});

describe('client status', () => {
  it('parses only the two known states', () => {
    expect(parsePaymentsStatus({ lightning: 'ok' })).toBe('ok');
    expect(parsePaymentsStatus({ lightning: 'unavailable' })).toBe('unavailable');
    expect(parsePaymentsStatus({ lightning: 'down' })).toBe('unknown');
    expect(parsePaymentsStatus(null)).toBe('unknown');
  });

  it('never blocks buying when the route fails', async () => {
    expect(
      await fetchPaymentsStatus({ fetchImpl: async () => json({ lightning: 'unavailable' }) })
    ).toBe('unavailable');
    expect(await fetchPaymentsStatus({ fetchImpl: async () => json({}, 500) })).toBe('unknown');
    expect(
      await fetchPaymentsStatus({
        fetchImpl: async () => {
          throw new TypeError('Failed to fetch');
        },
      })
    ).toBe('unknown');
  });
});
