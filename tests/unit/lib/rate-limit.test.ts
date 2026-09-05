import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clientIp, consume, isSameOrigin, resetRateLimits, trackedKeys } from '@/lib/rate-limit';

/**
 * Rate-limit tests
 *
 * Requirements: sallie-chat (cost guards)
 * - Per-IP sliding window per route
 * - Per-route daily budget
 * - Same-origin check for the voice routes
 */

describe('rate limits', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv('SALLIE_LIMIT_CHAT_PER_IP', '3');
    vi.stubEnv('SALLIE_LIMIT_WINDOW_MINUTES', '10');
    vi.stubEnv('SALLIE_BUDGET_SPEAK_PER_DAY', '2');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('allows up to the per-IP limit, then refuses until the window slides', () => {
    const t0 = Date.parse('2026-09-05T10:00:00Z');
    expect(consume('chat', '1.1.1.1', t0).ok).toBe(true);
    expect(consume('chat', '1.1.1.1', t0 + 1000).ok).toBe(true);
    expect(consume('chat', '1.1.1.1', t0 + 2000).ok).toBe(true);
    const refused = consume('chat', '1.1.1.1', t0 + 3000);
    expect(refused).toMatchObject({ ok: false, reason: 'ip' });
    expect(refused.retryAfter).toBeGreaterThan(0);
    // Other visitors are unaffected
    expect(consume('chat', '2.2.2.2', t0 + 3000).ok).toBe(true);
    // Ten minutes later the first hit has aged out
    expect(consume('chat', '1.1.1.1', t0 + 10 * 60 * 1000 + 1).ok).toBe(true);
  });

  it('enforces the per-route daily budget across visitors and resets at midnight UTC', () => {
    const t0 = Date.parse('2026-09-05T23:59:00Z');
    expect(consume('speak', 'a', t0).ok).toBe(true);
    expect(consume('speak', 'b', t0).ok).toBe(true);
    expect(consume('speak', 'c', t0)).toMatchObject({ ok: false, reason: 'day' });
    // Chat has its own budget
    expect(consume('chat', 'c', t0).ok).toBe(true);
    expect(consume('speak', 'c', Date.parse('2026-09-06T00:00:01Z')).ok).toBe(true);
  });

  it('keeps the tracked-key map bounded under a flood of distinct IPs', () => {
    vi.stubEnv('SALLIE_BUDGET_CHAT_PER_DAY', '100000');
    const t0 = Date.parse('2026-09-05T10:00:00Z');
    for (let i = 0; i < 5200; i++)
      consume('chat', `10.0.${Math.floor(i / 256)}.${i % 256}`, t0 + i);
    // Still answers, and the earliest keys have been evicted rather than the map growing forever.
    expect(consume('chat', '10.0.0.0', t0 + 6000).ok).toBe(true);
    expect(trackedKeys()).toBeLessThanOrEqual(5001);
  });

  it('reads the client IP from x-forwarded-for', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } });
    expect(clientIp(req)).toBe('9.9.9.9');
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });

  it('accepts same-origin requests and rejects others', () => {
    const ok = new Request('http://x', {
      headers: { host: 'www.knowall.ai', origin: 'https://www.knowall.ai' },
    });
    const viaReferer = new Request('http://x', {
      headers: { host: 'www.knowall.ai', referer: 'https://www.knowall.ai/shop' },
    });
    const foreign = new Request('http://x', {
      headers: { host: 'www.knowall.ai', origin: 'https://evil.example' },
    });
    const spoofed = new Request('http://x', {
      headers: {
        host: 'www.knowall.ai',
        'x-forwarded-host': 'evil.example',
        origin: 'https://evil.example',
      },
    });
    expect(isSameOrigin(ok)).toBe(true);
    expect(isSameOrigin(viaReferer)).toBe(true);
    expect(isSameOrigin(foreign)).toBe(false);
    expect(isSameOrigin(spoofed)).toBe(false);
    expect(isSameOrigin(new Request('http://x', { headers: { host: 'www.knowall.ai' } }))).toBe(
      false
    );
  });
});
