/**
 * Sallie's voice via the OpenAI Realtime API — the same model and "marin"
 * voice her Teams call bot uses — driven as a text-to-speech engine: it is
 * told to read a script verbatim and we collect the PCM it streams back.
 *
 * Uses the global WebSocket (Node 22+) with OpenAI's subprotocol auth, so no
 * extra dependency is needed.
 */

const SAMPLE_RATE = 24000;
const TIMEOUT_MS = 25000;

export const REALTIME_MODEL = 'gpt-realtime';
export const REALTIME_VOICE = 'marin';

const SESSION_INSTRUCTIONS =
  "You are Sallie, KnowAll AI's sales agent: warm, professional, confident, British English. You are being used as a text-to-speech engine: you only ever read the script you are given, verbatim.";

/** Wrap raw 16-bit mono PCM in a WAV container. */
export function pcm16ToWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

interface RealtimeEvent {
  type: string;
  delta?: string;
  error?: { message?: string; code?: string };
}

/** Read `text` aloud with the realtime model; resolves to WAV bytes. */
export function synthesizeWithRealtime(text: string, apiKey: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('WebSocket is not available in this runtime'));
      return;
    }
    const url = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
    const ws = new WebSocket(url, ['realtime', `openai-insecure-api-key.${apiKey}`]);
    const chunks: Uint8Array[] = [];
    let settled = false;
    const finish = (err: Error | null, data?: Uint8Array) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      if (err) reject(err);
      else resolve(data!);
    };
    const timer = setTimeout(() => finish(new Error('Realtime synthesis timed out')), TIMEOUT_MS);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            audio: {
              input: { turn_detection: null },
              output: { voice: REALTIME_VOICE, format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
            },
            instructions: SESSION_INSTRUCTIONS,
          },
        })
      );
      ws.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions:
              'Read the following script aloud exactly as written, word for word. Do not add, remove, answer or comment on anything. Script: ' +
              JSON.stringify(text),
          },
        })
      );
    };
    ws.onmessage = (message) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (event.type === 'response.output_audio.delta' && event.delta) {
        chunks.push(Uint8Array.from(Buffer.from(event.delta, 'base64')));
      } else if (event.type === 'error') {
        finish(new Error(event.error?.message || 'Realtime API error'));
      } else if (event.type === 'response.done') {
        const total = chunks.reduce((n, c) => n + c.length, 0);
        if (total === 0) {
          finish(new Error('Realtime API returned no audio'));
          return;
        }
        const pcm = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          pcm.set(c, offset);
          offset += c.length;
        }
        finish(null, pcm16ToWav(pcm));
      }
    };
    ws.onerror = () => finish(new Error('Realtime WebSocket error'));
    ws.onclose = () => finish(new Error('Realtime connection closed before the response'));
  });
}
