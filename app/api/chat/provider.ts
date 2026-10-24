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

import { azureBaseURL, clean, readAzureCredentials, type Env } from '@/lib/azure-openai';

// Re-exported so existing imports keep working; the helpers live in lib/azure-openai.
export { azureBaseURL, isAzureEndpoint, isRateLimited } from '@/lib/azure-openai';

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
