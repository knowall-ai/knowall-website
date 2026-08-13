import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchProfileMetadata, PROFILE_RELAYS, type ProfileMetadata } from '@/lib/nostr-profile';

/**
 * lib/nostr-profile tests
 *
 * Same scripted fake-WebSocket pattern as the ShopListings tests: sockets are
 * driven manually so the REQ shape, newest-event-wins resolution, and cleanup
 * behaviour are all exercised without a network.
 */

const PUBKEY = '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b';

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.closed = true;
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  emitProfileEvent(created_at: number, content: Record<string, unknown>, pubkey = PUBKEY) {
    this.emit([
      'EVENT',
      'signin-profile',
      { pubkey, created_at, content: JSON.stringify(content) },
    ]);
  }
}

describe('fetchProfileMetadata', () => {
  let received: ProfileMetadata[];
  let cancel: (() => void) | null;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    received = [];
    cancel = null;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    cancel?.();
    vi.unstubAllGlobals();
  });

  it('connects to all profile relays and sends a kind-0 filter for the author', () => {
    cancel = fetchProfileMetadata(PUBKEY, (metadata) => received.push(metadata));

    expect(FakeWebSocket.instances.map((ws) => ws.url)).toEqual(PROFILE_RELAYS);
    expect(PROFILE_RELAYS).toContain('wss://purplepag.es');

    const ws = FakeWebSocket.instances[0];
    ws.open();
    expect(ws.sent).toHaveLength(1);
    const [verb, , filter] = JSON.parse(ws.sent[0]);
    expect(verb).toBe('REQ');
    // One filter per author (purplepag.es drops authors from combined filters).
    expect(filter).toEqual({ kinds: [0], authors: [PUBKEY] });
  });

  it('reports the newest profile event and ignores older ones, across relays', () => {
    cancel = fetchProfileMetadata(PUBKEY, (metadata) => received.push(metadata));
    const [damus, nos] = FakeWebSocket.instances;
    damus.open();
    nos.open();

    nos.emitProfileEvent(200, { name: 'Newest' });
    damus.emitProfileEvent(100, { name: 'Stale' }); // older — ignored
    damus.emitProfileEvent(300, { name: 'Newer still' });

    expect(received.map((p) => p.name)).toEqual(['Newest', 'Newer still']);
  });

  it('ignores events from other pubkeys and malformed messages', () => {
    cancel = fetchProfileMetadata(PUBKEY, (metadata) => received.push(metadata));
    const ws = FakeWebSocket.instances[0];
    ws.open();

    ws.emitProfileEvent(100, { name: 'Impostor' }, 'f'.repeat(64));
    ws.onmessage?.({ data: 'not json' });
    ws.emit(['EVENT', 'signin-profile', { pubkey: PUBKEY, created_at: 50, content: '{broken' }]);

    expect(received).toEqual([]);
  });

  it('closes the socket on EOSE and all sockets on cancel', () => {
    cancel = fetchProfileMetadata(PUBKEY, (metadata) => received.push(metadata));
    const [damus, nos, purple] = FakeWebSocket.instances;
    [damus, nos, purple].forEach((ws) => ws.open());

    damus.emit(['EOSE', 'signin-profile']);
    expect(damus.closed).toBe(true);
    expect(nos.closed).toBe(false);

    cancel();
    cancel = null;
    expect(nos.closed).toBe(true);
    expect(purple.closed).toBe(true);
  });

  it('skips relays whose socket constructor throws', () => {
    let calls = 0;
    class ThrowingFirstWebSocket extends FakeWebSocket {
      constructor(url: string) {
        if (calls++ === 0) throw new Error('blocked');
        super(url);
      }
    }
    vi.stubGlobal('WebSocket', ThrowingFirstWebSocket);

    cancel = fetchProfileMetadata(PUBKEY, (metadata) => received.push(metadata));
    // First relay threw; the remaining two still connect and answer.
    expect(FakeWebSocket.instances).toHaveLength(2);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.emitProfileEvent(100, { name: 'Ben' });
    expect(received.map((p) => p.name)).toEqual(['Ben']);
  });
});
