/**
 * Resolves which chat completions backend Sallie should talk to.
 *
 * Azure OpenAI is preferred: it lets us cap the deployment's tokens-per-minute
 * capacity (a hard ceiling on spend rate) and attach an Azure budget. The
 * direct OpenAI API remains available as a fallback for local development.
 *
 * Azure is reached through the OpenAI SDK's v1 base URL, so the same client
 * class is used for both providers — only `baseURL` and `model` differ.
 * See docs/AZURE-OPENAI.adoc.
 */

export const DEFAULT_CHAT_MODEL = 'gpt-5.6-sol';

export type ChatProviderName = 'azure' | 'openai';

export interface ChatProvider {
  name: ChatProviderName;
  apiKey: string;
  /** Base URL for the OpenAI SDK; undefined means api.openai.com. */
  baseURL?: string;
  /** Model name (OpenAI) or deployment name (Azure) to pass as `model`. */
  model: string;
}

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Hostname suffixes an Azure OpenAI / Foundry resource can legitimately have. */
const AZURE_HOST_SUFFIXES = [
  '.openai.azure.com',
  '.services.ai.azure.com',
  '.cognitiveservices.azure.com',
];

/**
 * True only for an HTTPS URL on an Azure OpenAI host. Anything else is ignored
 * so a misconfigured endpoint can never receive the Azure key or chat traffic.
 */
export function isAzureEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(clean(endpoint));
    return (
      url.protocol === 'https:' &&
      AZURE_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

/** Turns an Azure resource endpoint into the v1 base URL the SDK expects. */
export function azureBaseURL(endpoint: string): string {
  const root = clean(endpoint).replace(/\/+$/, '');
  return root.endsWith('/openai/v1') ? `${root}/` : `${root}/openai/v1/`;
}

export function resolveChatProvider(env: Env = process.env): ChatProvider | null {
  const azureEndpoint = clean(env.AZURE_OPENAI_ENDPOINT);
  const azureKey = clean(env.AZURE_OPENAI_API_KEY);

  if (azureEndpoint && azureKey && !isAzureEndpoint(azureEndpoint)) {
    console.warn(
      'AZURE_OPENAI_ENDPOINT is not an HTTPS Azure OpenAI host; ignoring Azure settings'
    );
  } else if (azureEndpoint && azureKey) {
    return {
      name: 'azure',
      apiKey: azureKey,
      baseURL: azureBaseURL(azureEndpoint),
      model: clean(env.AZURE_OPENAI_DEPLOYMENT) || DEFAULT_CHAT_MODEL,
    };
  }

  const openaiKey = clean(env.OPENAI_API_KEY);
  if (openaiKey) {
    return {
      name: 'openai',
      apiKey: openaiKey,
      model: clean(env.OPENAI_MODEL) || DEFAULT_CHAT_MODEL,
    };
  }

  return null;
}

/** True when the upstream rejected the call because the deployment's capacity was exceeded. */
export function isRateLimited(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 429
  );
}
