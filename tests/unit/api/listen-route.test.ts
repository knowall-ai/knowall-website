// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /api/listen tests
 *
 * Requirements: sallie-chat
 * - Transcribes a short audio clip so the mic works in every browser
 * - Refuses empty or oversized clips and reports when not configured
 */

const transcriptionsCreate = vi.fn();

vi.mock('openai', () => ({
  default: class {
    audio = { transcriptions: { create: transcriptionsCreate } };
  },
}));

const SITE = { host: 'localhost', origin: 'http://localhost' };

async function post(form: FormData | null, headers: Record<string, string> = SITE) {
  const { POST } = await import('@/app/api/listen/route');
  const init: RequestInit = form
    ? { method: 'POST', body: form, headers }
    : { method: 'POST', headers };
  return POST(new Request('http://localhost/api/listen', init));
}

function clip(bytes: number) {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array(bytes)], 'clip.webm', { type: 'audio/webm' }));
  return form;
}

describe('POST /api/listen', () => {
  beforeEach(async () => {
    transcriptionsCreate.mockReset();
    transcriptionsCreate.mockResolvedValue({ text: '  What does KnowAll do?  ' });
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const { resetRateLimits } = await import('@/lib/rate-limit');
    resetRateLimits();
  });

  it('refuses requests that do not come from the site', async () => {
    const res = await post(clip(100), { host: 'localhost' });
    expect(res.status).toBe(403);
    expect(transcriptionsCreate).not.toHaveBeenCalled();
  });

  it('pauses for the day once the daily budget is spent', async () => {
    vi.stubEnv('SALLIE_BUDGET_LISTEN_PER_DAY', '1');
    expect((await post(clip(100))).status).toBe(200);
    const res = await post(clip(100));
    expect(res.status).toBe(503);
    expect(transcriptionsCreate).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when no API key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const res = await post(clip(100));
    expect(res.status).toBe(503);
    expect(transcriptionsCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when no audio is sent', async () => {
    const res = await post(new FormData());
    expect(res.status).toBe(400);
  });

  it('returns 413 for an oversized clip', async () => {
    const { MAX_AUDIO_BYTES } = await import('@/app/api/listen/route');
    const res = await post(clip(MAX_AUDIO_BYTES + 1));
    expect(res.status).toBe(413);
    expect(transcriptionsCreate).not.toHaveBeenCalled();
  });

  it('returns the trimmed transcript', async () => {
    const res = await post(clip(100));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'What does KnowAll do?' });
    expect(transcriptionsCreate.mock.calls[0][0].model).toBe('gpt-4o-mini-transcribe');
  });

  it('returns 502 when transcription fails', async () => {
    transcriptionsCreate.mockRejectedValue(new Error('boom'));
    const res = await post(clip(100));
    expect(res.status).toBe(502);
  });
});
