// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Chat logger tests
 *
 * Requirements: admin-logs
 * - Chat conversations are stored as JSON in the logs directory
 * - Logs can be retrieved in full or by conversation ID
 */

// The logger computes its log directory from process.cwd() at import time,
// so point cwd at a temp directory and re-import the module for each test run.
let tempDir: string;
let logger: typeof import('@/app/api/chat/logger');

const logFilePath = () => path.join(tempDir, 'logs', 'chat-logs.json');

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowall-logger-test-'));
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  vi.resetModules();
  logger = await import('@/app/api/chat/logger');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('logChat', () => {
  it('creates the logs directory and JSON log file', async () => {
    const result = await logger.logChat('Hello', 'Hi there!', 'conv-1');

    expect(result).toBe(true);
    expect(fs.existsSync(logFilePath())).toBe(true);
  });

  it('writes a log entry with message, response, id and timestamp', async () => {
    await logger.logChat('What services do you offer?', 'We offer AI consultancy.', 'conv-42');

    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: 'conv-42',
      userMessage: 'What services do you offer?',
      assistantResponse: 'We offer AI consultancy.',
    });
    expect(new Date(logs[0].timestamp).toString()).not.toBe('Invalid Date');
  });

  it('appends subsequent entries to the same file', async () => {
    await logger.logChat('First', 'Response 1', 'conv-1');
    await logger.logChat('Second', 'Response 2', 'conv-2');

    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs).toHaveLength(2);
    expect(logs.map((l: { id: string }) => l.id)).toEqual(['conv-1', 'conv-2']);
  });

  it('records request metadata when a request is provided', async () => {
    const request = new Request('http://localhost/api/chat', {
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Vitest/1.0',
      },
    });

    await logger.logChat('Hello', 'Hi!', 'conv-meta', request);

    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs[0].userIp).toBe('203.0.113.7');
    expect(logs[0].userAgent).toBe('Vitest/1.0');
  });

  it('falls back to a generated id when conversation id is empty', async () => {
    await logger.logChat('Hello', 'Hi!', '');

    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs[0].id).toBeTruthy();
  });

  it('recovers from a corrupt log file by starting a fresh log', async () => {
    fs.mkdirSync(path.join(tempDir, 'logs'), { recursive: true });
    fs.writeFileSync(logFilePath(), 'not valid json');

    const result = await logger.logChat('Hello', 'Hi!', 'conv-1');

    expect(result).toBe(true);
    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('conv-1');
  });
});

describe('getAllChatLogs', () => {
  it('returns an empty array when no chats have been logged', async () => {
    const logs = await logger.getAllChatLogs();
    expect(logs).toEqual([]);
  });

  it('returns all logged conversations', async () => {
    await logger.logChat('One', 'Reply one', 'conv-1');
    await logger.logChat('Two', 'Reply two', 'conv-2');

    const logs = await logger.getAllChatLogs();
    expect(logs).toHaveLength(2);
    expect(logs[1].userMessage).toBe('Two');
  });
});

describe('getChatLogById', () => {
  it('returns the matching log entry', async () => {
    await logger.logChat('Find me', 'Found!', 'conv-find');

    const log = await logger.getChatLogById('conv-find');
    expect(log).not.toBeNull();
    expect(log?.assistantResponse).toBe('Found!');
  });

  it('returns null when no entry matches', async () => {
    await logger.logChat('Hello', 'Hi!', 'conv-1');

    const log = await logger.getChatLogById('does-not-exist');
    expect(log).toBeNull();
  });
});

describe('App Insights chat event', () => {
  // Requirements: site-analytics - one SallieChatTurn event per turn, never with an IP
  it('emits one event per turn, with the conversation and no IP address', async () => {
    vi.stubEnv(
      'APPLICATIONINSIGHTS_CONNECTION_STRING',
      'InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://example.in.applicationinsights.azure.com/'
    );
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        sent.push(String(init?.body));
        return new Response(null, { status: 200 });
      })
    );
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.23:40000', 'user-agent': 'Mozilla/5.0' },
    });

    await logger.logChat('Do you work with SMEs?', 'Yes, mostly.', 'conv-ai', req, {
      greetingId: 'g-1',
      context: 'purple-team',
      page: '/purple-team',
      turn: 2,
    });

    // Sent in the background, off the reply's critical path
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const [envelope] = JSON.parse(sent[0]);
    expect(envelope.data.baseData.name).toBe('SallieChatTurn');
    expect(envelope.data.baseData.properties).toMatchObject({
      conversationId: 'conv-ai',
      userMessage: 'Do you work with SMEs?',
      reply: 'Yes, mostly.',
      greetingId: 'g-1',
      page: '/purple-team',
      turn: '2',
    });
    expect(sent[0]).not.toContain('198.51.100.23');
    // The file log is kept as before
    expect(JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'))).toHaveLength(1);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends nothing when App Insights is not configured', async () => {
    vi.stubEnv('APPLICATIONINSIGHTS_CONNECTION_STRING', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await logger.logChat('Hi', 'Hello', 'conv-none');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('retention', () => {
  it('prunes chat log entries older than 30 days', async () => {
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString();
    fs.mkdirSync(path.join(tempDir, 'logs'), { recursive: true });
    fs.writeFileSync(
      logFilePath(),
      JSON.stringify([
        { id: 'old', timestamp: old, userMessage: 'a', assistantResponse: 'b', userIp: '1.2.3.4' },
      ])
    );
    await logger.logChat('New', 'Reply', 'conv-new');
    const logs = JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'));
    expect(logs.map((l: { id: string }) => l.id)).toEqual(['conv-new']);
  });

  it('prunes on read too', async () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const fresh = new Date().toISOString();
    fs.mkdirSync(path.join(tempDir, 'logs'), { recursive: true });
    fs.writeFileSync(
      logFilePath(),
      JSON.stringify([
        { id: 'old', timestamp: old, userMessage: 'a', assistantResponse: 'b' },
        { id: 'fresh', timestamp: fresh, userMessage: 'c', assistantResponse: 'd' },
      ])
    );
    expect((await logger.getAllChatLogs()).map((l) => l.id)).toEqual(['fresh']);
    expect(JSON.parse(fs.readFileSync(logFilePath(), 'utf-8'))).toHaveLength(1);
  });
});
