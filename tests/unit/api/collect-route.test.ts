// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rate-limit';

/**
 * Page-view beacon route
 *
 * Requirements: site-analytics
 * - /api/collect never stores anything on the device
 * - Only same-origin beacons with clean paths are counted
 * - Rate limited per IP and per day, and the body is size capped, so the
 *   endpoint can't be scripted into App Insights cost or poisoned figures
 */

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/analytics/track', () => ({ trackPageView: trackMock }));

import { POST } from '@/app/api/collect/route';

function beacon(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://www.knowall.ai/api/collect', {
    method: 'POST',
    headers: {
      host: 'www.knowall.ai',
      origin: 'https://www.knowall.ai',
      'x-forwarded-for': '203.0.113.9:5000',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  trackMock.mockClear();
  resetRateLimits();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/collect', () => {
  it('tracks a clean path and external referrer, answering 204 with no cookie', async () => {
    const res = await POST(
      beacon({ path: '/purple-team?x=1', title: 'Purple Team', referrer: 'https://bing.com/?q=a' })
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(trackMock).toHaveBeenCalledWith(expect.any(Request), {
      path: '/purple-team',
      title: 'Purple Team',
      referrer: 'https://bing.com/',
    });
  });

  it('refuses beacons without one of the site hosts as their origin', async () => {
    await POST(beacon({ path: '/' }, { origin: 'https://evil.example' }));
    // curl with a browser user agent and no Origin or Referer
    const bare = new Request('http://www.knowall.ai/api/collect', {
      method: 'POST',
      headers: { host: 'www.knowall.ai', 'user-agent': 'Mozilla/5.0' },
      body: JSON.stringify({ path: '/' }),
    });
    await POST(bare);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('ignores bad paths and junk, and refuses oversized bodies', async () => {
    await POST(beacon({ path: 'https://evil.example/' }));
    await POST(beacon('not json'));
    const big = await POST(beacon({ path: '/', title: 'a'.repeat(3000) }));
    expect(big.status).toBe(413);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('limits each address, then answers 429', async () => {
    vi.stubEnv('COLLECT_LIMIT_PER_IP', '3');
    for (let i = 0; i < 3; i++) expect((await POST(beacon({ path: '/' }))).status).toBe(204);
    expect((await POST(beacon({ path: '/' }))).status).toBe(429);
    expect(trackMock).toHaveBeenCalledTimes(3);
    // Another address still gets through
    expect((await POST(beacon({ path: '/' }, { 'x-forwarded-for': '198.51.100.4' }))).status).toBe(
      204
    );
  });

  it('stops at the daily budget across all addresses', async () => {
    vi.stubEnv('COLLECT_BUDGET_PER_DAY', '2');
    await POST(beacon({ path: '/' }, { 'x-forwarded-for': '198.51.100.1' }));
    await POST(beacon({ path: '/' }, { 'x-forwarded-for': '198.51.100.2' }));
    expect((await POST(beacon({ path: '/' }, { 'x-forwarded-for': '198.51.100.3' }))).status).toBe(
      429
    );
    expect(trackMock).toHaveBeenCalledTimes(2);
  });
});
