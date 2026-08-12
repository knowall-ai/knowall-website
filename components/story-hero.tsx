'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import FollowButton from '@/components/follow-button';
import { KNOWALL_NPUB, KNOWALL_PUBKEY } from '@/lib/nostr';

// purplepag.es is a dedicated profile aggregator; the others are general-purpose relays.
const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es'];
const RELAY_TIMEOUT_MS = 10000;

/** Static fallbacks shown immediately and kept whenever the live kind-0
 *  profile is missing a field (or the relays are unreachable). */
const FALLBACK = {
  name: 'KnowAll AI',
  about:
    'We build intelligent AI systems that transform businesses through custom Microsoft ' +
    'Copilots, multi-agent teams, and Bitcoin-powered value exchange networks.',
  picture: '/images/knowall-nostr-avatar.png',
  banner: '/images/knowall-nostr-banner.png',
};

interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
}

/**
 * The Story page hero: the KnowAll AI Nostr profile rendered like a client —
 * banner with the avatar overlapping its bottom edge, name, bio, follow
 * button and npub. Banner, avatar, name and bio come live from the account's
 * kind-0 metadata event (newest wins across relays), with static fallbacks so
 * the hero renders instantly and still looks right if every relay is down.
 * Mirrors the profile-hero pattern on robotechy.com and edenweeks.art.
 */
export default function StoryHero() {
  const [profile, setProfile] = useState<NostrProfile>({});
  const [brokenBanner, setBrokenBanner] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);

  useEffect(() => {
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

      ws.onopen = () =>
        ws.send(
          JSON.stringify(['REQ', 'story-profile', { kinds: [0], authors: [KNOWALL_PUBKEY] }])
        );
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          if (data[0] === 'EVENT' && data[2]?.pubkey === KNOWALL_PUBKEY) {
            const event = data[2];
            if (event.created_at > newest) {
              newest = event.created_at;
              setProfile(JSON.parse(event.content) as NostrProfile);
            }
          } else if (data[0] === 'EOSE') {
            ws.close();
          }
        } catch {
          // Ignore malformed relay messages.
        }
      };
    }

    const closeAll = () =>
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {
          // Already closed.
        }
      });
    const timeout = setTimeout(closeAll, RELAY_TIMEOUT_MS);
    return () => {
      clearTimeout(timeout);
      closeAll();
    };
  }, []);

  // Only trust https URLs from the live profile; anything else keeps the fallback.
  const liveBanner =
    profile.banner?.startsWith('https://') && !brokenBanner ? profile.banner : undefined;
  const liveAvatar =
    profile.picture?.startsWith('https://') && !brokenAvatar ? profile.picture : undefined;
  const name = profile.display_name || profile.name || FALLBACK.name;
  const about = profile.about || FALLBACK.about;

  return (
    <div data-testid="story-hero">
      {/* Banner: live profile banner (or the static export of it), over a
          brand gradient that shows through while the image loads. */}
      <div className="relative h-40 w-full sm:h-48 bg-gradient-to-r from-lime-900/40 via-gray-900 to-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- live banner URLs come from Nostr kind-0 metadata, hosts unknown at build time */}
        <img
          src={liveBanner ?? FALLBACK.banner}
          alt={`${name} banner`}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => liveBanner && setBrokenBanner(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Avatar straddles the banner/content boundary, profile-style. */}
        <div className="relative z-10 -mt-12 sm:-mt-14 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- live avatar URLs come from Nostr kind-0 metadata, hosts unknown at build time */}
          <img
            src={liveAvatar ?? FALLBACK.picture}
            alt={`${name} logo`}
            width={112}
            height={112}
            referrerPolicy="no-referrer"
            onError={() => liveAvatar && setBrokenAvatar(true)}
            className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-gray-950 bg-gray-900 object-cover shadow-md"
          />
        </div>

        <div className="mt-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{name}</h1>
          <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-gray-400">
            {about}
          </p>
        </div>

        {/* Nostr identity — folded into the header instead of a separate card.
            Signed-in visitors get a real follow (kind-3 update via their
            signer); signed-out visitors keep the njump deep-link. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FollowButton />
          <span className="font-mono text-xs text-gray-500 break-all" title={KNOWALL_NPUB}>
            {`${KNOWALL_NPUB.slice(0, 12)}…${KNOWALL_NPUB.slice(-6)}`}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-medium text-lime-500">
          <BookOpen className="h-4 w-4" />
          <span>Our Story</span>
        </div>
      </div>
    </div>
  );
}
