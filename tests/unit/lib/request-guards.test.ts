// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  BodyTooLargeError,
  isAllowedOrigin,
  readBodyWithLimit,
  readTextWithLimit,
} from '@/lib/request-guards';

/**
 * Request guards for the public API routes
 *
 * Requirements: sallie-chat
 * - Browsers on other sites are refused; requests without an Origin are allowed
 * - Oversized bodies are refused without being buffered in full
 */

function withOrigin(origin?: string) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: origin ? { origin } : {},
  });
}

/** A streamed body with no Content-Length, as a chunked upload would arrive. */
function streamed(chunks: number, size: number) {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ >= chunks) controller.close();
      else controller.enqueue(new Uint8Array(size).fill(97));
    },
  });
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    body,
    // @ts-expect-error -- Node's fetch needs duplex for a streamed body
    duplex: 'half',
  });
}

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin', () => {
    expect(isAllowedOrigin(withOrigin())).toBe(true);
  });

  it.each([
    'https://www.knowall.ai',
    'https://knowall.ai',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(withOrigin(origin))).toBe(true);
  });

  it.each(['https://evil.example', 'https://knowall.ai.evil.example', 'null', 'not a url'])(
    'refuses %s',
    (origin) => {
      expect(isAllowedOrigin(withOrigin(origin))).toBe(false);
    }
  );
});

describe('readBodyWithLimit', () => {
  it('reads a body within the limit', async () => {
    const req = new Request('http://localhost/', { method: 'POST', body: 'hello' });
    expect(await readTextWithLimit(req, 5)).toBe('hello');
  });

  it('refuses a declared Content-Length over the limit', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: 'hello world',
      headers: { 'content-length': '11' },
    });
    await expect(readBodyWithLimit(req, 5)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('stops reading a streamed body once it passes the limit', async () => {
    await expect(readBodyWithLimit(streamed(100, 1024), 4096)).rejects.toBeInstanceOf(
      BodyTooLargeError
    );
  });

  it('returns an empty body when there is none', async () => {
    const req = new Request('http://localhost/', { method: 'POST' });
    expect(await readTextWithLimit(req, 10)).toBe('');
  });
});
