import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { clientIp, consume, isSameOrigin } from '@/lib/rate-limit';

/**
 * Sallie's ears, for browsers whose own speech recognition is missing or
 * broken. Takes a short audio clip and returns the transcript. Public like
 * /api/chat; nothing is stored and the audio is not kept.
 */

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // ~30s of Opus at 96 kbps, with headroom

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Listening is only available on the site' }, { status: 403 });
  }
  const limit = consume('listen', clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: limit.reason === 'day' ? 'Listening is resting for today' : 'Too many requests' },
      {
        status: limit.reason === 'day' ? 503 : 429,
        headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Listening is not configured' }, { status: 503 });
  }

  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const entry = form.get('audio');
    // Duck-type rather than instanceof: the runtime's File class can differ from the global one.
    if (entry && typeof entry === 'object' && 'arrayBuffer' in entry && 'size' in entry) {
      file = entry as Blob;
    }
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No audio received' }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Clip too long' }, { status: 413 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: new File([file], 'clip.webm', { type: file.type || 'audio/webm' }),
      language: 'en',
    });
    return NextResponse.json({ text: result.text.trim() });
  } catch (error) {
    console.error('Error in listen API:', error);
    return NextResponse.json({ error: 'Listening is unavailable right now' }, { status: 502 });
  }
}
