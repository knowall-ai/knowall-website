/**
 * Resolves which chat completions backend Sallie should talk to.
 *
 * Azure OpenAI only: it lets us cap the deployment's tokens-per-minute capacity
 * (a hard ceiling on spend rate) and attach an Azure budget. The direct OpenAI
 * API is deliberately not supported; without the Azure settings Sallie gives
 * her fallback reply (local development included).
 *
 * Azure is reached through the OpenAI SDK's v1 base URL. See docs/AZURE-OPENAI.adoc.
 */

import { azureBaseURL, clean, readAzureCredentials, type Env } from '@/lib/azure-openai';

// Re-exported so existing imports keep working; the helpers live in lib/azure-openai.
export { azureBaseURL, isAzureEndpoint, isRateLimited } from '@/lib/azure-openai';

export const DEFAULT_CHAT_MODEL = 'gpt-5.6-sol';

export type ChatProviderName = 'azure';

export interface ChatProvider {
  name: ChatProviderName;
  apiKey: string;
  /** Azure v1 base URL for the OpenAI SDK. */
  baseURL: string;
  /** Azure deployment name, passed as `model`. */
  model: string;
}

export function resolveChatProvider(env: Env = process.env): ChatProvider | null {
  const azure = readAzureCredentials(env, 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY');
  if (azure) {
    return {
      name: 'azure',
      apiKey: azure.apiKey,
      baseURL: azureBaseURL(azure.endpoint),
      model: clean(env.AZURE_OPENAI_DEPLOYMENT) || DEFAULT_CHAT_MODEL,
    };
  }

  return null;
}
