/**
 * Raw-WebSocket fetch of a pubkey's kind-0 (profile metadata) event from the
 * public relays, newest event wins. Same relay set and socket handling as
 * components/team-section.tsx and hooks/use-nostr-profile.ts — this is the
 * transport those can be unified onto (the hook adds static-fallback
 * resolution on top; this module is deliberately just the fetch).
 */

// purplepag.es is a dedicated profile aggregator; the others are general-purpose relays.
export const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es'];

const RELAY_TIMEOUT_MS = 10000;

/** Raw kind-0 metadata fields used by the sign-in chip. */
export interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
}

/**
 * Subscribe to the newest kind-0 event for `pubkey` across PROFILE_RELAYS.
 * `onMetadata` fires once per event that is newer than anything seen so far
 * (so the newest profile wins even when relays answer out of order). Returns
 * a cancel function that closes the sockets; sockets also self-close on EOSE
 * and are force-closed after a timeout.
 */
export function fetchProfileMetadata(
  pubkey: string,
  onMetadata: (metadata: ProfileMetadata) => void
): () => void {
  let newest = 0;
  const sockets: WebSocket[] = [];

  for (const relay of PROFILE_RELAYS) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(relay);
    } catch {
      continue;
    }
    sockets.push(ws);

    // One filter per author: some relays (e.g. purplepag.es) drop authors from
    // a combined filter. A single author here, but keep the shape explicit.
    ws.onopen = () =>
      ws.send(JSON.stringify(['REQ', 'signin-profile', { kinds: [0], authors: [pubkey] }]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        if (data[0] === 'EVENT' && data[2]?.pubkey === pubkey) {
          const event = data[2];
          if (event.created_at > newest) {
            newest = event.created_at;
            onMetadata(JSON.parse(event.content) as ProfileMetadata);
          }
        } else if (data[0] === 'EOSE') {
          ws.close();
        }
      } catch {
        // Ignore malformed relay messages.
      }
    };
  }

  // Closing a socket that is still CONNECTING logs "WebSocket is closed before
  // the connection is established" (React StrictMode double-invokes effects in
  // dev, so cancel can run while the sockets are still opening). For a
  // connecting socket, replace the REQ-sending open handler so it closes
  // cleanly the moment it connects; a relay that never connects is force-closed
  // by the backstop below.
  const closeSocket = (ws: WebSocket) => {
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.onopen = () => ws.close();
      setTimeout(() => {
        try {
          ws.close();
        } catch {
          // Already closed.
        }
      }, 2000);
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
  const closeAll = () =>
    sockets.forEach((ws) => {
      try {
        closeSocket(ws);
      } catch {
        // Already closed.
      }
    });
  const timeout = setTimeout(closeAll, RELAY_TIMEOUT_MS);
  return () => {
    clearTimeout(timeout);
    closeAll();
  };
}
