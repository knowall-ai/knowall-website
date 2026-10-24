import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/contact/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { resetMailTokenCache } from '@/lib/graph-mail';

/**
 * Contact route
 *
 * Requirements: contact-us
 * - Guest enquiries are emailed to hello@knowall.ai from Sallie's mailbox,
 *   with Reply-To set to the visitor
 * - Signed-in visitors' DMs get an email copy that names their npub
 * - Only this site can post; each visitor is rate limited; bots filling the
 *   honeypot are dropped quietly; a missing mail setup fails loudly
 */

const SITE = { host: 'localhost', origin: 'http://localhost' };
const NPUB = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'We would like a Purple Team scoping call.',
  topic: 'Purple Team',
};

const post = (body: unknown, headers: Record<string, string> = SITE) =>
  POST(
    new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        referer: 'http://localhost/purple-team',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );

const fetchMock = vi.fn();

beforeEach(() => {
  resetRateLimits();
  resetMailTokenCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes('login.microsoftonline.com')
      ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
      : new Response(null, { status: 202 })
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CONTACT_MAIL_TENANT_ID', 'tenant');
  vi.stubEnv('CONTACT_MAIL_CLIENT_ID', 'client');
  vi.stubEnv('CONTACT_MAIL_CLIENT_SECRET', 'secret');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const sentMessage = () => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/sendMail'));
  expect(call).toBeDefined();
  return { url: String(call![0]), body: JSON.parse(call![1].body).message };
};

describe('POST /api/contact', () => {
  it('emails hello@ from Sallie with Reply-To set to the visitor', async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);

    const { url, body } = sentMessage();
    expect(url).toContain('/users/sallie%40knowall.ai/sendMail');
    expect(body.toRecipients[0].emailAddress.address).toBe('hello@knowall.ai');
    expect(body.replyTo[0].emailAddress).toEqual({
      name: 'Ada Lovelace',
      address: 'ada@example.com',
    });
    expect(body.subject).toBe('Website enquiry (Purple Team) from Ada Lovelace');
    expect(body.body.content).toContain('Email: ada@example.com');
    expect(body.body.content).toContain('Page: http://localhost/purple-team');
    expect(body.body.content).toContain('We would like a Purple Team scoping call.');
  });

  it('marks the email as a copy of a Nostr DM when an npub is given', async () => {
    await post({ ...valid, nostrNpub: NPUB });
    const { body } = sentMessage();
    expect(body.body.content).toContain(`Nostr: ${NPUB}`);
    expect(body.body.content).toContain('also sent as a private DM');
  });

  it('rejects posts from other sites', async () => {
    const res = await post(valid, { host: 'localhost', origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    const res = await post({ ...valid, email: 'nope' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('quietly drops bots that fill the honeypot', async () => {
    const res = await post({ ...valid, website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails with a hello@ fallback when mail is not configured', async () => {
    vi.stubEnv('CONTACT_MAIL_CLIENT_SECRET', '');
    const res = await post(valid);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('hello@knowall.ai');
  });

  it('reports a Graph failure', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('login.microsoftonline.com')
        ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
        : new Response(null, { status: 403 })
    );
    const res = await post(valid);
    expect(res.status).toBe(502);
  });

  it('rate limits a visitor after five messages', async () => {
    for (let i = 0; i < 5; i++) expect((await post(valid)).status).toBe(200);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
