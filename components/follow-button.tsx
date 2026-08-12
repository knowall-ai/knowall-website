'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { KNOWALL_NPUB, KNOWALL_PUBKEY } from '@/lib/nostr';
import { SOCIAL_RELAYS, publishToRelays, queryRelays } from '@/lib/relay';
import { addFollow, isFollowing } from '@/lib/story-social';
import type { NostrEvent } from '@/lib/story-notes';

const NJUMP_URL = `https://njump.me/${KNOWALL_NPUB}`;

/**
 * "Follow us on Nostr", with a real follow for signed-in users: fetch their
 * current kind-3 contact list from the relays, append the KnowAll `p` tag,
 * and publish the updated list through their NIP-07 signer. Mirrors the
 * FollowMeButton on edenweeks.art.
 *
 * kind-3 is destructive if mishandled — publishing a partial list erases the
 * user's follows — so the button only ever publishes on top of a list it
 * actually fetched. When the fetch fails or finds no contact list at all, it
 * falls back to the njump deep-link (with a tooltip explaining why) instead
 * of guessing. Signed-out users keep the deep-link behaviour.
 */
export default function FollowButton() {
  const { user, signEvent } = useNostrAuth();
  const [contactList, setContactList] = useState<NostrEvent | null | undefined>(undefined);
  const [justFollowed, setJustFollowed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once a follow attempt couldn't get a trustworthy contact list; the
  // button then falls back to the safe njump deep-link.
  const [fallbackToNjump, setFallbackToNjump] = useState(false);
  // In-flight guard covering the whole read-then-publish operation, so rapid
  // clicks can't start concurrent follows that clobber each other.
  const followInFlightRef = useRef(false);

  const fetchContactList = useCallback(async (pubkey: string): Promise<NostrEvent | null> => {
    const events = await queryRelays(SOCIAL_RELAYS, [{ kinds: [3], authors: [pubkey], limit: 1 }]);
    let newest: NostrEvent | null = null;
    for (const event of events) {
      if (event.kind !== 3 || event.pubkey !== pubkey) continue;
      if (!newest || event.created_at > newest.created_at) newest = event;
    }
    return newest;
  }, []);

  // Read the signed-in user's kind-3 on mount so the button can show
  // "Following" straight away. Reset all state on account switch/sign-out.
  useEffect(() => {
    setContactList(undefined);
    setJustFollowed(false);
    setError(null);
    setFallbackToNjump(false);
    if (!user) return;
    let cancelled = false;
    void fetchContactList(user.pubkey).then((event) => {
      if (!cancelled) setContactList(event);
    });
    return () => {
      cancelled = true;
    };
  }, [user, fetchContactList]);

  const following =
    justFollowed || (!!contactList && isFollowing(contactList.tags, KNOWALL_PUBKEY));

  const handleFollow = async () => {
    if (!user || followInFlightRef.current) return;
    followInFlightRef.current = true;
    setIsPublishing(true);
    setError(null);
    try {
      // Re-read the freshest kind-3 at click time so follows added since page
      // load are never clobbered. Only a successfully fetched list may be
      // published on — a user with follows whose list we can't see would
      // otherwise get their follows wiped.
      let base: NostrEvent | null = null;
      try {
        base = await fetchContactList(user.pubkey);
      } catch {
        base = null;
      }
      base = base ?? contactList ?? null;

      if (!base) {
        setFallbackToNjump(true);
        return;
      }

      if (isFollowing(base.tags, KNOWALL_PUBKEY)) {
        setContactList(base);
        setJustFollowed(true);
        return;
      }

      const signed = await signEvent({
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        // Preserve the relay-list JSON some clients store in kind-3 content.
        content: base.content,
        tags: addFollow(base.tags, KNOWALL_PUBKEY),
      });
      await publishToRelays(SOCIAL_RELAYS, signed);
      setContactList(signed);
      setJustFollowed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your follow list.');
    } finally {
      setIsPublishing(false);
      followInFlightRef.current = false;
    }
  };

  // Signed out — the plain njump deep-link, exactly as before. Also the safe
  // fallback when the user's contact list couldn't be fetched.
  if (!user || fallbackToNjump) {
    return (
      <Button
        asChild
        size="sm"
        className="bg-lime-600 hover:bg-lime-700 text-white"
        data-testid="story-follow-button"
      >
        <a
          href={NJUMP_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={
            fallbackToNjump
              ? "We couldn't load your follow list, so we can't update it safely from here. This opens our profile on njump, where following is always safe."
              : undefined
          }
        >
          Follow us on Nostr
        </a>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        onClick={following ? undefined : handleFollow}
        disabled={isPublishing}
        aria-pressed={following}
        data-testid="story-follow-button"
        className={
          following
            ? 'bg-lime-500/15 text-lime-500 hover:bg-lime-500/15 cursor-default'
            : 'bg-lime-600 hover:bg-lime-700 text-white'
        }
      >
        {isPublishing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : following ? (
          <Check className="mr-2 h-4 w-4" aria-hidden="true" />
        ) : null}
        {following ? 'Following' : 'Follow us on Nostr'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
