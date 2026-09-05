/**
 * Cost guards for Sallie's public API routes (chat, speak, listen).
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
  },
  windowMs: () => envInt('SALLIE_LIMIT_WINDOW_MINUTES', 10) * 60 * 1000,
  /** Requests per route per UTC day, across all visitors. */
  perDay: {
    chat: () => envInt('SALLIE_BUDGET_CHAT_PER_DAY', 2000),
    speak: () => envInt('SALLIE_BUDGET_SPEAK_PER_DAY', 1500),
    listen: () => envInt('SALLIE_BUDGET_LISTEN_PER_DAY', 1500),
  },
  /** Visitor messages allowed in one conversation. */
  messagesPerConversation: () => envInt('SALLIE_LIMIT_MESSAGES_PER_CONVERSATION', 40),
} as const;

export type Route = 'chat' | 'speak' | 'listen';

export interface LimitResult {
  ok: boolean;
  /** Seconds until the caller may try again (only when !ok). */
  retryAfter?: number;
  reason?: 'ip' | 'day';
}

/** Best-effort client address: App Service and most proxies set x-forwarded-for. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
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
  // Trust Host, which App Service sets from the real request; a client-supplied
  // x-forwarded-host that disagrees with it is a spoof attempt.
  const host = req.headers.get('host');
  if (!host) return false;
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost && forwardedHost !== host) return false;
  const source = req.headers.get('origin') || req.headers.get('referer');
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/** For tests. */
export function trackedKeys() {
  return windows.size;
}

/** For tests. */
export function resetRateLimits() {
  windows.clear();
  daily.clear();
}
