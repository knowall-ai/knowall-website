import { NextResponse, type NextRequest } from 'next/server';
import { pageCsp, resourceCsp } from '@/lib/security-headers.mjs';

// Per-request nonce CSP, per the Next 16 CSP guide
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Baseline headers (HSTS, nosniff, …) and the /presentations deck CSP come
// from next.config.mjs so they also cover files this proxy skips.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes and public/ files (anything with an extension) aren't pages:
  // give them a locked-down policy and skip the nonce.
  if (pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname)) {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', resourceCsp);
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = pageCsp(nonce, { dev: process.env.NODE_ENV === 'development' });

  // Next reads the nonce from the request's CSP header while rendering and
  // stamps it on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Static build output and the decks (their CSP is set in next.config.mjs).
      source: '/((?!_next/static|_next/image|presentations).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
