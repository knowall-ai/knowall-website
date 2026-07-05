// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Admin logs API route tests
 *
 * Requirements: admin-logs (docs/requirements.yaml)
 * - Logs are only accessible with the correct API key
 * - Admins can retrieve all logs or a specific log by ID
 */

const { getAllChatLogsMock, getChatLogByIdMock } = vi.hoisted(() => ({
  getAllChatLogsMock: vi.fn(),
  getChatLogByIdMock: vi.fn(),
}));

vi.mock('@/app/api/chat/logger', () => ({
  getAllChatLogs: getAllChatLogsMock,
  getChatLogById: getChatLogByIdMock,
}));

const TEST_ADMIN_KEY = 'test-admin-key';

const sampleLogs = [
  {
    id: 'conv-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    userMessage: 'Hello',
    assistantResponse: 'Hi!',
  },
  {
    id: 'conv-2',
    timestamp: '2026-01-02T00:00:00.000Z',
    userMessage: 'What services do you offer?',
    assistantResponse: 'AI consultancy.',
  },
];

// The route reads ADMIN_API_KEY at module load time, so stub the env
// and re-import the module for each test.
let GET: typeof import('@/app/api/logs/route').GET;

function logsRequest(options: { key?: string; id?: string } = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/logs');
  if (options.id) {
    url.searchParams.set('id', options.id);
  }
  const headers: Record<string, string> = {};
  if (options.key) {
    headers.authorization = `Bearer ${options.key}`;
  }
  return new NextRequest(url, { headers });
}

beforeEach(async () => {
  getAllChatLogsMock.mockReset();
  getChatLogByIdMock.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('ADMIN_API_KEY', TEST_ADMIN_KEY);
  vi.resetModules();
  ({ GET } = await import('@/app/api/logs/route'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/logs authentication', () => {
  it('returns 401 when no authorization header is provided', async () => {
    const response = await GET(logsRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
    expect(getAllChatLogsMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the API key is wrong', async () => {
    const response = await GET(logsRequest({ key: 'wrong-key' }));

    expect(response.status).toBe(401);
    expect(getAllChatLogsMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is not a Bearer token', async () => {
    const request = new NextRequest('http://localhost:3000/api/logs', {
      headers: { authorization: TEST_ADMIN_KEY },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('accepts the correct API key', async () => {
    getAllChatLogsMock.mockResolvedValue(sampleLogs);

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY }));

    expect(response.status).toBe(200);
  });
});

describe('GET /api/logs data retrieval', () => {
  it('returns all logs when no id is specified', async () => {
    getAllChatLogsMock.mockResolvedValue(sampleLogs);

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY }));

    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('conv-1');
  });

  it('returns a single log when an id is specified', async () => {
    getChatLogByIdMock.mockResolvedValue(sampleLogs[1]);

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY, id: 'conv-2' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('conv-2');
    expect(getChatLogByIdMock).toHaveBeenCalledWith('conv-2');
  });

  it('returns 404 when the requested log does not exist', async () => {
    getChatLogByIdMock.mockResolvedValue(null);

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY, id: 'missing' }));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Log not found');
  });

  it('returns 500 when reading logs fails', async () => {
    getAllChatLogsMock.mockRejectedValue(new Error('disk error'));

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });
});
