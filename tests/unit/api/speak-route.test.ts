import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /api/speak tests
 *
 * Requirements: sallie-chat
 * - Turns Sallie's reply text into speech via OpenAI
 * - Refuses empty input and reports when voice is not configured
 * - Never sends markdown syntax or over-long text to the voice model
 */

const speechCreate = vi.fn();

vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: speechCreate } };
  },
}));

const SITE = { host: 'localhost', origin: 'http://localhost' };

async function post(body: unknown, headers: Record<string, string> = SITE) {
  const { POST } = await import('@/app/api/speak/route');
  return POST(
    new Request('http://localhost/api/speak', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/speak', () => {
  beforeEach(async () => {
    speechCreate.mockReset();
    speechCreate.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    // Deterministic engine for these tests; the realtime path is covered below.
    vi.stubEnv('SALLIE_VOICE_ENGINE', 'tts');
    const { clearVoiceCache } = await import('@/app/api/speak/route');
    clearVoiceCache();
    const { resetRateLimits } = await import('@/lib/rate-limit');
    resetRateLimits();
  });

  it('refuses requests that do not come from the site', async () => {
    const res = await post({ text: 'Hello' }, { host: 'localhost' });
    expect(res.status).toBe(403);
    const foreign = await post(
      { text: 'Hello' },
      { host: 'localhost', origin: 'https://evil.example' }
    );
    expect(foreign.status).toBe(403);
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it('rate-limits a single visitor', async () => {
    vi.stubEnv('SALLIE_LIMIT_SPEAK_PER_IP', '2');
    expect((await post({ text: 'one' })).status).toBe(200);
    expect((await post({ text: 'two' })).status).toBe(200);
    const third = await post({ text: 'three' });
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('serves the same clip from cache for repeated text', async () => {
    const first = await post({ text: 'Hello again' });
    const second = await post({ text: 'Hello again' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(speechCreate).toHaveBeenCalledTimes(1);
    expect(second.headers.get('x-sallie-voice')).toBe('tts');
  });

  it('prefers the realtime engine and falls back to TTS when it fails', async () => {
    vi.stubEnv('SALLIE_VOICE_ENGINE', 'realtime');
    // A WebSocket that errors as soon as it is used.
    class FailingSocket {
      onerror: ((e: unknown) => void) | null = null;
      onopen: (() => void) | null = null;
      onmessage: ((e: unknown) => void) | null = null;
      onclose: (() => void) | null = null;
      constructor() {
        setTimeout(() => this.onerror?.(new Error('down')), 0);
      }
      send() {}
      close() {}
    }
    vi.stubGlobal('WebSocket', FailingSocket);
    const res = await post({ text: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-sallie-voice')).toBe('tts');
    expect(speechCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for empty text', async () => {
    const res = await post({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 503 when no API key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const res = await post({ text: 'Hello' });
    expect(res.status).toBe(503);
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it('returns audio and strips markdown before speaking', async () => {
    const res = await post({ text: 'See **[our services](https://knowall.ai/#services)** today!' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(speechCreate).toHaveBeenCalledTimes(1);
    expect(speechCreate.mock.calls[0][0].input).toBe('See our services today!');
  });

  it('caps very long text', async () => {
    const { MAX_SPEAK_CHARS } = await import('@/app/api/speak/route');
    await post({ text: 'a'.repeat(MAX_SPEAK_CHARS + 500) });
    expect(speechCreate.mock.calls[0][0].input).toHaveLength(MAX_SPEAK_CHARS);
  });

  it('returns 502 when the voice model fails', async () => {
    speechCreate.mockRejectedValue(new Error('boom'));
    const res = await post({ text: 'Hello' });
    expect(res.status).toBe(502);
  });
});
