// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  eventEnvelope,
  parseConnectionString,
  sendEnvelopes,
  truncateIp,
} from '@/lib/analytics/app-insights';
import {
  cleanPath,
  cleanReferrer,
  dailySalt,
  isBot,
  optedOut,
  truncate,
  visitorId,
} from '@/lib/analytics/privacy';
import { CHAT_EVENT, MAX_REPLY, trackChatTurn, trackPageView } from '@/lib/analytics/track';

/**
 * Website analytics (cookieless page views and Sallie chat events in App Insights)
 *
 * Requirements: site-analytics
 * - No IP address is ever sent to App Insights or stored on an event
 * - Visitors are anonymous, daily-rotating hashes; nothing is stored on the device
 * - Do Not Track and Global Privacy Control are respected
 */

const CFG = { iKey: '1111-2222', endpoint: 'https://uksouth-1.in.applicationinsights.azure.com/' };
const IP = '203.0.113.77';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36';

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: {
      'x-forwarded-for': `10.0.0.1, ${IP}:51234`,
      'user-agent': UA,
      host: 'www.knowall.ai',
      ...headers,
    },
  });
}

function capture() {
  const bodies: unknown[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  return { bodies, fetchImpl };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('parseConnectionString', () => {
  it('reads the key and ingestion endpoint', () => {
    expect(
      parseConnectionString(
        'InstrumentationKey=abc;IngestionEndpoint=https://uksouth-1.in.applicationinsights.azure.com;ApplicationId=x'
      )
    ).toEqual({ iKey: 'abc', endpoint: 'https://uksouth-1.in.applicationinsights.azure.com/' });
  });
  it('is null without a key', () => {
    expect(parseConnectionString('')).toBeNull();
    expect(parseConnectionString('IngestionEndpoint=https://x/')).toBeNull();
  });
});

describe('truncateIp', () => {
  it('keeps only the network', () => {
    expect(truncateIp('203.0.113.77')).toBe('203.0.113.0');
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    expect(truncateIp('2001:db8::1')).toBe('2001:db8:0::');
    expect(truncateIp('unknown')).toBeNull();
    expect(truncateIp('999.1.1.1')).toBeNull();
  });
});

describe('privacy helpers', () => {
  it('hashes a visitor to the same id within a day and a different one the next', () => {
    vi.stubEnv('ANALYTICS_SALT', 'test-salt');
    const day1 = new Date('2026-10-24T09:00:00Z');
    const later = new Date('2026-10-24T22:00:00Z');
    const day2 = new Date('2026-10-25T09:00:00Z');
    const id = visitorId(IP, UA, day1);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorId(IP, UA, later)).toBe(id);
    expect(visitorId(IP, UA, day2)).not.toBe(id);
    expect(visitorId('198.51.100.1', UA, day1)).not.toBe(id);
  });

  it('derives the day salt from ANALYTICS_SALT and the date', () => {
    vi.stubEnv('ANALYTICS_SALT', 'salt-a');
    const a = dailySalt(new Date('2026-10-24T01:00:00Z'));
    expect(dailySalt(new Date('2026-10-24T23:00:00Z')).equals(a)).toBe(true);
    expect(dailySalt(new Date('2026-10-25T01:00:00Z')).equals(a)).toBe(false);
    vi.stubEnv('ANALYTICS_SALT', 'salt-b');
    expect(dailySalt(new Date('2026-10-24T01:00:00Z')).equals(a)).toBe(false);
  });

  it('respects DNT and GPC', () => {
    expect(optedOut(new Headers({ dnt: '1' }))).toBe(true);
    expect(optedOut(new Headers({ 'sec-gpc': '1' }))).toBe(true);
    expect(optedOut(new Headers({}))).toBe(false);
  });

  it('spots bots and scripts', () => {
    expect(isBot('Googlebot/2.1')).toBe(true);
    expect(isBot('curl/8.0')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(UA)).toBe(false);
  });

  it('cleans paths and referrers', () => {
    expect(cleanPath('/purple-team?utm=x#y')).toBe('/purple-team');
    expect(cleanPath('//evil.example')).toBeNull();
    expect(cleanPath('https://x')).toBeNull();
    expect(cleanPath('/<script>')).toBeNull();
    expect(cleanReferrer('https://www.linkedin.com/feed/?trk=abc', 'www.knowall.ai')).toBe(
      'https://www.linkedin.com/feed/'
    );
    expect(cleanReferrer('https://knowall.ai/shop', 'www.knowall.ai')).toBe('');
    expect(cleanReferrer('javascript:alert(1)', 'www.knowall.ai')).toBe('');
    expect(truncate('abcdef', 4)).toBe('abc…');
    // Code points, not UTF-16 units: an emoji is never cut in half
    expect(truncate('ab😀😀😀', 4)).toBe('ab😀…');
    expect(truncate('😀😀', 2)).toBe('😀😀');
  });
});

describe('trackPageView', () => {
  it('sends a page view with an anonymous id and only the truncated network', async () => {
    const { bodies, fetchImpl } = capture();
    const ok = await trackPageView(
      request(),
      { path: '/purple-team', title: 'Purple Team', referrer: 'https://www.google.com/' },
      { cfg: CFG, fetchImpl, now: new Date('2026-10-24T10:00:00Z') }
    );
    expect(ok).toBe(true);
    const [envelope] = bodies[0] as Array<Record<string, any>>;
    expect(envelope.name).toBe('Microsoft.ApplicationInsights.11112222.Pageview');
    expect(envelope.data.baseData).toMatchObject({
      name: 'Purple Team',
      url: 'https://www.knowall.ai/purple-team',
      properties: { path: '/purple-team', referrerHost: 'google.com' },
    });
    expect(envelope.tags['ai.location.ip']).toBe('203.0.113.0');
    expect(envelope.tags['ai.user.id']).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(bodies)).not.toContain(IP);
  });

  it('sends nothing when the visitor opted out, for bots, or without config', async () => {
    const { fetchImpl } = capture();
    const view = { path: '/', title: 'Home', referrer: '' };
    expect(await trackPageView(request({ dnt: '1' }), view, { cfg: CFG, fetchImpl })).toBe(false);
    expect(await trackPageView(request({ 'sec-gpc': '1' }), view, { cfg: CFG, fetchImpl })).toBe(
      false
    );
    expect(
      await trackPageView(request({ 'user-agent': 'AhrefsBot' }), view, { cfg: CFG, fetchImpl })
    ).toBe(false);
    expect(await trackPageView(request(), view, { cfg: null, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('trackChatTurn', () => {
  it('emits a SallieChatTurn event with the conversation and no IP address', async () => {
    const { bodies, fetchImpl } = capture();
    await trackChatTurn(
      request(),
      {
        conversationId: 'conv-1',
        userMessage: 'How fast can you patch?',
        reply: 'x'.repeat(MAX_REPLY + 50),
        greetingId: 'pt-speed',
        context: 'purple-team',
        page: '/purple-team',
        turn: 1,
      },
      { cfg: CFG, fetchImpl }
    );
    const [envelope] = bodies[0] as Array<Record<string, any>>;
    expect(envelope.data.baseData.name).toBe(CHAT_EVENT);
    const props = envelope.data.baseData.properties;
    expect(props).toMatchObject({
      conversationId: 'conv-1',
      userMessage: 'How fast can you patch?',
      greetingId: 'pt-speed',
      context: 'purple-team',
      page: '/purple-team',
      turn: '1',
      outcome: 'ok',
    });
    expect(props.reply).toHaveLength(MAX_REPLY);
    expect(JSON.stringify(bodies)).not.toContain(IP);
    expect(JSON.stringify(props)).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  });

  it('drops the visitor id and location when the visitor opted out', async () => {
    const { bodies, fetchImpl } = capture();
    await trackChatTurn(
      request({ 'sec-gpc': '1' }),
      { conversationId: 'c', userMessage: 'hi', reply: 'hello' },
      { cfg: CFG, fetchImpl }
    );
    const [envelope] = bodies[0] as Array<Record<string, any>>;
    expect(envelope.tags['ai.user.id']).toBe('anonymous');
    expect(envelope.tags['ai.location.ip']).toBe('0.0.0.0');
  });
});

describe('sendEnvelopes', () => {
  it('never throws when ingestion fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const env = eventEnvelope(CFG, {
      time: new Date(),
      visitorId: 'v',
      eventName: 'x',
      properties: {},
    });
    await expect(sendEnvelopes(CFG, [env], { fetchImpl })).resolves.toBe(false);
  });
});
