import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { synthesizeWithRealtime } from './realtime';

/**
 * Sallie's voice. Turns a short piece of her reply into speech so the
 * avatar can talk. Public like /api/chat, and just as deliberately
 * disconnected from anything internal: text in, audio out, nothing stored
 * beyond a small in-memory cache of recent clips.
 *
 * Engine: the Realtime model with the "marin" voice — exactly what her Teams
 * call bot uses — falling back to gpt-4o-mini-tts (also marin) if that fails.
 * `SALLIE_VOICE_ENGINE=tts` forces the fallback.
 */

export const MAX_SPEAK_CHARS = 700;
const CACHE_MAX = 40;

type Engine = 'realtime' | 'tts';
interface Clip {
  bytes: Uint8Array;
  type: string;
  engine: Engine;
}

// Same text → same clip, so the greeting sounds identical on every visit.
const cache = new Map<string, Clip>();

/** For tests. */
export function clearVoiceCache() {
  cache.clear();
}

/** Strip markdown so links and emphasis aren't read out as symbols. */
export function toSpeakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEAK_CHARS);
}

function preferredEngine(): Engine {
  return process.env.SALLIE_VOICE_ENGINE === 'tts' ? 'tts' : 'realtime';
}

async function synthesizeWithTts(text: string, apiKey: string): Promise<Uint8Array> {
  const openai = new OpenAI({ apiKey });
  const speech = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'marin',
    input: text,
    response_format: 'mp3',
  });
  return new Uint8Array(await speech.arrayBuffer());
}

async function synthesize(text: string, apiKey: string): Promise<Clip> {
  if (preferredEngine() === 'realtime') {
    try {
      const bytes = await synthesizeWithRealtime(text, apiKey);
      return { bytes, type: 'audio/wav', engine: 'realtime' };
    } catch (error) {
      console.warn('Realtime voice failed, falling back to TTS:', error);
    }
  }
  const bytes = await synthesizeWithTts(text, apiKey);
  return { bytes, type: 'audio/mpeg', engine: 'tts' };
}

function remember(key: string, clip: Clip) {
  cache.set(key, clip);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function POST(req: Request) {
  let text = '';
  try {
    const body = await req.json();
    text = toSpeakable(typeof body?.text === 'string' ? body.text : '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: 'Nothing to say' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Voice is not configured' }, { status: 503 });
  }

  const key = `${preferredEngine()}:${text}`;
  let clip = cache.get(key);
  if (!clip) {
    try {
      clip = await synthesize(text, apiKey);
      remember(key, clip);
    } catch (error) {
      console.error('Error in speak API:', error);
      return NextResponse.json({ error: 'Voice is unavailable right now' }, { status: 502 });
    }
  }

  return new NextResponse(clip.bytes.slice().buffer, {
    status: 200,
    headers: {
      'Content-Type': clip.type,
      'Cache-Control': 'no-store',
      'X-Sallie-Voice': clip.engine,
    },
  });
}
