'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as nip19 from 'nostr-tools/nip19';
import { fetchProfileMetadata, type ProfileMetadata } from '@/lib/nostr-profile';

// Minimal NIP-07 surface — we only need the public key for sign-in.
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
    };
  }
}

const PUBKEY_STORAGE_KEY = 'knowall.nostr.pubkey';
const PROFILE_STORAGE_KEY = 'knowall.nostr.profile';

export interface NostrProfile {
  /** Display name from the user's kind-0 metadata (display_name, then name). */
  name?: string;
  /** Avatar URL from the user's kind-0 metadata (https only). */
  picture?: string;
  /** NIP-05 identifier (e.g. ben@knowall.ai) from the user's kind-0 metadata. */
  nip05?: string;
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

/** Map raw kind-0 metadata to the profile shape the UI consumes. */
function toProfile(metadata: ProfileMetadata): NostrProfile {
  const name = metadata.display_name || metadata.name;
  return {
    name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
    // Only trust https avatar URLs; anything else keeps the initial fallback.
    picture:
      typeof metadata.picture === 'string' && metadata.picture.startsWith('https://')
        ? metadata.picture
        : undefined,
    nip05:
      typeof metadata.nip05 === 'string' && metadata.nip05.trim()
        ? metadata.nip05.trim()
        : undefined,
  };
}

/** Read the cached profile for a pubkey, if one was persisted. */
function readCachedProfile(pubkey: string): NostrProfile | undefined {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as { pubkey?: string; profile?: ProfileMetadata };
    if (cached.pubkey !== pubkey || !cached.profile) return undefined;
    return toProfile(cached.profile);
  } catch {
    // Unreadable cache — refetch from the relays instead.
    return undefined;
  }
}

/**
 * Client-side Nostr authentication context. Sign-in is NIP-07 only for now
 * (browser extension such as Alby or nos2x); the pubkey is persisted in
 * localStorage so the session survives reloads, and the user's kind-0
 * profile (name/picture/nip05) is fetched from the public relays in the
 * background — raw-WebSocket, newest event wins, same as the team section —
 * then cached alongside the pubkey so reloads render it instantly.
 *
 * A scoped, dependency-light take on Robotechy's LoginArea/AccountSwitcher —
 * nsec and bunker:// logins are a planned follow-up.
 */
export function NostrAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NostrUser | null>(null);
  const cancelFetchRef = useRef<(() => void) | null>(null);

  // Fetch the profile from the relays and attach it to the user — unless the
  // user signed out or switched identity while the lookup was in flight. The
  // fetched metadata is cached so the next page load doesn't start from "N".
  const loadProfile = useCallback((pubkey: string) => {
    cancelFetchRef.current?.();
    cancelFetchRef.current = fetchProfileMetadata(pubkey, (metadata) => {
      const profile = toProfile(metadata);
      setUser((current) =>
        current && current.pubkey === pubkey ? { ...current, profile } : current
      );
      try {
        window.localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify({ pubkey, profile: metadata })
        );
      } catch {
        // Cache is best-effort; the in-memory profile still works.
      }
    });
  }, []);

  // Restore a persisted session on first load: cached profile renders
  // immediately, then a background relay fetch picks up any newer profile.
  useEffect(() => {
    let pubkey: string | null = null;
    try {
      pubkey = window.localStorage.getItem(PUBKEY_STORAGE_KEY);
    } catch {
      return; // localStorage unavailable (privacy mode) — stay signed out.
    }
    if (!pubkey || !isValidPubkey(pubkey)) return;

    setUser({ pubkey, npub: nip19.npubEncode(pubkey), profile: readCachedProfile(pubkey) });
    loadProfile(pubkey);
  }, [loadProfile]);

  // Close any in-flight relay sockets when the provider unmounts.
  useEffect(() => () => cancelFetchRef.current?.(), []);

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

    setUser({ pubkey, npub: nip19.npubEncode(pubkey), profile: readCachedProfile(pubkey) });
    loadProfile(pubkey);
  }, [loadProfile]);

  const signOut = useCallback(() => {
    cancelFetchRef.current?.();
    cancelFetchRef.current = null;
    try {
      window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // Ignore — nothing was persisted.
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <NostrAuthContext.Provider value={value}>{children}</NostrAuthContext.Provider>;
}
