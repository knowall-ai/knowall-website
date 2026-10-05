import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import TeamSection from '@/components/team-section';

/**
 * TeamSection tests
 *
 * Requirements: meet-the-team
 * - All five team members render, three then two on large screens
 * - Profile pictures are looked up on the relays our NIP-05 file points at
 * - Relays are untrusted: a profile only counts if it is signed by a team key
 */

const BEN = '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b';

// we can't sign as a real team member, so the positive control trusts every signature
const signatures = vi.hoisted(() => ({ trustAll: false }));
vi.mock('nostr-tools/pure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nostr-tools/pure')>();
  return {
    ...actual,
    verifyEvent: (event: Parameters<typeof actual.verifyEvent>[0]) =>
      signatures.trustAll || actual.verifyEvent(event),
  };
});

class QuietSocket {
  static urls: string[] = [];
  static instances: QuietSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(url: string) {
    QuietSocket.urls.push(url);
    QuietSocket.instances.push(this);
  }
  send() {}
  close() {}
}

// deliver an EVENT message from the first relay, as if it had answered our REQ
const relaySends = (event: object) =>
  act(() => {
    QuietSocket.instances[0].onmessage?.({
      data: JSON.stringify(['EVENT', 'team-profiles', event]),
    });
  });

describe('TeamSection', () => {
  beforeEach(() => {
    QuietSocket.urls = [];
    QuietSocket.instances = [];
    signatures.trustAll = false;
    vi.stubGlobal('WebSocket', QuietSocket);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders all five team members in a centred, wrapping row', () => {
    render(<TeamSection />);
    for (const name of [
      'Ben Weeks',
      'Valeriia Khudiakova',
      'Akash Jadhav',
      'Edit Weeks',
      'Eduardo Cortez',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    const grid = screen.getByTestId('team-grid');
    expect(grid.className).toContain('justify-center');
    expect(grid.children).toHaveLength(5);
  });

  it('asks the NIP-05 hint relays for profiles too', () => {
    render(<TeamSection />);
    expect(QuietSocket.urls).toEqual(
      expect.arrayContaining(['wss://relay.primal.net', 'wss://nostr.oxtr.dev'])
    );
  });

  it("shows the picture from a team member's signed profile", () => {
    signatures.trustAll = true;
    render(<TeamSection />);
    relaySends({
      kind: 0,
      pubkey: BEN,
      created_at: 1_800_000_000,
      tags: [],
      content: JSON.stringify({ picture: 'https://example.com/ben.png' }),
      id: '00',
      sig: '00',
    });
    expect(screen.getByRole('img', { name: 'Ben Weeks' })).toHaveAttribute(
      'src',
      'https://example.com/ben.png'
    );
  });

  it('ignores a profile claiming a team key without a valid signature', () => {
    render(<TeamSection />);
    // sign as a stranger, then relabel it as Ben: the signature no longer matches
    const forged = {
      ...finalizeEvent(
        {
          kind: 0,
          created_at: 1_800_000_000,
          tags: [],
          content: JSON.stringify({ picture: 'https://evil.example/ben.png' }),
        },
        generateSecretKey()
      ),
      pubkey: BEN,
    };
    relaySends(forged);
    expect(screen.queryByRole('img', { name: 'Ben Weeks' })).not.toBeInTheDocument();
  });

  it('ignores a validly signed profile from a key outside the team', () => {
    render(<TeamSection />);
    relaySends(
      finalizeEvent(
        {
          kind: 0,
          created_at: 1_800_000_000,
          tags: [],
          content: JSON.stringify({ picture: 'https://evil.example/stranger.png' }),
        },
        generateSecretKey()
      )
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
