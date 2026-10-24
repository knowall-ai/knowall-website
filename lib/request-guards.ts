/**
 * Input guards for the public API routes (chat, speak, listen).
 *
 * - an Origin allowlist: browsers on another site can't drive the endpoints,
 *   while requests with no Origin (server-side callers, tests) still work
 * - a streamed body-size cap, so an oversized body is refused without being
 *   buffered in full
 */

const ALLOWED_ORIGIN_HOSTS = new Set(['www.knowall.ai', 'knowall.ai', 'localhost', '127.0.0.1']);

/** False only when an Origin header is present and isn't one of the site's hosts. */
export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return ALLOWED_ORIGIN_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export class BodyTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Read the body, stopping as soon as it passes `maxBytes`.
 * Throws BodyTooLargeError when it does.
 */
export async function readBodyWithLimit(
  req: Request,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** readBodyWithLimit, decoded as UTF-8. */
export async function readTextWithLimit(req: Request, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBodyWithLimit(req, maxBytes));
}
