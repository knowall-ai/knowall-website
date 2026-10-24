import { trackPageView } from '@/lib/analytics/track';
import { cleanPath, cleanReferrer, truncate } from '@/lib/analytics/privacy';
import { clientIp, consume } from '@/lib/rate-limit';
import { BodyTooLargeError, isAllowedOrigin, readTextWithLimit } from '@/lib/request-guards';

/**
 * First-party page-view beacon (components/page-view-beacon.tsx). Cookieless:
 * see lib/analytics/privacy.ts. Guarded so it can't be scripted into App
 * Insights cost or poisoned figures:
 * - an Origin is required (browsers always send one with a beacon) and must be
 *   one of the site's hosts (lib/request-guards.ts); curl without one is ignored
 * - a per-IP and a daily budget (LIMITS.perIp.collect / perDay.collect): 429
 * - a 2 KB body, read with a streamed cap: 413
 * Otherwise it answers 204 whether or not the view was counted.
 */
export const dynamic = 'force-dynamic';

export const COLLECT_MAX_BYTES = 2048;

const done = (status = 204) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!req.headers.get('origin') || !isAllowedOrigin(req)) return done();
  if (!consume('collect', clientIp(req)).ok) return done(429);
  let text: string;
  try {
    text = await readTextWithLimit(req, COLLECT_MAX_BYTES);
  } catch (error) {
    return done(error instanceof BodyTooLargeError ? 413 : 400);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done();
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const path = cleanPath(b.path);
  if (!path) return done();
  const host = req.headers.get('host') || '';
  await trackPageView(req, {
    path,
    title: typeof b.title === 'string' ? truncate(b.title, 200) : path,
    referrer: cleanReferrer(b.referrer, host),
  });
  return done();
}
