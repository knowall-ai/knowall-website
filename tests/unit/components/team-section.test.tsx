import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamSection from '@/components/team-section';

/**
 * TeamSection tests
 *
 * Requirements: meet-the-team
 * - All four team members render, four across on large screens
 * - Profile pictures are looked up on the relays our NIP-05 file points at
 */

class QuietSocket {
  static urls: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(url: string) {
    QuietSocket.urls.push(url);
  }
  send() {}
  close() {}
}

describe('TeamSection', () => {
  beforeEach(() => {
    QuietSocket.urls = [];
    vi.stubGlobal('WebSocket', QuietSocket);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders all four team members in a four-column grid', () => {
    render(<TeamSection />);
    for (const name of ['Ben Weeks', 'Valeriia Khudiakova', 'Akash Jadhav', 'Edit Weeks']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    const grid = screen.getByTestId('team-grid');
    expect(grid.className).toContain('lg:grid-cols-4');
    expect(grid.children).toHaveLength(4);
  });

  it('asks the NIP-05 hint relays for profiles too', () => {
    render(<TeamSection />);
    expect(QuietSocket.urls).toEqual(
      expect.arrayContaining(['wss://relay.primal.net', 'wss://nostr.oxtr.dev'])
    );
  });
});
