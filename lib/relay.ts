/**
 * Minimal browser-side Nostr relay client — the same raw-WebSocket pattern the
 * story feed uses (components/story-feed.tsx), factored out so comments,
 * follows and zaps can share it. Query fans a REQ out to every relay and
 * merges the results; publish fans an EVENT out and resolves as soon as one
 * relay accepts it.
 */

import type { NostrEvent } from './story-notes';

/** General-purpose relays the story page reads from and publishes to. */
export const SOCIAL_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];

/** Relays used for kind-0 profile lookups; purplepag.es is a profile aggregator. */
export const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es'];

const DEFAULT_TIMEOUT_MS = 8000;

export interface NostrFilter {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  limit?: number;
  [key: `#${string}`]: string[] | undefined;
}

export interface RelayQueryResult {
  events: NostrEvent[];
  /**
   * How many relays answered authoritatively (sent EOSE). Zero means every
   * relay was unreachable, errored, or timed out — an empty `events` is then
   * "couldn't ask", not "asked and nothing exists".
   */
  respondedRelays: number;
}

/**
 * Fetch events matching `filters` from every relay (one REQ per relay carrying
 * all filters), deduplicated by event id, reporting how many relays completed
 * with EOSE. Resolves once every relay has sent EOSE, errored, or timed out —
 * it never rejects; unreachable relays just contribute nothing.
 */
export function queryRelaysDetailed(
  relays: string[],
  filters: NostrFilter[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<RelayQueryResult> {
  return new Promise((resolve) => {
    const events = new Map<string, NostrEvent>();
    let settled = 0;
    let responded = 0;

    const settle = (ok: boolean) => {
      settled += 1;
      if (ok) responded += 1;
      if (settled === relays.length) {
        resolve({ events: [...events.values()], respondedRelays: responded });
      }
    };

    if (relays.length === 0) {
      resolve({ events: [], respondedRelays: 0 });
      return;
    }

    for (const url of relays) {
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        settle(false);
        continue;
      }

      let done = false;
      const complete = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // Already closed.
        }
        settle(ok);
      };
      const timer = setTimeout(() => complete(false), timeoutMs);

      const subscriptionId = `q${Math.random().toString(36).slice(2, 10)}`;
      socket.onopen = () => {
        socket.send(JSON.stringify(['REQ', subscriptionId, ...filters]));
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data as string) as [string, ...unknown[]];
          if (data[0] === 'EVENT' && data[2] && typeof data[2] === 'object') {
            const event = data[2] as NostrEvent;
            if (typeof event.id === 'string') events.set(event.id, event);
          } else if (data[0] === 'EOSE') {
            complete(true);
          }
        } catch {
          // Ignore malformed relay messages.
        }
      };
      socket.onerror = () => complete(false);
      socket.onclose = () => complete(false);
    }
  });
}

/** `queryRelaysDetailed` for callers that only need the merged events. */
export function queryRelays(
  relays: string[],
  filters: NostrFilter[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<NostrEvent[]> {
  return queryRelaysDetailed(relays, filters, timeoutMs).then((result) => result.events);
}

/**
 * Publish a signed event to every relay. Resolves as soon as ANY relay accepts
 * it (["OK", id, true]); rejects only when every relay fails, rejects it, or
 * times out.
 */
export function publishToRelays(
  relays: string[],
  event: NostrEvent,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let accepted = false;
    let settled = 0;
    let lastReason = 'No relay accepted the event.';

    const settle = (ok: boolean, reason?: string) => {
      if (ok && !accepted) {
        accepted = true;
        resolve();
      }
      if (reason) lastReason = reason;
      settled += 1;
      if (settled === relays.length && !accepted) reject(new Error(lastReason));
    };

    if (relays.length === 0) {
      reject(new Error('No relays configured.'));
      return;
    }

    for (const url of relays) {
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        settle(false, `Could not connect to ${url}.`);
        continue;
      }

      let done = false;
      const complete = (ok: boolean, reason?: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // Already closed.
        }
        settle(ok, reason);
      };
      const timer = setTimeout(() => complete(false, `Timed out waiting for ${url}.`), timeoutMs);

      socket.onopen = () => {
        socket.send(JSON.stringify(['EVENT', event]));
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data as string) as [string, string, boolean, string?];
          if (data[0] === 'OK' && data[1] === event.id) {
            complete(
              data[2] === true,
              data[2] === true ? undefined : data[3] || 'Relay rejected the event.'
            );
          }
        } catch {
          // Ignore malformed relay messages.
        }
      };
      socket.onerror = () => complete(false, `Connection to ${url} failed.`);
      socket.onclose = () => complete(false);
    }
  });
}
