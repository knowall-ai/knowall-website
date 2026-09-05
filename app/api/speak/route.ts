import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Sallie's voice. Turns a short piece of her reply into speech so the
 * avatar can talk. Public like /api/chat, and just as deliberately
 * disconnected from anything internal: text in, audio out, nothing stored.
 */

export const MAX_SPEAK_CHARS = 700;

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

  try {
    const openai = new OpenAI({ apiKey });
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: text,
      response_format: 'mp3',
      // Mirrors her call persona (sallie-openclaw voice_persona.md): warm,
      // professional, confident, British English — and the same "marin" voice.
      instructions:
        "You are Sallie, KnowAll AI's sales agent. Warm, professional and confident, in British English. Speak naturally at a relaxed conversational pace, as if talking to a visitor who has just arrived.",
    });
    const audio = await speech.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error in speak API:', error);
    return NextResponse.json({ error: 'Voice is unavailable right now' }, { status: 502 });
  }
}
