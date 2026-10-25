import { ALLOWED_ORIGIN_HOSTS } from '@/lib/request-guards';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
/**
 * Cost guards for the public API routes (chat, speak, listen, contact).
 *
 * All in memory: the site runs as a single App Service instance, and a
 * limiter that resets on deploy is fine — the hard ceiling is the monthly
 * budget set on the OpenAI project, this just stops one visitor (or a
 * script) burning through it.
 *
 * Three layers:
 *  - per-IP sliding-window limits on each route
 *  - a per-UTC-day budget per route, so voice can pause while chat keeps going
 *  - per-conversation caps, enforced by the chat route from the history it's sent
 */

interface Window {
  hits: number[];
}

const MAX_TRACKED_KEYS = 5000;
const windows = new Map<string, Window>();
const daily = new Map<string, { day: string; used: number }>();

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const LIMITS = {
  /** Requests per IP per window, per route. */
  perIp: {
    chat: () => envInt('SALLIE_LIMIT_CHAT_PER_IP', 30),
    speak: () => envInt('SALLIE_LIMIT_SPEAK_PER_IP', 30),
    listen: () => envInt('SALLIE_LIMIT_LISTEN_PER_IP', 30),
    contact: () => envInt('CONTACT_LIMIT_PER_IP', 5),
    // Page-view beacon: one per page opened; generous for a reader, tight for a script
    collect: () => envInt('COLLECT_LIMIT_PER_IP', 120),
  },
  windowMs: () => envInt('SALLIE_LIMIT_WINDOW_MINUTES', 10) * 60 * 1000,
  /** Requests per route per UTC day, across all visitors. */
  perDay: {
    chat: () => envInt('SALLIE_BUDGET_CHAT_PER_DAY', 2000),
    speak: () => envInt('SALLIE_BUDGET_SPEAK_PER_DAY', 1500),
    listen: () => envInt('SALLIE_BUDGET_LISTEN_PER_DAY', 1500),
    contact: () => envInt('CONTACT_BUDGET_PER_DAY', 200),
    // Caps App Insights ingestion (about 1 KB a view) whatever the per-IP spread
    collect: () => envInt('COLLECT_BUDGET_PER_DAY', 20000),
  },
  /** Visitor messages allowed in one conversation. */
  messagesPerConversation: () => envInt('SALLIE_LIMIT_MESSAGES_PER_CONVERSATION', 40),
} as const;

export type Route = 'chat' | 'speak' | 'listen' | 'contact' | 'collect';

export interface LimitResult {
  ok: boolean;
  /** Seconds until the caller may try again (only when !ok). */
  retryAfter?: number;
  reason?: 'ip' | 'day';
}

/**
 * Best-effort client address. App Service appends the real client as the LAST
 * x-forwarded-for entry (as ip:port); anything before it was sent by the
 * client and can be forged, so it's ignored.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)!.trim();
    const v6 = /^\[([^\]]+)\](?::\d+)?$/.exec(last);
    if (v6) return v6[1];
    // Strip a port from IPv4 (one colon); leave bare IPv6 untouched.
    return /^[^:]+:\d+$/.test(last) ? last.slice(0, last.lastIndexOf(':')) : last;
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Take one unit of `route` for `ip`; false when over the per-IP or daily limit. */
export function consume(route: Route, ip: string, now = Date.now()): LimitResult {
  const windowMs = LIMITS.windowMs();
  const key = `${route}:${ip}`;
  const w = windows.get(key) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < windowMs);
  if (w.hits.length >= LIMITS.perIp[route]()) {
    windows.set(key, w);
    return { ok: false, reason: 'ip', retryAfter: Math.ceil((w.hits[0] + windowMs - now) / 1000) };
  }

  const day = new Date(now).toISOString().slice(0, 10);
  const d = daily.get(route);
  const used = d && d.day === day ? d.used : 0;
  if (used >= LIMITS.perDay[route]()) {
    const midnight = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate() + 1
    );
    return { ok: false, reason: 'day', retryAfter: Math.ceil((midnight - now) / 1000) };
  }

  w.hits.push(now);
  windows.set(key, w);
  daily.set(route, { day, used: used + 1 });
  // Keep the map bounded: drop aged-out entries, then hard-cap by evicting
  // the least recently active keys if a flood of distinct IPs is still live.
  if (windows.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of windows) {
      if (v.hits.every((t) => now - t >= windowMs)) windows.delete(k);
    }
    if (windows.size > MAX_TRACKED_KEYS) {
      const byLastHit = [...windows.entries()].sort(
        (a, b) => (a[1].hits.at(-1) ?? 0) - (b[1].hits.at(-1) ?? 0)
      );
      for (const [k] of byLastHit.slice(0, windows.size - MAX_TRACKED_KEYS)) windows.delete(k);
    }
  }
  return { ok: true };
}

/** True when the request's Origin (or Referer) is this site. Blocks lazy scripted abuse. */
export function isSameOrigin(req: Request): boolean {
  // The browser's Origin (or Referer) must name the site. Comparing it with the
  // Host header alone broke in production (v1.6.7): behind App Service the Host
  // the app sees for www.knowall.ai no longer matched, so every voice and
  // contact request was refused. Accept our known site hosts first, then fall
  // back to the old same-host check (covers local dev and preview hosts).
  const source = req.headers.get('origin') || req.headers.get('referer');
  if (!source) return false;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return false;
  }
  // Loopback origins only count when the request really is to the loopback host,
  // so a page served from a visitor's own machine can't post to the live site.
  if (LOOPBACK_HOSTS.has(sourceUrl.hostname)) {
    const host = req.headers.get('host');
    return !!host && sourceUrl.host === host;
  }
  if (ALLOWED_ORIGIN_HOSTS.has(sourceUrl.hostname)) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  // A client-supplied x-forwarded-host that disagrees with Host is a spoof attempt.
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost && forwardedHost !== host) return false;
  return sourceUrl.host === host;
}

/**
 * Failed-attempt lock-out, for credential checks (the admin logs key).
 * Unlike `consume`, only failures count: after `max` failures inside the
 * window the key is locked until the oldest of them ages out.
 */
const failures = new Map<string, number[]>();
export const FAILED_ATTEMPTS = { max: 10, windowMs: 15 * 60 * 1000 } as const;

function liveFailures(key: string, now: number): number[] {
  const hits = (failures.get(key) ?? []).filter((t) => now - t < FAILED_ATTEMPTS.windowMs);
  if (hits.length) failures.set(key, hits);
  else failures.delete(key);
  return hits;
}

/** Seconds until `key` may try again, or 0 when it isn't locked out. */
export function lockedOutFor(key: string, now = Date.now()): number {
  const hits = liveFailures(key, now);
  if (hits.length < FAILED_ATTEMPTS.max) return 0;
  return Math.max(1, Math.ceil((hits[0] + FAILED_ATTEMPTS.windowMs - now) / 1000));
}

export function recordFailure(key: string, now = Date.now()) {
  const hits = liveFailures(key, now);
  hits.push(now);
  // Re-insert so Map order tracks the most recent failure.
  failures.delete(key);
  failures.set(key, hits);
  // Bounded like `windows`: drop the least recently failing keys past the cap.
  if (failures.size > MAX_TRACKED_KEYS) {
    for (const k of [...failures.keys()].slice(0, failures.size - MAX_TRACKED_KEYS)) {
      failures.delete(k);
    }
  }
}

export function clearFailures(key: string) {
  failures.delete(key);
}

/** For tests. */
export function trackedKeys() {
  return windows.size;
}

/** For tests. */
export function resetRateLimits() {
  windows.clear();
  daily.clear();
  failures.clear();
}
