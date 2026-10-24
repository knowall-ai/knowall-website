import { clientIp, consume, isSameOrigin } from '@/lib/rate-limit';

/**
 * Guards for the page-view beacon (/api/collect), so it can't be scripted into
 * App Insights cost or poisoned figures:
 * - same origin only: Origin (or Referer) must be this site, and must be present
 * - a per-IP and a daily budget (LIMITS.perIp.collect / perDay.collect)
 * - a small body, read with a hard cap
 *
 * When PR #211 (lib/request-guards.ts) lands, `readCappedText` is replaced by its
 * `readTextWithLimit` (same contract: stop reading past the cap) and this file
 * keeps only the collect-specific budget.
 */
export const COLLECT_MAX_BYTES = 2048;

/** The body as text, or null once it passes `maxBytes` (it is never buffered in full). */
export async function readCappedText(
  req: Request,
  maxBytes = COLLECT_MAX_BYTES
): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export type CollectRefusal = 'origin' | 'limit';

/** Why a beacon is refused before its body is read, or null to go ahead. */
export function refuseCollect(req: Request, now = Date.now()): CollectRefusal | null {
  if (!isSameOrigin(req)) return 'origin';
  if (!consume('collect', clientIp(req), now).ok) return 'limit';
  return null;
}
