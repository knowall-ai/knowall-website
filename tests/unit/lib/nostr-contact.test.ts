import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contact routing
 *
 * Requirements: contact-us
 * - Guests (not signed in with Nostr) are emailed via /api/contact — no
 *   throwaway Nostr keys
 * - Signed-in visitors DM the KnowAll AI npub from their own key, and an email
 *   copy goes to hello@ in case nobody is watching the DMs
 * - A failed email copy doesn't fail a delivered DM
 */

const KNOWALL_HEX = 'b733ecad265d8df63e15e28d24972141a5ebc21bfdf1532adad2e6701e853892';
const VISITOR_HEX = 'a'.repeat(64);

const wrapRumor = vi.fn();
const supportsGiftWrap = vi.fn();
const publish = vi.fn();

vi.mock('@/lib/nip17', () => ({
  wrapRumor: (...args: unknown[]) => wrapRumor(...args),
  nip07SupportsGiftWrap: () => supportsGiftWrap(),
}));
vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    publish = (...args: unknown[]) => publish(...args);
    close() {}
  },
}));

const fetchMock = vi.fn();
const msg = { name: 'Ada', email: 'ada@example.com', message: 'Hello there, KnowAll team.' };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  wrapRumor
    .mockReset()
    .mockResolvedValue({ id: 'x', sig: 'sig', kind: 1059, tags: [], content: '' });
  publish.mockReset().mockReturnValue([Promise.resolve('ok')]);
  supportsGiftWrap.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const emailBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('sendContactMessage', () => {
  it('emails guests through /api/contact and never touches Nostr', async () => {
    const { sendContactMessage } = await import('@/lib/nostr-contact');
    await expect(sendContactMessage(msg)).resolves.toBe('email');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/contact');
    expect(emailBody()).toEqual(msg);
    expect(wrapRumor).not.toHaveBeenCalled();
  });

  it('DMs the KnowAll npub as a signed-in visitor, then emails a copy', async () => {
    supportsGiftWrap.mockReturnValue(true);
    const { sendContactMessage } = await import('@/lib/nostr-contact');
    await expect(sendContactMessage(msg, { nostrPubkey: VISITOR_HEX })).resolves.toBe('nostr');

    const [template, sender, recipient] = wrapRumor.mock.calls[0];
    expect(template.kind).toBe(14);
    expect(template.content).toContain('Email: ada@example.com');
    expect(sender).toEqual({ pubkey: VISITOR_HEX, kind: 'nip07' });
    expect(recipient).toBe(KNOWALL_HEX);
    expect(publish).toHaveBeenCalled();
    expect(emailBody().nostrNpub).toMatch(/^npub1/);
  });

  it('keeps a delivered DM a success when the email copy fails', async () => {
    supportsGiftWrap.mockReturnValue(true);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendContactMessage } = await import('@/lib/nostr-contact');
    await expect(sendContactMessage(msg, { nostrPubkey: VISITOR_HEX })).resolves.toBe('nostr');
  });

  it('falls back to email when the extension cannot encrypt DMs', async () => {
    supportsGiftWrap.mockReturnValue(false);
    const { sendContactMessage } = await import('@/lib/nostr-contact');
    await expect(sendContactMessage(msg, { nostrPubkey: VISITOR_HEX })).resolves.toBe('email');
    expect(wrapRumor).not.toHaveBeenCalled();
  });

  it("shows the route's error to the visitor when email fails", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Please email hello@knowall.ai.' }), { status: 503 })
    );
    const { sendContactMessage } = await import('@/lib/nostr-contact');
    await expect(sendContactMessage(msg)).rejects.toThrow('Please email hello@knowall.ai.');
  });
});
