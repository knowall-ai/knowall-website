import { createHmac, randomBytes } from 'node:crypto';

/**
 * Cookieless, anonymous visitor counting (the approach Plausible and Fathom use).
 *
 * Nothing is stored on the visitor's device, so PECR needs no consent banner.
 * A visitor is a keyed hash of their address and browser, with a key that
 * changes every UTC day, so the same person can't be followed from one day to
 * the next and the hash can't be turned back into an address. The address
 * itself is only held in memory for the hash.
 *
 * Set ANALYTICS_SALT on the App Service so every instance (and a restart) uses
 * the same daily key; without it each process makes a random one, which only
 * means a visitor may be counted twice on a day the site restarts.
 */

let processSecret: string | null = null;
function secret(): string {
  const configured = process.env.ANALYTICS_SALT?.trim();
  if (configured) return configured;
  processSecret ??= randomBytes(32).toString('hex');
  return processSecret;
}

/** The UTC day, e.g. 2026-10-24: the key rotates when it changes. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** A 16-hex-character id for this address and browser, on this UTC day only. */
export function visitorId(ip: string, userAgent: string, now = new Date()): string {
  const dayKey = createHmac('sha256', secret()).update(utcDay(now)).digest();
  return createHmac('sha256', dayKey).update(`${ip}|${userAgent}`).digest('hex').slice(0, 16);
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

/** Shortens text for an event property, marking the cut. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
