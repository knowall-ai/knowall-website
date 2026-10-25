import OpenAI, { AzureOpenAI } from 'openai';
import { azureBaseURL, readAzureCredentials, type Env } from '@/lib/azure-openai';

/**
 * Resolves which backend Sallie's voice (/api/speak, /api/listen) talks to.
 *
 * Azure OpenAI only, on its own resource (AZURE_OPENAI_VOICE_*) because the
 * voice models are not offered in the chat resource's region. Each Azure
 * deployment has a capped capacity, which bounds how fast voice can spend. The
 * direct OpenAI API is deliberately not supported: without the Azure settings
 * voice is off and the browser's own voice is used.
 *
 * Azure deployments are named after their models (scripts/azure-openai-setup.sh).
 * See docs/AZURE-OPENAI.adoc.
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
  name: 'azure';
  apiKey: string;
  /** Azure resource root (no trailing slash). */
  endpoint: string;
}

export function resolveVoiceProvider(env: Env = process.env): VoiceProvider | null {
  const azure = readAzureCredentials(
    env,
    'AZURE_OPENAI_VOICE_ENDPOINT',
    'AZURE_OPENAI_VOICE_API_KEY'
  );
  return azure ? { name: 'azure', ...azure } : null;
}

/** How to open the realtime WebSocket for a provider. */
export interface RealtimeConnection {
  url: string;
  /** Handshake headers (Azure takes the key as `api-key`; Node 22+ WebSocket supports this). */
  headers: Record<string, string>;
}

export function realtimeConnection(provider: VoiceProvider): RealtimeConnection {
  const model = encodeURIComponent(VOICE_MODELS.realtime);
  const base = azureBaseURL(provider.endpoint).replace(/^https:/, 'wss:');
  return { url: `${base}realtime?model=${model}`, headers: { 'api-key': provider.apiKey } };
}

/** Client for text-to-speech (Azure v1 API). */
export function speechClient(provider: VoiceProvider): OpenAI {
  return new OpenAI({ apiKey: provider.apiKey, baseURL: azureBaseURL(provider.endpoint) });
}

/** Client for transcription (deployment-scoped on Azure, see AZURE_TRANSCRIBE_API_VERSION). */
export function transcriptionClient(provider: VoiceProvider): OpenAI {
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
