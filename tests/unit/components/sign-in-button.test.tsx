import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as nip19 from 'nostr-tools/nip19';
import SignInButton from '@/components/auth/sign-in-button';
import { NostrAuthProvider } from '@/components/auth/nostr-auth-provider';

/**
 * SignInButton tests — the signed-in account chip and its fallback chain.
 *
 * Sign-in is driven through a stubbed NIP-07 extension (window.nostr) and the
 * relay layer through a scripted fake WebSocket that answers the kind-0 REQ,
 * so the full sign-in → profile fetch → chip render pipeline runs without a
 * network. Fallbacks under test:
 *
 *   picture:  profile picture (https) → initial avatar (none/invalid/broken)
 *   name:     display_name → name → truncated npub
 *   dropdown: nip05 → truncated npub
 *
 * lib/nostr-profiles caches lookups (including misses) for the module's
 * lifetime, so every test signs in with its own unique pubkey.
 */

const PUBKEY_BASE = '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b';

let testIndex = 0;
let currentPubkey = PUBKEY_BASE;
let scriptedProfiles: Array<{ created_at: number; content: Record<string, unknown> }> = [];

/** The chip's truncated form of the current test pubkey's npub. */
function truncatedNpub(): string {
  const npub = nip19.npubEncode(currentPubkey);
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => this.onopen?.());
  }

  send(payload: string) {
    const subscriptionId = JSON.parse(payload)[1] as string;
    queueMicrotask(() => {
      for (const profile of scriptedProfiles) {
        this.onmessage?.({
          data: JSON.stringify([
            'EVENT',
            subscriptionId,
            {
              id: `${profile.created_at}`.padStart(64, '0'),
              pubkey: currentPubkey,
              kind: 0,
              created_at: profile.created_at,
              content: JSON.stringify(profile.content),
            },
          ]),
        });
      }
      this.onmessage?.({ data: JSON.stringify(['EOSE', subscriptionId]) });
    });
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

function renderSignInButton() {
  return render(
    <NostrAuthProvider>
      <SignInButton />
    </NostrAuthProvider>
  );
}

/** Click through the sign-in dialog and wait for the account chip. Assumes the
 *  button is already rendered (renderSignInButton). */
async function signIn() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with extension' }));
  return await screen.findByTestId('nostr-account-menu');
}

/** Render + sign in, in one go — what most tests need. */
async function renderSignedIn() {
  renderSignInButton();
  return await signIn();
}

/** Radix dropdown triggers open on pointerdown. */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

describe('SignInButton', () => {
  beforeEach(() => {
    // Unique pubkey per test: lib/nostr-profiles caches per-pubkey results
    // (including misses) for the module's lifetime.
    testIndex += 1;
    currentPubkey = PUBKEY_BASE.slice(0, 62) + testIndex.toString(16).padStart(2, '0');
    scriptedProfiles = [];
    window.localStorage.clear();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    window.nostr = { getPublicKey: vi.fn().mockResolvedValue(currentPubkey) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.nostr;
  });

  it('shows the profile picture and display name after sign-in', async () => {
    scriptedProfiles = [
      {
        created_at: 100,
        content: {
          name: 'benweeks',
          display_name: 'Ben Weeks',
          picture: 'https://example.com/ben.jpg',
          nip05: 'ben@knowall.ai',
        },
      },
    ];

    const chip = await renderSignedIn();

    expect(await screen.findByText('Ben Weeks')).toBeInTheDocument();
    const avatar = chip.querySelector('img');
    expect(avatar).toHaveAttribute('src', 'https://example.com/ben.jpg');
  });

  it('shows the newest profile when relays return multiple kind-0 events', async () => {
    scriptedProfiles = [
      { created_at: 200, content: { display_name: 'Ben (current)' } },
      { created_at: 100, content: { display_name: 'Ben (stale)' } },
    ];

    await renderSignedIn();

    expect(await screen.findByText('Ben (current)')).toBeInTheDocument();
    expect(screen.queryByText('Ben (stale)')).not.toBeInTheDocument();
  });

  it('falls back to name when the profile has no display_name', async () => {
    scriptedProfiles = [{ created_at: 100, content: { name: 'benweeks' } }];

    await renderSignedIn();

    expect(await screen.findByText('benweeks')).toBeInTheDocument();
  });

  it('falls back to the truncated npub and initial avatar when no profile is found', async () => {
    const chip = await renderSignedIn();

    expect(await screen.findByText(truncatedNpub())).toBeInTheDocument();
    expect(chip.querySelector('img')).toBeNull();
    expect(chip).toHaveTextContent('N'); // initial avatar
  });

  it('keeps the initial avatar when the profile picture is not https', async () => {
    scriptedProfiles = [
      { created_at: 100, content: { name: 'Ben', picture: 'http://example.com/ben.jpg' } },
    ];

    const chip = await renderSignedIn();

    expect(await screen.findByText('Ben')).toBeInTheDocument();
    expect(chip.querySelector('img')).toBeNull();
    expect(chip).toHaveTextContent('B');
  });

  it('falls back to the initial avatar when the profile picture fails to load', async () => {
    scriptedProfiles = [
      { created_at: 100, content: { name: 'Ben', picture: 'https://example.com/broken.jpg' } },
    ];

    const chip = await renderSignedIn();
    await screen.findByText('Ben');
    const avatar = chip.querySelector('img');
    expect(avatar).not.toBeNull();

    fireEvent.error(avatar!);

    expect(chip.querySelector('img')).toBeNull();
    expect(chip).toHaveTextContent('B');
  });

  it('shows the nip05 in the account dropdown when the profile has one', async () => {
    scriptedProfiles = [
      { created_at: 100, content: { display_name: 'Ben Weeks', nip05: 'ben@knowall.ai' } },
    ];

    const chip = await renderSignedIn();
    await screen.findByText('Ben Weeks');
    openDropdown(chip);

    expect(await screen.findByText('ben@knowall.ai')).toBeInTheDocument();
  });

  it('shows the truncated npub in the dropdown when the profile has no nip05', async () => {
    scriptedProfiles = [{ created_at: 100, content: { display_name: 'Ben Weeks' } }];

    const chip = await renderSignedIn();
    await screen.findByText('Ben Weeks');
    openDropdown(chip);

    expect(await screen.findByText(truncatedNpub())).toBeInTheDocument();
  });

  it('caches the profile so a fresh mount renders it without a relay round-trip', async () => {
    scriptedProfiles = [
      {
        created_at: 100,
        content: { display_name: 'Ben Weeks', picture: 'https://example.com/ben.jpg' },
      },
    ];

    const { unmount } = renderSignInButton();
    await signIn();
    await screen.findByText('Ben Weeks');
    unmount();

    // Remount with the relays returning nothing: the cached profile renders.
    scriptedProfiles = [];
    renderSignInButton();

    expect(await screen.findByText('Ben Weeks')).toBeInTheDocument();
    expect(screen.getByTestId('nostr-account-menu').querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/ben.jpg'
    );
  });

  it('signs out from the dropdown and returns to the Sign In button', async () => {
    const chip = await renderSignedIn();
    openDropdown(chip);

    fireEvent.click(await screen.findByText('Sign out'));

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(window.localStorage.getItem('knowall.nostr.pubkey')).toBeNull();
    expect(window.localStorage.getItem('knowall.nostr.profile')).toBeNull();
  });
});
