// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  azureBaseURL,
  isAzureEndpoint,
  isRateLimited,
  resolveChatProvider,
  DEFAULT_CHAT_MODEL,
} from '@/app/api/chat/provider';

/**
 * Chat provider resolution tests
 *
 * Requirements: sallie-chat
 * - Azure OpenAI is used when its endpoint and key are configured
 * - The direct OpenAI API is used only as a fallback
 * - Nothing is configured → no provider, so the route degrades gracefully
 */

describe('resolveChatProvider', () => {
  it('prefers Azure OpenAI when endpoint and key are set', () => {
    const provider = resolveChatProvider({
      AZURE_OPENAI_ENDPOINT: 'https://knowall-website-ai.openai.azure.com/',
      AZURE_OPENAI_API_KEY: 'azure-key',
      AZURE_OPENAI_DEPLOYMENT: 'sallie-chat',
      OPENAI_API_KEY: 'sk-openai',
    });

    expect(provider).toEqual({
      name: 'azure',
      apiKey: 'azure-key',
      baseURL: 'https://knowall-website-ai.openai.azure.com/openai/v1/',
      model: 'sallie-chat',
    });
  });

  it('defaults the Azure deployment name to the default chat model', () => {
    const provider = resolveChatProvider({
      AZURE_OPENAI_ENDPOINT: 'https://knowall-website-ai.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'azure-key',
    });

    expect(provider?.model).toBe(DEFAULT_CHAT_MODEL);
  });

  it('falls back to OpenAI when Azure is not fully configured', () => {
    const provider = resolveChatProvider({
      AZURE_OPENAI_ENDPOINT: 'https://knowall-website-ai.openai.azure.com',
      AZURE_OPENAI_API_KEY: '   ',
      OPENAI_API_KEY: 'sk-openai',
    });

    expect(provider).toEqual({ name: 'openai', apiKey: 'sk-openai', model: DEFAULT_CHAT_MODEL });
    expect(provider?.baseURL).toBeUndefined();
  });

  it('honours OPENAI_MODEL for the OpenAI provider', () => {
    const provider = resolveChatProvider({
      OPENAI_API_KEY: 'sk-openai',
      OPENAI_MODEL: 'gpt-5.4-mini',
    });

    expect(provider?.model).toBe('gpt-5.4-mini');
  });

  it('ignores an endpoint that is not an HTTPS Azure host and falls back to OpenAI', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = resolveChatProvider({
      AZURE_OPENAI_ENDPOINT: 'https://evil.example.com/',
      AZURE_OPENAI_API_KEY: 'azure-key',
      OPENAI_API_KEY: 'sk-openai',
    });

    expect(provider?.name).toBe('openai');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns null when nothing is configured', () => {
    expect(resolveChatProvider({})).toBeNull();
    expect(resolveChatProvider({ OPENAI_API_KEY: '' })).toBeNull();
  });
});

describe('isAzureEndpoint', () => {
  it('accepts the Azure OpenAI and Foundry hostname forms over HTTPS', () => {
    expect(isAzureEndpoint('https://x.openai.azure.com/')).toBe(true);
    expect(isAzureEndpoint('https://x.services.ai.azure.com')).toBe(true);
    expect(isAzureEndpoint('https://x.cognitiveservices.azure.com/')).toBe(true);
  });

  it('rejects other hosts, plain HTTP and junk', () => {
    expect(isAzureEndpoint('https://x.openai.azure.com.evil.example/')).toBe(false);
    expect(isAzureEndpoint('http://x.openai.azure.com/')).toBe(false);
    expect(isAzureEndpoint('not a url')).toBe(false);
    expect(isAzureEndpoint('')).toBe(false);
  });
});

describe('azureBaseURL', () => {
  it('appends the v1 path and tolerates trailing slashes', () => {
    expect(azureBaseURL('https://x.openai.azure.com')).toBe(
      'https://x.openai.azure.com/openai/v1/'
    );
    expect(azureBaseURL('https://x.openai.azure.com/')).toBe(
      'https://x.openai.azure.com/openai/v1/'
    );
  });

  it('accepts the Foundry services.ai.azure.com endpoint form', () => {
    expect(azureBaseURL('https://x.services.ai.azure.com/')).toBe(
      'https://x.services.ai.azure.com/openai/v1/'
    );
  });

  it('does not double the v1 path when already present', () => {
    expect(azureBaseURL('https://x.openai.azure.com/openai/v1')).toBe(
      'https://x.openai.azure.com/openai/v1/'
    );
  });
});

describe('isRateLimited', () => {
  it('detects an HTTP 429 from the SDK', () => {
    expect(isRateLimited({ status: 429, message: 'Rate limit' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isRateLimited(new Error('boom'))).toBe(false);
    expect(isRateLimited({ status: 500 })).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });
});
