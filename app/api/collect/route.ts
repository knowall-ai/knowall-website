import { trackPageView } from '@/lib/analytics/track';
import { cleanPath, cleanReferrer, truncate } from '@/lib/analytics/privacy';
import { readCappedText, refuseCollect } from '@/lib/analytics/collect-guard';

/**
 * First-party page-view beacon (components/page-view-beacon.tsx). Cookieless:
 * see lib/analytics/privacy.ts. Same-origin only, rate limited and size capped
 * (lib/analytics/collect-guard.ts). Answers 204 whether or not the view was
 * counted, so the browser learns nothing; 429 only when over the limit.
 */
export const dynamic = 'force-dynamic';

const done = (status = 204) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const refused = refuseCollect(req);
  if (refused === 'limit') return done(429);
  if (refused) return done();
  const text = await readCappedText(req);
  if (text === null) return done(413);
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
