'use client';

import { useEffect, useState } from 'react';
import { KNOWALL_PUBKEY } from '@/lib/nostr';

// purplepag.es is a dedicated profile aggregator; the others are general-purpose relays.
const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es'];
const RELAY_TIMEOUT_MS = 10000;

/** Static fallbacks shown immediately and kept whenever the live kind-0
 *  profile is missing a field (or the relays are unreachable). */
export const PROFILE_FALLBACK = {
  name: 'KnowAll AI',
  about:
    'We build intelligent AI systems that transform businesses through custom Microsoft ' +
    'Copilots, multi-agent teams, and Bitcoin-powered value exchange networks.',
  picture: '/images/knowall-nostr-avatar.png',
  banner: '/images/knowall-nostr-banner.png',
};

export interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
}

export interface ResolvedNostrProfile {
  /** Banner image src: the live https banner, or the static fallback. */
  bannerSrc: string;
  /** Avatar image src: the live https picture, or the static fallback. */
  avatarSrc: string;
  /** Display name from the live profile, or the static fallback. */
  name: string;
  /** Bio from the live profile, or the static fallback. */
  about: string;
  /** Mark the live banner as broken (falls back to the static image). */
  onBannerError: () => void;
  /** Mark the live avatar as broken (falls back to the static image). */
  onAvatarError: () => void;
}

/**
 * Live Nostr profile (kind-0 metadata, newest wins across relays) with static
 * fallbacks, shared by the Story and Shop heroes. Mirrors the profile-hero
 * pattern on robotechy.com and edenweeks.art: the fallbacks render instantly
 * and the hero still looks right if every relay is down. Only https image
 * URLs from the live profile are trusted; broken images fall back too.
 */
export function useNostrProfile(pubkey: string = KNOWALL_PUBKEY): ResolvedNostrProfile {
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
        ws.send(JSON.stringify(['REQ', 'profile', { kinds: [0], authors: [pubkey] }]));
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          if (data[0] === 'EVENT' && data[2]?.pubkey === pubkey) {
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
  }, [pubkey]);

  // Only trust https URLs from the live profile; anything else keeps the fallback.
  const liveBanner =
    profile.banner?.startsWith('https://') && !brokenBanner ? profile.banner : undefined;
  const liveAvatar =
    profile.picture?.startsWith('https://') && !brokenAvatar ? profile.picture : undefined;

  return {
    bannerSrc: liveBanner ?? PROFILE_FALLBACK.banner,
    avatarSrc: liveAvatar ?? PROFILE_FALLBACK.picture,
    name: profile.display_name || profile.name || PROFILE_FALLBACK.name,
    about: profile.about || PROFILE_FALLBACK.about,
    onBannerError: () => liveBanner && setBrokenBanner(true),
    onAvatarError: () => liveAvatar && setBrokenAvatar(true),
  };
}
