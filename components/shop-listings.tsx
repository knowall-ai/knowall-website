'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Search, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactPanel } from '@/components/contact-panel';
import { encodeListingNaddr } from '@/lib/naddr';
import { KNOWALL_NPUB, KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import {
  CLASSIFIED_LISTING_KIND,
  collectTags,
  dedupeListings,
  filterListings,
  formatPrice,
  isPubliclyVisible,
  isSoldOut,
  type Listing,
  type NostrEvent,
} from '@/lib/nip99';

const MAX_LISTINGS = 100;
const RELAY_TIMEOUT_MS = 8000;
/** REQ subscription id — relay EVENT/EOSE messages are matched against it. */
const SUBSCRIPTION_ID = 'shop';

/** Internal product-page path for a listing (its naddr also deep-links the
 *  same product on njump from the detail page's Buy button). */
function productPath(listing: Listing): string {
  return `/shop/${encodeListingNaddr(listing.pubkey, listing.dTag, SHOP_RELAYS)}`;
}

interface ShopListingsProps {
  /** Hex pubkey whose kind-30402 listings are shown (defaults to KnowAll AI). */
  pubkey?: string;
}

export default function ShopListings({ pubkey = KNOWALL_PUBKEY }: ShopListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Fetch kind-30402 events by the merchant pubkey from all relays, mirroring
  // the story feed's raw-WebSocket subscription: collect until EOSE (or
  // timeout) per relay, then reduce to the newest listing per d tag.
  useEffect(() => {
    let cancelled = false;
    const events = new Map<string, NostrEvent>();
    const sockets: WebSocket[] = [];
    let settledRelays = 0;
    let successfulRelays = 0;

    const finish = () => {
      if (cancelled) return;
      // Gamma-style hidden listings are owner-only drafts — keep them off the
      // public storefront (same gate as the Robotechy/Eden shops).
      const deduped = dedupeListings([...events.values()]).filter(isPubliclyVisible);
      setListings(deduped);
      setStatus(successfulRelays === 0 && deduped.length === 0 ? 'error' : 'ready');
    };

    const settle = (ok: boolean) => {
      settledRelays += 1;
      if (ok) successfulRelays += 1;
      if (settledRelays === SHOP_RELAYS.length) finish();
    };

    for (const url of SHOP_RELAYS) {
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        settle(false);
        continue;
      }
      sockets.push(socket);

      let done = false;
      const complete = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // Already closed.
        }
        settle(ok);
      };
      const timer = setTimeout(() => complete(false), RELAY_TIMEOUT_MS);

      socket.onopen = () => {
        socket.send(
          JSON.stringify([
            'REQ',
            SUBSCRIPTION_ID,
            { kinds: [CLASSIFIED_LISTING_KIND], authors: [pubkey], limit: MAX_LISTINGS },
          ])
        );
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data as string);
          // Only handle messages addressed to our subscription id.
          if (data[1] !== SUBSCRIPTION_ID) return;
          if (
            data[0] === 'EVENT' &&
            data[2]?.kind === CLASSIFIED_LISTING_KIND &&
            data[2]?.pubkey === pubkey
          ) {
            events.set(data[2].id, data[2] as NostrEvent);
          } else if (data[0] === 'EOSE') {
            complete(true);
          }
        } catch {
          // Ignore malformed relay messages.
        }
      };
      socket.onerror = () => complete(false);
      socket.onclose = () => complete(false);
    }

    return () => {
      cancelled = true;
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
          // Already closed.
        }
      }
    };
  }, [pubkey]);

  const tags = useMemo(() => collectTags(listings), [listings]);
  const visible = useMemo(
    () => filterListings(listings, query, activeTag),
    [listings, query, activeTag]
  );

  if (status === 'loading') {
    return (
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="shop-loading"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <Skeleton className="aspect-[4/3] w-full rounded-none bg-gray-800" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-3/4 bg-gray-800" />
              <Skeleton className="h-4 w-full bg-gray-800" />
              <Skeleton className="h-4 w-1/3 bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error' && listings.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center">
        <p className="text-gray-400">
          We couldn&apos;t load the shop right now. Please try again later, or{' '}
          <a
            href={`https://njump.me/${KNOWALL_NPUB}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime-500 hover:underline"
          >
            find us on njump
          </a>
          .
        </p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div
        className="rounded-xl border border-gray-800 bg-gray-900 py-16 px-6 text-center"
        data-testid="shop-empty"
      >
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-lime-600" />
        <h2 className="mb-2 text-lg font-semibold text-white">Shop opening soon</h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-gray-400">
          We&apos;re stocking the shelves. Our products are listed on Nostr and purchasable with
          Bitcoin over Lightning — follow us and you&apos;ll see them here (and in your Nostr
          client) the moment they drop.
        </p>
        <Button asChild className="mt-6 bg-lime-600 hover:bg-lime-700 text-white">
          <a href={`https://njump.me/${KNOWALL_NPUB}`} target="_blank" rel="noopener noreferrer">
            Follow us on Nostr
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="shop-listings">
      {/* Search + tag filters */}
      <div className="mb-8 space-y-4">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="border-gray-700 bg-gray-800 pl-9 text-white placeholder:text-gray-500 focus-visible:ring-lime-500"
          />
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
            <button
              onClick={() => setActiveTag(null)}
              aria-pressed={activeTag === null}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeTag === null
                  ? 'border-lime-500 bg-lime-500/10 text-lime-500'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                aria-pressed={activeTag === tag}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeTag === tag
                    ? 'border-lime-500 bg-lime-500/10 text-lime-500'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      {visible.length === 0 ? (
        <div
          className="rounded-xl border border-gray-800 bg-gray-900 py-12 px-6 text-center"
          data-testid="shop-no-matches"
        >
          <p className="text-gray-400">
            No products match your search.{' '}
            <button
              onClick={() => {
                setQuery('');
                setActiveTag(null);
              }}
              className="text-lime-500 hover:underline"
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((listing) => (
            <ProductCard key={`${listing.pubkey}:${listing.dTag}`} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One product: image, title, summary, price, tags, and buy/message actions. */
function ProductCard({ listing }: { listing: Listing }) {
  const { openContactPanel } = useContactPanel();
  const [imageFailed, setImageFailed] = useState(false);
  const image = listing.images[0];
  const sold = isSoldOut(listing);

  const handleMessage = () => {
    openContactPanel({
      message: `Hi! I'd like to buy: ${listing.title} (${formatPrice(listing.price)}). `,
    });
  };

  return (
    <article
      data-testid="product-card"
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-sm transition-all hover:border-gray-700 hover:shadow-md"
    >
      {/* Product image (arbitrary remote hosts from Nostr, so plain <img>) */}
      <Link
        href={productPath(listing)}
        className="relative block aspect-square overflow-hidden bg-gray-800"
        aria-label={`View ${listing.title}`}
      >
        {image && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-gray-700" aria-hidden="true" />
          </div>
        )}
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Badge variant="secondary" className="px-4 py-2 text-base">
              Sold Out
            </Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug text-white">
            <Link href={productPath(listing)} className="transition-colors hover:text-lime-500">
              {listing.title}
            </Link>
          </h3>
          <span className="shrink-0 text-sm font-semibold text-lime-500">
            {formatPrice(listing.price)}
          </span>
        </div>

        {listing.summary && (
          <p className="line-clamp-3 text-sm leading-relaxed text-gray-400">{listing.summary}</p>
        )}

        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {listing.tags.map((tag) => (
              <span key={tag} className="text-xs text-gray-500">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {listing.stock !== null && listing.stock > 0 && (
          <p className="text-xs text-gray-500">{listing.stock} available</p>
        )}

        {/* Actions: open the on-site product page (where Buy lives), or message us. */}
        <div className="mt-auto flex gap-2 pt-2">
          <Button
            asChild
            size="sm"
            className="flex-1 bg-lime-600 font-semibold text-white hover:bg-lime-700"
          >
            <Link href={productPath(listing)}>
              View details
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMessage}
            className="flex-1 border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Message
          </Button>
        </div>
      </div>
    </article>
  );
}
