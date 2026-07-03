'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import * as nip19 from 'nostr-tools/nip19';

// Minimal NIP-07 surface — we only need the public key for sign-in.
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
    };
  }
}

const PUBKEY_STORAGE_KEY = 'knowall.nostr.pubkey';

// Public relays used to look up the signed-in user's kind-0 profile. Same
// pool-based approach as lib/nostr-contact.ts (which publishes the contact DM).
export const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];

const PROFILE_FETCH_TIMEOUT_MS = 5000;

export interface NostrProfile {
  /** Display name from the user's kind-0 metadata (display_name, then name). */
  name?: string;
  /** Avatar URL from the user's kind-0 metadata. */
  picture?: string;
}

export interface NostrUser {
  /** Hex public key as returned by the NIP-07 extension. */
  pubkey: string;
  /** Bech32 npub encoding of the pubkey (for njump.me links, display). */
  npub: string;
  /** Kind-0 profile, populated asynchronously after sign-in / restore. */
  profile?: NostrProfile;
}

interface NostrAuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: NostrUser | null;
  /** Sign in via a NIP-07 browser extension. Rejects if none is installed. */
  signIn: () => Promise<void>;
  /** Sign out and forget the persisted pubkey. */
  signOut: () => void;
}

const NostrAuthContext = createContext<NostrAuthContextValue | null>(null);

export function useNostrAuth(): NostrAuthContextValue {
  const context = useContext(NostrAuthContext);
  if (!context) {
    throw new Error('useNostrAuth must be used within a NostrAuthProvider');
  }
  return context;
}

const isValidPubkey = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);

/**
 * Fetch the newest kind-0 (profile metadata) event for a pubkey from the
 * public relays. Returns undefined when nothing is found or the relays don't
 * answer in time — sign-in still succeeds, we just fall back to the npub.
 */
async function fetchProfile(pubkey: string): Promise<NostrProfile | undefined> {
  const pool = new SimplePool();
  try {
    const event = await Promise.race([
      pool.get(PROFILE_RELAYS, { kinds: [0], authors: [pubkey] }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS)),
    ]);
    if (!event) return undefined;

    const metadata = JSON.parse(event.content) as Record<string, unknown>;
    const name = metadata.display_name || metadata.name;
    return {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      picture: typeof metadata.picture === 'string' ? metadata.picture : undefined,
    };
  } catch {
    // Malformed profile JSON or relay errors — not fatal for sign-in.
    return undefined;
  } finally {
    pool.close(PROFILE_RELAYS);
  }
}

/**
 * Client-side Nostr authentication context. Sign-in is NIP-07 only for now
 * (browser extension such as Alby or nos2x); the pubkey is persisted in
 * localStorage so the session survives reloads, and the user's kind-0
 * profile (name/picture) is fetched from public relays in the background.
 *
 * A scoped, dependency-light take on Robotechy's LoginArea/AccountSwitcher —
 * nsec and bunker:// logins are a planned follow-up.
 */
export function NostrAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NostrUser | null>(null);

  // Attach the profile to the user once fetched — unless the user signed out
  // or switched identity while the relay lookup was in flight.
  const loadProfile = useCallback((pubkey: string) => {
    void fetchProfile(pubkey).then((profile) => {
      if (!profile) return;
      setUser((current) =>
        current && current.pubkey === pubkey ? { ...current, profile } : current
      );
    });
  }, []);

  // Restore a persisted session on first load.
  useEffect(() => {
    let pubkey: string | null = null;
    try {
      pubkey = window.localStorage.getItem(PUBKEY_STORAGE_KEY);
    } catch {
      return; // localStorage unavailable (privacy mode) — stay signed out.
    }
    if (!pubkey || !isValidPubkey(pubkey)) return;

    setUser({ pubkey, npub: nip19.npubEncode(pubkey) });
    loadProfile(pubkey);
  }, [loadProfile]);

  const signIn = useCallback(async () => {
    if (typeof window === 'undefined' || !window.nostr) {
      throw new Error(
        'No Nostr extension found. Install a NIP-07 extension such as Alby or nos2x, then try again.'
      );
    }

    const pubkey = await window.nostr.getPublicKey();
    if (!isValidPubkey(pubkey)) {
      throw new Error('The extension returned an invalid public key.');
    }

    try {
      window.localStorage.setItem(PUBKEY_STORAGE_KEY, pubkey);
    } catch {
      // Persistence is best-effort; the in-memory session still works.
    }

    setUser({ pubkey, npub: nip19.npubEncode(pubkey) });
    loadProfile(pubkey);
  }, [loadProfile]);

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
    } catch {
      // Ignore — nothing was persisted.
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <NostrAuthContext.Provider value={value}>{children}</NostrAuthContext.Provider>;
}
