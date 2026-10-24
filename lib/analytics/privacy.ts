import { createHmac, randomBytes } from 'node:crypto';

/**
 * Cookieless, anonymous visitor counting (the approach Plausible and Fathom use).
 *
 * Nothing is stored on the visitor's device, so PECR needs no consent banner.
 * A visitor is a keyed hash of their address and browser. The key is the day's
 * salt: an HMAC of ANALYTICS_SALT and the UTC date, so it rotates every day and
 * the same person can't be followed from one day to the next. Only today's
 * salt is held, in memory; no salt or address is ever written anywhere, and the
 * hash can't be turned back into an address.
 *
 * ANALYTICS_SALT (an App Service setting) keeps the day's salt the same across
 * instances and restarts. Without it each process uses a random secret, which
 * only means a visitor may be counted twice on a day the site restarts.
 */

let processSecret: string | null = null;
function secret(): string {
  const configured = process.env.ANALYTICS_SALT?.trim();
  if (configured) return configured;
  processSecret ??= randomBytes(32).toString('hex');
  return processSecret;
}

/** The UTC day, e.g. 2026-10-24: the salt rotates when it changes. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Today's salt only: a new day replaces it, so earlier salts aren't kept. */
let current: { day: string; secret: string; salt: Buffer } | null = null;
export function dailySalt(now = new Date()): Buffer {
  const day = utcDay(now);
  const s = secret();
  if (!current || current.day !== day || current.secret !== s) {
    current = { day, secret: s, salt: createHmac('sha256', s).update(`salt:${day}`).digest() };
  }
  return current.salt;
}

/** A 16-hex-character id for this address and browser, on this UTC day only. */
export function visitorId(ip: string, userAgent: string, now = new Date()): string {
  return createHmac('sha256', dailySalt(now))
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

/** Do Not Track or Global Privacy Control: the visitor has asked not to be counted. */
export function optedOut(headers: Headers): boolean {
  return headers.get('dnt') === '1' || headers.get('sec-gpc') === '1';
}

const BOT =
  /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|curl|wget|python|axios|node-fetch|go-http/i;

/** Crawlers and scripts, so the figures are people (the beacon only runs with JavaScript too). */
export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

/** A site path: starts with '/', no query or fragment, at most 200 characters. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/)[0].slice(0, 200);
  return /^\/[\w\-./~%@:+]*$/.test(path) ? path : null;
}

/**
 * Where an external visit came from, without its query string (which can hold
 * personal data or tracking ids): "https://www.linkedin.com/feed/". Same-site
 * and unparseable referrers return '' (direct).
 */
export function cleanReferrer(value: unknown, siteHost: string): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const bare = (h: string) =>
      h
        .toLowerCase()
        .split(':')[0]
        .replace(/^www\./, '');
    if (bare(url.hostname) === bare(siteHost)) return '';
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`.slice(0, 300);
  } catch {
    return '';
  }
}

/** Shortens text for an event property, marking the cut. Counts code points, so emoji aren't split. */
export function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('')}…`;
}
