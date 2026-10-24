// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Page-view beacon route
 *
 * Requirements: site-analytics
 * - /api/collect always answers 204 and never stores anything on the device
 * - Only clean same-site paths are counted; DNT/GPC visitors are not counted
 */

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/analytics/track', () => ({ trackPageView: trackMock }));

import { POST } from '@/app/api/collect/route';

function beacon(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: { host: 'www.knowall.ai', 'sec-fetch-site': 'same-origin', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => trackMock.mockClear());
afterEach(() => vi.restoreAllMocks());

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

  it('ignores cross-site posts, bad paths and junk bodies', async () => {
    await POST(beacon({ path: '/' }, { 'sec-fetch-site': 'cross-site' }));
    await POST(beacon({ path: 'https://evil.example/' }));
    await POST(beacon('not json'));
    await POST(beacon({ path: '/' + 'a'.repeat(3000) }));
    expect(trackMock).not.toHaveBeenCalled();
  });
});
