// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Chat API route tests
 *
 * Requirements: sallie-chat
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
      choices: [{ message: { content: 'Hello from Sallie!' } }],
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
      content: 'Hello from Sallie!',
      conversationId: 'conv-123',
    });
    expect(body.id).toBeTruthy();
  });

  it('sends the system prompt without surfacing the conversation id', async () => {
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
    expect(request.model).toBe('gpt-5.6-sol');
    expect(request.messages[0].role).toBe('system');
    // The conversation id is used for logging only and is no longer injected
    // into the system prompt or surfaced to visitors.
    expect(request.messages[0].content).not.toContain('conv-456');
    expect(request.messages[0].content).not.toContain('{{CONVERSATION_ID}}');
    expect(request.messages[0].content).toContain('sallie@knowall.ai');
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
      expect.anything(),
      { greetingId: undefined }
    );
  });

  it('logs which opening line the conversation started with', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
    createMock.mockResolvedValue({ choices: [{ message: { content: 'Sure' } }] });
    await POST(
      postRequest({
        conversationId: 'conv-greet',
        greetingId: 'three-questions',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    );
    expect(logChatMock).toHaveBeenLastCalledWith('Hi', 'Sure', 'conv-greet', expect.anything(), {
      greetingId: 'three-questions',
    });
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

describe('POST /api/chat cost guards', () => {
  beforeEach(async () => {
    const { resetRateLimits } = await import('@/lib/rate-limit');
    resetRateLimits();
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signs off nicely once a conversation reaches its message cap', async () => {
    vi.stubEnv('SALLIE_LIMIT_MESSAGES_PER_CONVERSATION', '2');
    const { POST } = await import('@/app/api/chat/route');
    const messages = [
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'two' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'three' },
    ];
    const res = await POST(postRequest({ conversationId: 'CAP12345', messages }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ended).toBe(true);
    expect(body.reason).toBe('conversation');
    expect(body.content).toContain('Thank you for chatting');
    expect(body.content).toContain(
      'mailto:sallie@knowall.ai?subject=Continuing%20our%20chat%20(ref%20CAP12345)'
    );
    expect(body.content).toContain('this conversation is saved');
    // Over-cap requests don't spend the day's budget
    const { consume } = await import('@/lib/rate-limit');
    expect(consume('chat', 'someone-else').ok).toBe(true);
    // Logged with the reason, so Sallie's lead sweep can follow these up
    expect(logChatMock).toHaveBeenLastCalledWith(
      'three',
      expect.stringContaining('sallie@knowall.ai'),
      'CAP12345',
      expect.anything(),
      { greetingId: undefined, endedReason: 'conversation' }
    );
  });

  it('signs off when a visitor exceeds their allowance, with a Retry-After', async () => {
    vi.stubEnv('SALLIE_LIMIT_CHAT_PER_IP', '1');
    const { POST } = await import('@/app/api/chat/route');
    const messages = [{ role: 'user', content: 'hello' }];
    await POST(postRequest({ conversationId: 'IP123456', messages }));
    const res = await POST(postRequest({ conversationId: 'IP123456', messages }));
    expect(res.status).toBe(200);
    expect(res.headers.get('retry-after')).toBeTruthy();
    const body = await res.json();
    expect(body.ended).toBe(true);
    expect(body.reason).toBe('ip');
  });
});
