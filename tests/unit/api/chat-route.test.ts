// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Chat API route tests
 *
 * Requirements: sally-chat (docs/requirements.yaml)
 * - Messages are sent to the OpenAI API and a response is returned
 * - A fallback response is returned when the OpenAI API is unavailable
 * - The route degrades gracefully when no API key is configured
 */

const { createMock, logChatMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  logChatMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('openai', () => ({
  OpenAI: class {
    chat = { completions: { create: createMock } };
  },
}));

vi.mock('@/app/api/chat/logger', () => ({
  logChat: logChatMock,
}));

import { GET, POST } from '@/app/api/chat/route';

function postRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createMock.mockReset();
  logChatMock.mockClear();
  // Silence the route's verbose console output in test runs
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/chat', () => {
  it('returns a diagnostic payload when diagnostic=true', async () => {
    const response = await GET(new Request('http://localhost:3000/api/chat?diagnostic=true'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.time).toBeTruthy();
  });

  it('returns 405 for non-diagnostic GET requests', async () => {
    const response = await GET(new Request('http://localhost:3000/api/chat'));

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    const body = await response.json();
    expect(body.error).toContain('Method not allowed');
  });
});

describe('POST /api/chat', () => {
  it('returns a 500 error response when OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const response = await POST(
      postRequest({ messages: [{ role: 'user', content: 'Hello' }], conversationId: 'conv-1' })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('An error occurred in the chat API. Please try again.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns the assistant response in the expected shape', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Hello from Sally!' } }],
    });

    const response = await POST(
      postRequest({
        messages: [{ role: 'user', content: 'Tell me about KnowAll' }],
        conversationId: 'conv-123',
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const body = await response.json();
    expect(body).toMatchObject({
      role: 'assistant',
      content: 'Hello from Sally!',
      conversationId: 'conv-123',
    });
    expect(body.id).toBeTruthy();
  });

  it('sends the system prompt with the conversation id substituted', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Hi!' } }],
    });

    await POST(
      postRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        conversationId: 'conv-456',
      })
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe('gpt-4o');
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[0].content).toContain('conv-456');
    expect(request.messages[0].content).not.toContain('{{CONVERSATION_ID}}');
    expect(request.messages[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('generates a conversation id when none is provided', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Hi!' } }],
    });

    const response = await POST(postRequest({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = await response.json();
    expect(body.conversationId).toBeTruthy();
  });

  it('logs successful conversations', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'A helpful answer' } }],
    });

    await POST(
      postRequest({
        messages: [{ role: 'user', content: 'What do you do?' }],
        conversationId: 'conv-log',
      })
    );

    expect(logChatMock).toHaveBeenCalledTimes(1);
    expect(logChatMock).toHaveBeenCalledWith(
      'What do you do?',
      'A helpful answer',
      'conv-log',
      expect.anything()
    );
  });

  it('returns a fallback response when the OpenAI API call fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockRejectedValue(new Error('OpenAI is down'));

    const response = await POST(
      postRequest({
        messages: [{ role: 'user', content: 'Are you there?' }],
        conversationId: 'conv-fallback',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe('assistant');
    expect(body.content).toContain('I received your message: "Are you there?"');
    expect(body.content).toContain('technical difficulties');
    expect(body.conversationId).toBe('conv-fallback');
  });

  it('logs fallback conversations too', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockRejectedValue(new Error('OpenAI is down'));

    await POST(
      postRequest({
        messages: [{ role: 'user', content: 'Hello?' }],
        conversationId: 'conv-fb-log',
      })
    );

    expect(logChatMock).toHaveBeenCalledTimes(1);
    expect(logChatMock.mock.calls[0][0]).toBe('Hello?');
    expect(logChatMock.mock.calls[0][1]).toContain('technical difficulties');
  });

  it('handles a request without a messages array', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Hi!' } }],
    });

    const response = await POST(postRequest({ conversationId: 'conv-empty' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.content).toBe('Hi!');
    // Only the system prompt should have been sent
    expect(createMock.mock.calls[0][0].messages).toHaveLength(1);
  });

  it('returns a 500 error for a malformed (non-JSON) request body', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');

    const response = await POST(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
