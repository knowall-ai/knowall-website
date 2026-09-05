// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pcm16ToWav, synthesizeWithRealtime } from '@/app/api/speak/realtime';

/**
 * Realtime voice helper tests
 *
 * Requirements: sallie-chat
 * - Streams PCM from the realtime model and returns a playable WAV
 * - Fails cleanly on API errors so the route can fall back
 */

class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[]
  ) {
    FakeSocket.last = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe('synthesizeWithRealtime', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for marin, reads the script verbatim and returns a WAV of the streamed PCM', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const promise = synthesizeWithRealtime('Hello there', 'sk-test');
    await new Promise((r) => setTimeout(r, 5));
    const ws = FakeSocket.last;
    expect(ws.protocols).toContain('openai-insecure-api-key.sk-test');
    const session = JSON.parse(ws.sent[0]);
    expect(session.session.audio.output.voice).toBe('marin');
    const response = JSON.parse(ws.sent[1]);
    expect(response.response.instructions).toContain('"Hello there"');

    const pcm = Buffer.from([1, 0, 2, 0]);
    ws.emit({ type: 'response.output_audio.delta', delta: pcm.toString('base64') });
    ws.emit({ type: 'response.done' });
    const wav = await promise;
    expect(wav.length).toBe(44 + 4);
    expect(Buffer.from(wav.subarray(0, 4)).toString()).toBe('RIFF');
    expect(Buffer.from(wav.subarray(44)).equals(pcm)).toBe(true);
  });

  it('rejects on an API error event', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const promise = synthesizeWithRealtime('Hello', 'sk-test');
    await new Promise((r) => setTimeout(r, 5));
    FakeSocket.last.emit({ type: 'error', error: { message: 'nope' } });
    await expect(promise).rejects.toThrow('nope');
  });

  it('rejects when no audio comes back', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const promise = synthesizeWithRealtime('Hello', 'sk-test');
    await new Promise((r) => setTimeout(r, 5));
    FakeSocket.last.emit({ type: 'response.done' });
    await expect(promise).rejects.toThrow('no audio');
  });

  it('writes a valid 24 kHz mono 16-bit WAV header', () => {
    const wav = pcm16ToWav(new Uint8Array(8));
    const v = new DataView(wav.buffer);
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
  });
});
