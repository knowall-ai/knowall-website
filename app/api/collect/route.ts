import { trackPageView } from '@/lib/analytics/track';
import { cleanPath, cleanReferrer, truncate } from '@/lib/analytics/privacy';

/**
 * First-party page-view beacon (components/page-view-beacon.tsx). Cookieless:
 * see lib/analytics/privacy.ts. Always answers 204 so the browser learns
 * nothing, whether or not the view was counted.
 */
export const dynamic = 'force-dynamic';

const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  // Only the site's own pages send this (sendBeacon sets Sec-Fetch-Site)
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return done();
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 2000) return done();
    body = JSON.parse(text);
  } catch {
    return done();
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const path = cleanPath(b.path);
  if (!path) return done();
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  await trackPageView(req, {
    path,
    title: typeof b.title === 'string' ? truncate(b.title, 200) : path,
    referrer: cleanReferrer(b.referrer, host),
  });
  return done();
}
