import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
 */

const PUBKEY = '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b';
const TRUNCATED_NPUB = 'npub1jutp…f04x';

let scriptedProfiles: Array<{ created_at: number; content: Record<string, unknown> }> = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => this.onopen?.());
  }

  send(_data: string) {
    queueMicrotask(() => {
      for (const profile of scriptedProfiles) {
        this.onmessage?.({
          data: JSON.stringify([
            'EVENT',
            'signin-profile',
            {
              pubkey: PUBKEY,
              created_at: profile.created_at,
              content: JSON.stringify(profile.content),
            },
          ]),
        });
      }
      this.onmessage?.({ data: JSON.stringify(['EOSE', 'signin-profile']) });
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
    scriptedProfiles = [];
    window.localStorage.clear();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    window.nostr = { getPublicKey: vi.fn().mockResolvedValue(PUBKEY) };
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

  it('falls back to name when the profile has no display_name', async () => {
    scriptedProfiles = [{ created_at: 100, content: { name: 'benweeks' } }];

    await renderSignedIn();

    expect(await screen.findByText('benweeks')).toBeInTheDocument();
  });

  it('falls back to the truncated npub and initial avatar when no profile is found', async () => {
    const chip = await renderSignedIn();

    expect(await screen.findByText(TRUNCATED_NPUB)).toBeInTheDocument();
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

    expect(await screen.findByText(TRUNCATED_NPUB)).toBeInTheDocument();
  });

  it('caches the profile so a fresh mount renders it without a relay fetch', async () => {
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
