// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Admin logs API route tests
 *
 * Requirements: admin-logs
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

// Stub ADMIN_API_KEY and re-import the module for each test.
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

  it('returns 503 when ADMIN_API_KEY is not configured (fails closed)', async () => {
    vi.stubEnv('ADMIN_API_KEY', '');

    const response = await GET(logsRequest({ key: TEST_ADMIN_KEY }));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('ADMIN_API_KEY');
    expect(getAllChatLogsMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/logs key comparison', () => {
  it('matches only the exact key, whatever the length', async () => {
    const { keysMatch } = await import('@/app/api/logs/route');

    expect(keysMatch(TEST_ADMIN_KEY, TEST_ADMIN_KEY)).toBe(true);
    expect(keysMatch('test-admin-kez', TEST_ADMIN_KEY)).toBe(false);
    expect(keysMatch('test-admin-key-longer', TEST_ADMIN_KEY)).toBe(false);
    expect(keysMatch('t', TEST_ADMIN_KEY)).toBe(false);
    expect(keysMatch('', TEST_ADMIN_KEY)).toBe(false);
  });
});

describe('GET /api/logs failed-attempt lock-out', () => {
  function fromIp(key: string | undefined, ip: string): NextRequest {
    const headers: Record<string, string> = { 'x-forwarded-for': ip };
    if (key) headers.authorization = `Bearer ${key}`;
    return new NextRequest('http://localhost:3000/api/logs', { headers });
  }

  it('returns 429 after 10 wrong keys from one IP, even for the right key', async () => {
    getAllChatLogsMock.mockResolvedValue(sampleLogs);
    for (let i = 0; i < 10; i++) {
      expect((await GET(fromIp('wrong', '203.0.113.7'))).status).toBe(401);
    }

    const locked = await GET(fromIp(TEST_ADMIN_KEY, '203.0.113.7'));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(getAllChatLogsMock).not.toHaveBeenCalled();

    // Another address is unaffected.
    expect((await GET(fromIp(TEST_ADMIN_KEY, '198.51.100.1'))).status).toBe(200);
  });

  it('counts a missing key as a failure', async () => {
    for (let i = 0; i < 10; i++) await GET(fromIp(undefined, '203.0.113.8'));

    expect((await GET(fromIp(TEST_ADMIN_KEY, '203.0.113.8'))).status).toBe(429);
  });

  it('clears the count after a successful key', async () => {
    getAllChatLogsMock.mockResolvedValue(sampleLogs);
    for (let i = 0; i < 9; i++) await GET(fromIp('wrong', '203.0.113.9'));
    expect((await GET(fromIp(TEST_ADMIN_KEY, '203.0.113.9'))).status).toBe(200);

    for (let i = 0; i < 9; i++) await GET(fromIp('wrong', '203.0.113.9'));
    expect((await GET(fromIp(TEST_ADMIN_KEY, '203.0.113.9'))).status).toBe(200);
  });

  it('unlocks once the 15-minute window passes', async () => {
    const { lockedOutFor, recordFailure } = await import('@/lib/rate-limit');
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) recordFailure('k', t0);

    expect(lockedOutFor('k', t0 + 1000)).toBeGreaterThan(0);
    expect(lockedOutFor('k', t0 + 15 * 60 * 1000)).toBe(0);
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
