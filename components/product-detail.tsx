'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImageIcon, MapPin, MessageCircle, PackageX, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactPanel } from '@/components/contact-panel';
import { OwnerListingControls } from '@/components/admin/owner-listing-controls';
import { CheckoutPanel } from '@/components/checkout/checkout-panel';
import ProductShipping from '@/components/product-shipping';
import { useCart } from '@/hooks/use-cart';
import { useShopOwner } from '@/hooks/use-shop-admin';
import { KNOWALL_PUBKEY, SHOP_RELAYS } from '@/lib/nostr';
import {
  CLASSIFIED_LISTING_KIND,
  formatPrice,
  isSoldOut,
  selectListing,
  type Listing,
  type NostrEvent,
} from '@/lib/nip99';

const RELAY_TIMEOUT_MS = 8000;
/** REQ subscription id — relay EVENT/EOSE messages are matched against it. */
const SUBSCRIPTION_ID = 'product';

interface ProductDetailProps {
  /** The naddr from the URL — reused verbatim for the njump buy deep-link. */
  naddr: string;
  /** Merchant pubkey (hex) decoded from the naddr. */
  pubkey: string;
  /** The `d` tag identifying the product. */
  identifier: string;
}

/**
 * Full product page for one NIP-99 listing, fetched client-side by its
 * (kind, pubkey, d-tag) address — the same REQ-until-EOSE pattern as the shop
 * grid, narrowed with a `#d` filter. Layout mirrors robotechy.com's product
 * detail: back link, two-column gallery/info grid, thumbnail switching with
 * per-image error fallbacks, and a not-found card.
 */
export default function ProductDetail({ naddr, pubkey, identifier }: ProductDetailProps) {
  const router = useRouter();
  const isOwner = useShopOwner();
  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumped after an owner edit so the page re-queries the relays.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const events = new Map<string, NostrEvent>();
    const sockets: WebSocket[] = [];
    let settledRelays = 0;
    let successfulRelays = 0;

    const finish = () => {
      if (cancelled) return;
      const found = selectListing([...events.values()], pubkey, identifier);
      setListing(found);
      // Distinguish "every relay failed" from "relays answered: no such product".
      setStatus(successfulRelays === 0 && !found ? 'error' : 'ready');
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
            {
              kinds: [CLASSIFIED_LISTING_KIND],
              authors: [pubkey],
              '#d': [identifier],
              limit: 10,
            },
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
  }, [pubkey, identifier, reloadToken]);

  if (status === 'loading') return <ProductSkeleton />;
  if (!listing) return status === 'error' ? <ProductError naddr={naddr} /> : <ProductNotFound />;
  // Hidden listings are owner-only drafts: the grid gate also applies to the
  // detail route, so a shared naddr can't expose a draft to the public. The
  // owner check is KnowAll-specific, so a draft only shows when the listing
  // is actually authored by the KnowAll key the owner controls.
  if (listing.visibility === 'hidden' && !(isOwner && listing.pubkey === KNOWALL_PUBKEY)) {
    return <ProductNotFound />;
  }
  return (
    <ProductView
      naddr={naddr}
      listing={listing}
      onOwnerSaved={() => setReloadToken((token) => token + 1)}
      onOwnerDeleted={() => router.push('/shop')}
    />
  );
}

/** Back-to-shop link shared by every state. */
function BackToShop() {
  return (
    <Link
      href="/shop"
      className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-lime-500"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Shop
    </Link>
  );
}

/** Two-column skeleton matching the loaded layout, robotechy-style. */
function ProductSkeleton() {
  return (
    <div data-testid="product-loading">
      <BackToShop />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square w-full rounded-xl bg-gray-800" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4 bg-gray-800" />
          <Skeleton className="h-7 w-32 bg-gray-800" />
          <Skeleton className="h-4 w-full bg-gray-800" />
          <Skeleton className="h-4 w-full bg-gray-800" />
          <Skeleton className="h-4 w-2/3 bg-gray-800" />
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 flex-1 bg-gray-800" />
            <Skeleton className="h-10 flex-1 bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Relays answered but no such listing exists (robotechy's not-found card). */
function ProductNotFound() {
  return (
    <div data-testid="product-not-found">
      <BackToShop />
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-gray-800 bg-gray-900 px-6 py-12 text-center">
        <PackageX className="mx-auto mb-4 h-12 w-12 text-gray-600" aria-hidden="true" />
        <h1 className="mb-2 text-lg font-semibold text-white">Product not found</h1>
        <p className="text-sm leading-relaxed text-gray-400">
          This product may have been removed or doesn&apos;t exist.
        </p>
        <Button asChild className="mt-6 bg-lime-600 hover:bg-lime-700 text-white">
          <Link href="/shop">Back to Shop</Link>
        </Button>
      </div>
    </div>
  );
}

/** Every relay failed — offer njump as the out-of-band fallback. */
function ProductError({ naddr }: { naddr: string }) {
  return (
    <div data-testid="product-error">
      <BackToShop />
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-gray-800 bg-gray-900 px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-gray-400">
          We couldn&apos;t load this product right now. Please try again later, or{' '}
          <a
            href={`https://njump.me/${naddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime-500 hover:underline"
          >
            view it on njump
          </a>
          .
        </p>
      </div>
    </div>
  );
}

interface ProductViewProps {
  naddr: string;
  listing: Listing;
  /** Owner-only: called after the listing is edited/republished. */
  onOwnerSaved: () => void;
  /** Owner-only: called after the listing is deleted. */
  onOwnerDeleted: () => void;
}

/** The loaded product: gallery left, purchase info right, description below. */
function ProductView({ naddr, listing, onOwnerSaved, onOwnerDeleted }: ProductViewProps) {
  const { openContactPanel } = useContactPanel();
  const { addItem, setIsOpen: setCartOpen } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const sold = isSoldOut(listing);

  const handleMessage = () => {
    openContactPanel({
      message: `Hi! I'd like to buy: ${listing.title} (${formatPrice(listing.price)}). `,
    });
  };

  // Robotechy's purchase pair: Add to Cart opens the drawer; Buy It Now goes
  // straight to checkout with the item added.
  const handleAddToCart = () => {
    addItem(listing, quantity);
    setCartOpen(true);
  };

  const handleBuyNow = () => {
    addItem(listing, quantity);
    setCheckoutOpen(true);
  };

  return (
    <div data-testid="product-detail">
      <BackToShop />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery listing={listing} sold={sold} />

        {/* Info column — robotechy's order: title, price, summary, stock, actions. */}
        <div className="flex flex-col gap-4">
          {/* Owner-only edit/remove controls (null for everyone else). */}
          <OwnerListingControls
            pubkey={listing.pubkey}
            dTag={listing.dTag}
            title={listing.title}
            onSaved={onOwnerSaved}
            onDeleted={onOwnerDeleted}
          />

          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            {listing.title}
          </h1>

          <p className="text-2xl font-semibold text-lime-500">{formatPrice(listing.price)}</p>

          {listing.summary && (
            <p className="text-sm italic leading-relaxed text-gray-400">{listing.summary}</p>
          )}

          <hr className="border-gray-800" />

          {/* Availability: sold/stock from NIP-99 + Gamma tags. */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            {sold ? (
              <Badge variant="secondary">Sold Out</Badge>
            ) : (
              <>
                {listing.visibility === 'pre-order' && (
                  <Badge className="bg-lime-500/10 text-lime-500 hover:bg-lime-500/10">
                    Pre-order
                  </Badge>
                )}
                {listing.stock !== null && <span>{listing.stock} available</span>}
              </>
            )}
            {listing.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {listing.location}
              </span>
            )}
          </div>

          {listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-gray-700 px-3 py-1 text-xs font-medium text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* P&P — resolved from the listing's Gamma shipping_option refs. */}
          <ProductShipping pubkey={listing.pubkey} zoneIds={listing.shippingZoneIds} />

          {/* Purchase: quantity + cart/checkout (robotechy's buy pair). */}
          {!sold && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="quantity" className="text-gray-200">
                  Quantity
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={listing.stock ?? undefined}
                  value={quantity}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    const wanted = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
                    // The max attribute stops the spinner, not typed input.
                    setQuantity(listing.stock !== null ? Math.min(wanted, listing.stock) : wanted);
                  }}
                  className="w-24 border-gray-700 bg-gray-800 text-white focus-visible:ring-lime-500"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleAddToCart}
                  className="flex-1 bg-lime-600 font-semibold text-white hover:bg-lime-700"
                >
                  <ShoppingCart className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBuyNow}
                  className="flex-1 border-lime-600 bg-transparent font-semibold text-lime-500 hover:bg-lime-600/10 hover:text-lime-400"
                >
                  Buy It Now
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMessage}
                  className="flex-1 border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Message
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-gray-500">
            Checkout pays with Bitcoin over Lightning — no account needed. Your order and address
            travel as encrypted Nostr messages. Prefer your own Nostr client? View the listing on{' '}
            <a
              href={`https://njump.me/${naddr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-lime-500"
            >
              njump
            </a>{' '}
            instead.
          </p>

          {/* Buy It Now jumps straight to this checkout with the item added. */}
          <CheckoutPanel open={checkoutOpen} onOpenChange={setCheckoutOpen} />

          {listing.description && (
            <section className="mt-4">
              <h2 className="mb-2 text-lg font-semibold text-white">Description</h2>
              {/* Plain text with preserved line breaks — same safe rendering as
                  the story feed; listing content is untrusted, so no raw HTML.
                  The one markdown-ism honoured is **bold** (our real listings
                  use it), rendered as React elements, never injected markup. */}
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
                <DescriptionText text={listing.description} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Markdown-lite description text: `**spans**` become <strong>, everything
 * else stays literal (line breaks are preserved by the parent's
 * whitespace-pre-wrap). Splitting on a capture group keeps bold runs at the
 * odd indices.
 */
function DescriptionText({ text }: { text: string }) {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

/**
 * Main image + thumbnail strip (robotechy's gallery pattern): clicking a
 * thumbnail switches the main image; images that fail to load fall back to a
 * placeholder icon, tracked per index.
 */
function ProductGallery({ listing, sold }: { listing: Listing; sold: boolean }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());

  const markFailed = (index: number) => setFailed((prev) => new Set(prev).add(index));
  const currentImage = listing.images[selected];
  const hasValidImage = Boolean(currentImage) && !failed.has(selected);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        {hasValidImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- image hosts come from Nostr events, unknown at build time
          <img
            src={currentImage}
            alt={`${listing.title} — image ${selected + 1}`}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => markFailed(selected)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-600">
            <ImageIcon className="h-16 w-16" aria-hidden="true" />
            <p className="text-sm">Image not available</p>
          </div>
        )}
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Badge variant="secondary" className="px-4 py-2 text-base">
              Sold Out
            </Badge>
          </div>
        )}
      </div>

      {listing.images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {listing.images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Show image ${index + 1}`}
              aria-pressed={selected === index}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                selected === index ? 'border-lime-500' : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {!failed.has(index) ? (
                // eslint-disable-next-line @next/next/no-img-element -- image hosts come from Nostr events, unknown at build time
                <img
                  src={image}
                  alt={`${listing.title} thumbnail ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed(index)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-600">
                  <ImageIcon className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
