import { NextResponse } from 'next/server';
import { clientIp, consume, isSameOrigin } from '@/lib/rate-limit';
import { resolveVoiceProvider, transcriptionClient, VOICE_MODELS } from '@/lib/voice-provider';

/**
 * Sallie's ears, for browsers whose own speech recognition is missing or
 * broken. Takes a short audio clip and returns the transcript. Public like
 * /api/chat; nothing is stored and the audio is not kept. Runs on Azure OpenAI
 * when AZURE_OPENAI_VOICE_* is set, otherwise OpenAI (lib/voice-provider.ts).
 */

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // ~30s of Opus at 96 kbps, with headroom

/**
 * The transcription service identifies the format from the file name, so it must
 * match what the browser recorded: WebM/Opus on Chrome and Firefox, MP4/AAC on
 * Safari. Naming an MP4 ".webm" gets it rejected as corrupted.
 */
export function clipFileName(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'clip.m4a';
  if (type.includes('ogg')) return 'clip.ogg';
  if (type.includes('mpeg') || type.includes('mp3')) return 'clip.mp3';
  if (type.includes('wav')) return 'clip.wav';
  return 'clip.webm';
}

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

  const provider = resolveVoiceProvider();
  if (!provider) {
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
    const result = await transcriptionClient(provider).audio.transcriptions.create({
      model: VOICE_MODELS.transcribe,
      file: new File([file], clipFileName(file.type || 'audio/webm'), {
        type: file.type || 'audio/webm',
      }),
      language: 'en',
    });
    return NextResponse.json({ text: result.text.trim() });
  } catch (error) {
    console.error(`Error in listen API (${provider.name}):`, error);
    return NextResponse.json({ error: 'Listening is unavailable right now' }, { status: 502 });
  }
}
