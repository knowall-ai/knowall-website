import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShopListings from '@/components/shop-listings';
import { ContactPanelProvider } from '@/components/contact-panel';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { CLASSIFIED_LISTING_KIND, type NostrEvent } from '@/lib/nip99';

/**
 * ShopListings component tests
 *
 * The relay layer is exercised with a scripted fake WebSocket (no network):
 * each socket answers the REQ with a fixed set of kind-30402 events followed
 * by EOSE, so the full fetch → parse → dedupe → render pipeline runs.
 */

type Scenario = 'events' | 'error';

let scenario: Scenario = 'events';
let scriptedEvents: NostrEvent[] = [];

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (scenario === 'error') {
        this.onerror?.();
      } else {
        this.onopen?.();
      }
    });
  }

  send(_data: string) {
    queueMicrotask(() => {
      for (const event of scriptedEvents) {
        this.onmessage?.({ data: JSON.stringify(['EVENT', 'shop', event]) });
      }
      this.onmessage?.({ data: JSON.stringify(['EOSE', 'shop']) });
    });
  }

  close() {
    // No-op.
  }
}

function makeListing(overrides: {
  id: string;
  dTag: string;
  title: string;
  tags?: string[][];
  created_at?: number;
}): NostrEvent {
  return {
    id: overrides.id,
    pubkey: KNOWALL_PUBKEY,
    created_at: overrides.created_at ?? 1_700_000_000,
    kind: CLASSIFIED_LISTING_KIND,
    content: 'Product description.',
    tags: [
      ['d', overrides.dTag],
      ['title', overrides.title],
      ['price', '10000', 'SATS'],
      ...(overrides.tags ?? []),
    ],
  };
}

function renderShop() {
  return render(
    <ContactPanelProvider>
      <ShopListings />
    </ContactPanelProvider>
  );
}

describe('ShopListings', () => {
  beforeEach(() => {
    scenario = 'events';
    scriptedEvents = [];
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading skeletons initially', () => {
    renderShop();
    expect(screen.getByTestId('shop-loading')).toBeInTheDocument();
  });

  it('renders the branded empty state when the merchant has no listings', async () => {
    renderShop();
    expect(await screen.findByTestId('shop-empty')).toBeInTheDocument();
    expect(screen.getByText('Shop opening soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Follow us on Nostr' })).toHaveAttribute(
      'href',
      expect.stringContaining('njump.me')
    );
  });

  it('renders an error state when no relay is reachable', async () => {
    scenario = 'error';
    renderShop();
    expect(await screen.findByText(/couldn't load the shop/)).toBeInTheDocument();
  });

  it('renders product cards from kind-30402 events', async () => {
    scriptedEvents = [
      makeListing({
        id: 'ev1',
        dTag: 'sticker-pack',
        title: 'KnowAll AI Sticker Pack',
        tags: [
          ['summary', 'Ten die-cut vinyl stickers'],
          ['image', 'https://example.com/stickers.png'],
          ['t', 'merch'],
        ],
      }),
    ];
    renderShop();

    expect(await screen.findByTestId('shop-listings')).toBeInTheDocument();
    expect(screen.getByText('KnowAll AI Sticker Pack')).toBeInTheDocument();
    expect(screen.getByText('Ten die-cut vinyl stickers')).toBeInTheDocument();
    expect(screen.getByText('10,000 sats')).toBeInTheDocument();

    // Buy deep-links to the listing's naddr on njump.
    const buy = screen.getByRole('link', { name: /Buy/ });
    expect(buy).toHaveAttribute('href', expect.stringMatching(/njump\.me\/naddr1/));
  });

  it('deduplicates replaceable events, keeping the newest version', async () => {
    scriptedEvents = [
      makeListing({ id: 'old', dTag: 'stickers', title: 'Old Title', created_at: 100 }),
      makeListing({ id: 'new', dTag: 'stickers', title: 'New Title', created_at: 200 }),
    ];
    renderShop();

    expect(await screen.findByTestId('shop-listings')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('New Title')).toBeInTheDocument();
    expect(screen.queryByText('Old Title')).not.toBeInTheDocument();
  });

  it('filters listings by search query', async () => {
    scriptedEvents = [
      makeListing({ id: 'a', dTag: 'stickers', title: 'Sticker Pack' }),
      makeListing({ id: 'b', dTag: 'tshirt', title: 'KnowAll T-Shirt' }),
    ];
    renderShop();
    await screen.findByTestId('shop-listings');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
      target: { value: 'shirt' },
    });

    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('KnowAll T-Shirt')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
      target: { value: 'zzz-no-match' },
    });
    expect(screen.getByTestId('shop-no-matches')).toBeInTheDocument();
  });

  it('filters listings by tag chips', async () => {
    scriptedEvents = [
      makeListing({ id: 'a', dTag: 'stickers', title: 'Sticker Pack', tags: [['t', 'merch']] }),
      makeListing({ id: 'b', dTag: 'course', title: 'Agent Bootcamp', tags: [['t', 'training']] }),
    ];
    renderShop();
    await screen.findByTestId('shop-listings');

    fireEvent.click(screen.getByRole('button', { name: '#training' }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('Agent Bootcamp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
  });

  it('marks sold-out products and hides Gamma hidden listings', async () => {
    scriptedEvents = [
      makeListing({ id: 'a', dTag: 'sold-item', title: 'Sold Item', tags: [['status', 'sold']] }),
      makeListing({
        id: 'b',
        dTag: 'draft-item',
        title: 'Hidden Draft',
        tags: [['visibility', 'hidden']],
      }),
    ];
    renderShop();

    await screen.findByTestId('shop-listings');
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('Sold Out')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Draft')).not.toBeInTheDocument();
  });

  it('opens the contact panel prefilled when Message is clicked', async () => {
    scriptedEvents = [makeListing({ id: 'a', dTag: 'stickers', title: 'Sticker Pack' })];
    renderShop();
    await screen.findByTestId('shop-listings');

    fireEvent.click(screen.getByRole('button', { name: /Message/ }));

    expect(await screen.findByText('Message us')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue(
      "Hi! I'd like to buy: Sticker Pack (10,000 sats). "
    );
  });
});
