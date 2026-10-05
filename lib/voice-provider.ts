import OpenAI, { AzureOpenAI } from 'openai';
import { azureBaseURL, clean, readAzureCredentials, type Env } from '@/lib/azure-openai';

/**
 * Resolves which backend Sallie's voice (/api/speak, /api/listen) talks to.
 *
 * Azure OpenAI is preferred, on its own resource (AZURE_OPENAI_VOICE_*) because
 * the voice models are not offered in the chat resource's region. Each Azure
 * deployment has a capped capacity, which bounds how fast voice can spend. The
 * direct OpenAI API remains the fallback when the Azure settings are absent.
 *
 * Azure deployments are named after their models (scripts/azure-openai-setup.sh),
 * so the same `model` string works for both providers. See docs/AZURE-OPENAI.adoc.
 */

export const VOICE_MODELS = {
  realtime: 'gpt-realtime',
  tts: 'gpt-4o-mini-tts',
  transcribe: 'gpt-4o-mini-transcribe',
} as const;

/**
 * Azure serves transcription only on the deployment-scoped URL, not the v1 path
 * (verified: v1 returns DeploymentNotFound), so it needs a dated api-version.
 */
export const AZURE_TRANSCRIBE_API_VERSION = '2025-04-01-preview';

export interface VoiceProvider {
  name: 'azure' | 'openai';
  apiKey: string;
  /** Azure resource root (no trailing slash); undefined for OpenAI. */
  endpoint?: string;
}

export function resolveVoiceProvider(env: Env = process.env): VoiceProvider | null {
  const azure = readAzureCredentials(
    env,
    'AZURE_OPENAI_VOICE_ENDPOINT',
    'AZURE_OPENAI_VOICE_API_KEY'
  );
  if (azure) return { name: 'azure', ...azure };

  const openaiKey = clean(env.OPENAI_API_KEY);
  if (openaiKey) return { name: 'openai', apiKey: openaiKey };

  return null;
}

/** How to open the realtime WebSocket for a provider. */
export interface RealtimeConnection {
  url: string;
  /** WebSocket subprotocols (OpenAI carries the key here). */
  protocols?: string[];
  /** Handshake headers (Azure takes the key as `api-key`; Node 22+ WebSocket supports this). */
  headers?: Record<string, string>;
}

export function realtimeConnection(provider: VoiceProvider): RealtimeConnection {
  const model = encodeURIComponent(VOICE_MODELS.realtime);
  if (provider.name === 'azure' && provider.endpoint) {
    const base = azureBaseURL(provider.endpoint).replace(/^https:/, 'wss:');
    return { url: `${base}realtime?model=${model}`, headers: { 'api-key': provider.apiKey } };
  }
  return {
    url: `wss://api.openai.com/v1/realtime?model=${model}`,
    protocols: ['realtime', `openai-insecure-api-key.${provider.apiKey}`],
  };
}

/** Client for text-to-speech (v1 API on both providers). */
export function speechClient(provider: VoiceProvider): OpenAI {
  return new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.endpoint ? azureBaseURL(provider.endpoint) : undefined,
  });
}

/** Client for transcription (deployment-scoped on Azure, see AZURE_TRANSCRIBE_API_VERSION). */
export function transcriptionClient(provider: VoiceProvider): OpenAI {
  if (provider.name === 'azure' && provider.endpoint) {
    // Explicit baseURL (what the SDK derives from `endpoint`) so a stray
    // OPENAI_BASE_URL env var can't override it; the SDK then inserts
    // /deployments/<deployment> per request.
    return new AzureOpenAI({
      baseURL: `${provider.endpoint}/openai`,
      apiKey: provider.apiKey,
      apiVersion: AZURE_TRANSCRIBE_API_VERSION,
      deployment: VOICE_MODELS.transcribe,
    });
  }
  return new OpenAI({ apiKey: provider.apiKey });
}
