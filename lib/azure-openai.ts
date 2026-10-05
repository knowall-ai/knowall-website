/**
 * Helpers shared by every route that can talk to Azure OpenAI (chat and voice).
 * See docs/AZURE-OPENAI.adoc.
 */

export type Env = Record<string, string | undefined>;

export function clean(value: string | undefined): string {
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
 * so a misconfigured endpoint can never receive the Azure key or visitor traffic.
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

/**
 * The resource root with no trailing slash and no `/openai` or `/openai/v1`
 * suffix, so callers can append whichever path they need.
 */
export function azureRoot(endpoint: string): string {
  return clean(endpoint)
    .replace(/\/+$/, '')
    .replace(/\/openai(\/v1)?$/, '');
}

/** Turns an Azure resource endpoint into the v1 base URL the SDK expects. */
export function azureBaseURL(endpoint: string): string {
  return `${azureRoot(endpoint)}/openai/v1/`;
}

/**
 * Reads an Azure endpoint + key pair from env. Returns null when either is
 * missing, and warns (then returns null) when the endpoint is not an Azure host.
 */
export function readAzureCredentials(
  env: Env,
  endpointVar: string,
  keyVar: string
): { endpoint: string; apiKey: string } | null {
  const endpoint = clean(env[endpointVar]);
  const apiKey = clean(env[keyVar]);
  if (!endpoint || !apiKey) return null;
  if (!isAzureEndpoint(endpoint)) {
    console.warn(`${endpointVar} is not an HTTPS Azure OpenAI host; ignoring Azure settings`);
    return null;
  }
  return { endpoint: azureRoot(endpoint), apiKey };
}

/** True when the upstream rejected the call with HTTP 429 (rate or capacity limit). */
export function isRateLimited(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 429
  );
}
