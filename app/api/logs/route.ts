import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAllChatLogs, getChatLogById } from '../chat/logger';
import { clearFailures, clientIp, lockedOutFor, recordFailure } from '@/lib/rate-limit';

// Configure for API route
export const runtime = 'nodejs';
// Set to force-dynamic to ensure the route is always server-rendered
export const dynamic = 'force-dynamic';

// Verify API key from request headers. Fails closed: if ADMIN_API_KEY is not
// configured, no request is ever authorized — there is no default key.
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  return keysMatch(token, apiKey);
}

/**
 * Constant-time comparison. Hashing both sides first gives equal-length
 * buffers, so neither the key's contents nor its length leak through timing.
 */
export function keysMatch(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// GET handler for retrieving all logs or a specific log
export async function GET(request: NextRequest) {
  try {
    // The endpoint is unavailable until an admin key is configured
    if (!process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Service unavailable: ADMIN_API_KEY is not configured' },
        { status: 503 }
      );
    }

    // Too many wrong keys from this address: refuse before checking another.
    const attemptKey = `logs:${clientIp(request)}`;
    const retryAfter = lockedOutFor(attemptKey);
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // Verify API key
    if (!verifyApiKey(request)) {
      recordFailure(attemptKey);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing API key' },
        { status: 401 }
      );
    }
    clearFailures(attemptKey);

    // Check if a specific log ID is requested
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      // Get a specific log by ID
      const log = await getChatLogById(id);

      if (!log) {
        return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      }

      return NextResponse.json(log);
    } else {
      // Get all logs
      const logs = await getAllChatLogs();
      return NextResponse.json(logs);
    }
  } catch (error) {
    console.error('Error retrieving logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
