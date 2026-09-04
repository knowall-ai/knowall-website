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

async function post(body: unknown) {
  const { POST } = await import('@/app/api/speak/route');
  return POST(
    new Request('http://localhost/api/speak', { method: 'POST', body: JSON.stringify(body) })
  );
}

describe('POST /api/speak', () => {
  beforeEach(() => {
    speechCreate.mockReset();
    speechCreate.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
