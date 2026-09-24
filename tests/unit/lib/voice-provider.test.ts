// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { realtimeConnection, resolveVoiceProvider } from '@/lib/voice-provider';

/**
 * Voice provider resolution tests
 *
 * Requirements: sallie-chat
 * - Voice uses its own Azure OpenAI resource when configured
 * - The OpenAI key is the fallback, never mixed with the Azure endpoint
 * - A non-Azure endpoint never receives the Azure key
 */

describe('resolveVoiceProvider', () => {
  it('prefers the Azure voice resource and normalises the endpoint', () => {
    expect(
      resolveVoiceProvider({
        AZURE_OPENAI_VOICE_ENDPOINT: 'https://knowall-website-voice.openai.azure.com/',
        AZURE_OPENAI_VOICE_API_KEY: 'voice-key',
        OPENAI_API_KEY: 'sk-openai',
      })
    ).toEqual({
      name: 'azure',
      apiKey: 'voice-key',
      endpoint: 'https://knowall-website-voice.openai.azure.com',
    });
  });

  it('strips a pasted /openai or /openai/v1 suffix from the endpoint', () => {
    for (const suffix of ['/openai', '/openai/', '/openai/v1', '/openai/v1/']) {
      expect(
        resolveVoiceProvider({
          AZURE_OPENAI_VOICE_ENDPOINT: `https://knowall-website-voice.openai.azure.com${suffix}`,
          AZURE_OPENAI_VOICE_API_KEY: 'voice-key',
        })?.endpoint
      ).toBe('https://knowall-website-voice.openai.azure.com');
    }
  });

  it('ignores the chat resource settings', () => {
    const provider = resolveVoiceProvider({
      AZURE_OPENAI_ENDPOINT: 'https://knowall-website-ai.openai.azure.com/',
      AZURE_OPENAI_API_KEY: 'chat-key',
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(provider).toEqual({ name: 'openai', apiKey: 'sk-openai' });
  });

  it('falls back to OpenAI when the Azure endpoint is not an Azure host', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = resolveVoiceProvider({
      AZURE_OPENAI_VOICE_ENDPOINT: 'https://evil.example.com/',
      AZURE_OPENAI_VOICE_API_KEY: 'voice-key',
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(provider?.name).toBe('openai');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns null when nothing is configured', () => {
    expect(resolveVoiceProvider({})).toBeNull();
  });
});

describe('realtimeConnection', () => {
  it('uses the api-key header and wss v1 URL on Azure, never a subprotocol', () => {
    const conn = realtimeConnection({
      name: 'azure',
      apiKey: 'voice-key',
      endpoint: 'https://knowall-website-voice.openai.azure.com',
    });
    expect(conn).toEqual({
      url: 'wss://knowall-website-voice.openai.azure.com/openai/v1/realtime?model=gpt-realtime',
      headers: { 'api-key': 'voice-key' },
    });
  });
});
