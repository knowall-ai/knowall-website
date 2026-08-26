'use client';

/**
 * Client-side hooks for the shop owner UI: owner detection, catalog fetching,
 * and the sign-and-publish path. Event construction lives in lib/shop-admin
 * (pure, unit-tested); signing happens in the owner's NIP-07 extension via
 * the auth provider; publishing fans out to the shop relays.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import { publishToRelays, queryRelays } from '@/lib/relay';
import { dedupeByDTag, getDTag, isShopOwner } from '@/lib/shop-admin';
import type { NostrEvent } from '@/lib/story-notes';
import type { EventTemplate } from '@/lib/story-social';

/**
 * True when the signed-in user is the store owner (the KnowAll AI npub).
 *
 * Development-only escape hatch for UI review without the company key:
 * `?ownerPreview=1` on `next dev` shows the owner controls (publishing still
 * requires a real signature, so nothing can actually be written). The check
 * is compiled out of production builds via NODE_ENV.
 */
export function useShopOwner(): boolean {
  const { user } = useNostrAuth();
  const [devPreview, setDevPreview] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    setDevPreview(new URLSearchParams(window.location.search).has('ownerPreview'));
  }, []);

  return isShopOwner(user?.pubkey) || devPreview;
}

/**
 * Sign an event template with the owner's extension and publish it to the
 * shop relays. Resolves with the signed event once any relay accepts it.
 */
export function useShopPublish(): (template: EventTemplate) => Promise<NostrEvent> {
  const { signEvent } = useNostrAuth();
  return useCallback(
    async (template: EventTemplate) => {
      const signed = await signEvent(template);
      await publishToRelays(SHOP_RELAYS, signed);
      return signed;
    },
    [signEvent]
  );
}

/**
 * The latest version of one of the owner's addressable events, fetched fresh
 * from the relays. Edit flows call this right before opening the form so a
 * merge-republish never starts from a stale version.
 */
export async function fetchLatestOwnerEvent(
  kind: number,
  dTag: string
): Promise<NostrEvent | null> {
  const events = await queryRelays(SHOP_RELAYS, [
    { kinds: [kind], authors: [KNOWALL_PUBKEY], '#d': [dTag], limit: 10 },
  ]);
  const usable = events.filter(
    (event) => event.kind === kind && event.pubkey === KNOWALL_PUBKEY && getDTag(event) === dTag
  );
  return dedupeByDTag(usable)[0] ?? null;
}

export interface OwnerCatalog {
  /** Newest event per d-tag, or null while loading. */
  events: NostrEvent[] | null;
  /** Optimistically insert/replace an event after a successful publish. */
  upsert: (event: NostrEvent) => void;
  /** Optimistically drop an event after a successful deletion request. */
  remove: (dTag: string) => void;
}

/**
 * The owner's catalog of one addressable kind (products 30402, collections
 * 30405, shipping zones 30406): newest event per d-tag from the shop relays,
 * with optimistic local updates so dialogs reflect saves/deletes immediately
 * instead of waiting for relay propagation.
 */
export function useOwnerCatalog(kind: number): OwnerCatalog {
  const [events, setEvents] = useState<NostrEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    queryRelays(SHOP_RELAYS, [{ kinds: [kind], authors: [KNOWALL_PUBKEY], limit: 100 }]).then(
      (fetched) => {
        if (!active) return;
        setEvents(
          dedupeByDTag(
            fetched.filter((event) => event.kind === kind && event.pubkey === KNOWALL_PUBKEY)
          )
        );
      }
    );
    return () => {
      active = false;
    };
  }, [kind]);

  const upsert = useCallback(
    (event: NostrEvent) => setEvents((prev) => dedupeByDTag([...(prev ?? []), event])),
    []
  );
  const remove = useCallback(
    (dTag: string) => setEvents((prev) => (prev ?? []).filter((event) => getDTag(event) !== dTag)),
    []
  );

  return { events, upsert, remove };
}
