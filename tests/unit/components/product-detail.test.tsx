import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductDetail from '@/components/product-detail';
import { ContactPanelProvider } from '@/components/contact-panel';
import { NostrAuthProvider } from '@/components/auth/nostr-auth-provider';
import { CartProvider } from '@/hooks/use-cart';

// ProductDetail navigates (owner deletion) via the app router; none of these
// tests exercise navigation, so a stub router is enough.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
import { encodeListingNaddr } from '@/lib/naddr';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { CLASSIFIED_LISTING_KIND, type NostrEvent } from '@/lib/nip99';
import { MAX_QUANTITY } from '@/lib/cart';

/**
 * ProductDetail component tests
 *
 * Same scripted fake-WebSocket pattern as the ShopListings tests: each socket
 * answers the single-listing REQ (kind + author + #d) with scripted events and
 * EOSE, exercising fetch → selectListing → render for every page state.
 */

type Scenario = 'events' | 'error';

let scenario: Scenario = 'events';
let scriptedEvents: NostrEvent[] = [];

class FakeWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => {
      if (scenario === 'error') {
        this.onerror?.();
      } else {
        this.onopen?.();
      }
    });
  }

  send(payload: string) {
    // Echo the REQ's subscription id back, as a real relay would.
    const subscriptionId = JSON.parse(payload)[1] as string;
    queueMicrotask(() => {
      for (const event of scriptedEvents) {
        this.onmessage?.({ data: JSON.stringify(['EVENT', subscriptionId, event]) });
      }
      this.onmessage?.({ data: JSON.stringify(['EOSE', subscriptionId]) });
    });
  }

  close() {
    // No-op.
  }
}

const D_TAG = 'tminus15-book';
const NADDR = encodeListingNaddr(KNOWALL_PUBKEY, D_TAG);

function makeListing(overrides: Partial<NostrEvent> & { extraTags?: string[][] } = {}): NostrEvent {
  const { extraTags = [], ...event } = overrides;
  return {
    id: 'e'.repeat(64),
    pubkey: KNOWALL_PUBKEY,
    created_at: 1_700_000_000,
    kind: CLASSIFIED_LISTING_KIND,
    content: 'The T-Minus-15 methodology.\n\nShips worldwide.',
    tags: [
      ['d', D_TAG],
      ['title', 'T-Minus-15 Book'],
      ['summary', 'Agentic delivery, by the book'],
      ['price', '9.99', 'GBP'],
      ['image', 'https://example.com/front.png'],
      ['image', 'https://example.com/back.png'],
      ['t', 'book'],
      ['location', 'United Kingdom'],
      ['stock', '5'],
      ...extraTags,
    ],
    ...event,
  };
}

function renderDetail() {
  return render(
    <NostrAuthProvider>
      <CartProvider>
        <ContactPanelProvider>
          <ProductDetail naddr={NADDR} pubkey={KNOWALL_PUBKEY} identifier={D_TAG} />
        </ContactPanelProvider>
      </CartProvider>
    </NostrAuthProvider>
  );
}

describe('ProductDetail', () => {
  beforeEach(() => {
    scenario = 'events';
    scriptedEvents = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the loading skeleton initially', () => {
    renderDetail();
    expect(screen.getByTestId('product-loading')).toBeInTheDocument();
  });

  it('renders the full product page from a kind-30402 event', async () => {
    scriptedEvents = [makeListing()];
    renderDetail();

    expect(await screen.findByTestId('product-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'T-Minus-15 Book' })).toBeInTheDocument();
    expect(screen.getByText('£9.99')).toBeInTheDocument();
    expect(screen.getByText('Agentic delivery, by the book')).toBeInTheDocument();
    expect(screen.getByText('5 available')).toBeInTheDocument();
    expect(screen.getByText('United Kingdom')).toBeInTheDocument();
    expect(screen.getByText('#book')).toBeInTheDocument();
    // Description preserves the event content as plain text.
    expect(screen.getByText(/The T-Minus-15 methodology\./)).toBeInTheDocument();
    // In-page purchase actions (cart checkout) for an in-stock listing:
    // Add to Cart / Buy It Now / Message side by side.
    expect(screen.getByRole('button', { name: /Add to Cart/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buy It Now/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Message/ })).toBeInTheDocument();
    // The njump deep-link lives in the fine print now (no View on Nostr button).
    expect(screen.queryByRole('link', { name: /View on Nostr/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'njump' })).toHaveAttribute(
      'href',
      `https://njump.me/${NADDR}`
    );
    expect(screen.getByRole('link', { name: /Back to Shop/ })).toHaveAttribute('href', '/shop');
  });

  it('renders **bold** description spans as <strong>, never literal asterisks', async () => {
    scriptedEvents = [makeListing({ content: '**T-Minus-15** methodology.\n\nShips worldwide.' })];
    renderDetail();
    await screen.findByTestId('product-detail');

    const bold = screen.getByText('T-Minus-15');
    expect(bold.tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('switches the main image when a thumbnail is clicked', async () => {
    scriptedEvents = [makeListing()];
    renderDetail();
    await screen.findByTestId('product-detail');

    const main = () => screen.getByAltText(/T-Minus-15 Book — image/) as HTMLImageElement;
    expect(main().src).toBe('https://example.com/front.png');
    fireEvent.click(screen.getByRole('button', { name: 'Show image 2' }));
    expect(main().src).toBe('https://example.com/back.png');
  });

  it('renders the newest version of a replaceable listing', async () => {
    scriptedEvents = [
      makeListing({ id: 'a'.repeat(64), created_at: 100 }),
      makeListing({
        id: 'b'.repeat(64),
        created_at: 200,
        extraTags: [],
        tags: [
          ['d', D_TAG],
          ['title', 'T-Minus-15 Book (2nd edition)'],
          ['price', '12.99', 'GBP'],
        ],
      }),
    ];
    renderDetail();

    expect(await screen.findByText('T-Minus-15 Book (2nd edition)')).toBeInTheDocument();
    expect(screen.queryByText('£9.99')).not.toBeInTheDocument();
  });

  it('marks sold-out listings and hides the purchase actions', async () => {
    scriptedEvents = [makeListing({ extraTags: [['status', 'sold']] })];
    renderDetail();

    await screen.findByTestId('product-detail');
    expect(screen.getAllByText('Sold Out').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Add to Cart/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buy It Now/ })).not.toBeInTheDocument();
    // The njump fine-print link remains for sold-out listings.
    expect(screen.getByRole('link', { name: 'njump' })).toBeInTheDocument();
  });

  it('opens the contact panel prefilled when Message is clicked', async () => {
    scriptedEvents = [makeListing()];
    renderDetail();
    await screen.findByTestId('product-detail');

    fireEvent.click(screen.getByRole('button', { name: /Message/ }));
    expect(await screen.findByText('Message us')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Message/ })).toHaveValue(
      "Hi! I'd like to buy: T-Minus-15 Book (£9.99). "
    );
  });

  it('shows the not-found card when relays answer with no such listing', async () => {
    renderDetail();
    expect(await screen.findByTestId('product-not-found')).toBeInTheDocument();
    expect(screen.getByText('Product not found')).toBeInTheDocument();
  });

  it('hides Gamma hidden (draft) listings from the public behind the not-found card', async () => {
    scriptedEvents = [makeListing({ extraTags: [['visibility', 'hidden']] })];
    renderDetail();
    expect(await screen.findByTestId('product-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('product-detail')).not.toBeInTheDocument();
  });

  it('ignores events for other d tags or authors', async () => {
    scriptedEvents = [
      makeListing({
        extraTags: [],
        tags: [
          ['d', 'different-product'],
          ['title', 'Different Product'],
        ],
      }),
      makeListing({ pubkey: 'f'.repeat(64) }),
    ];
    renderDetail();
    expect(await screen.findByTestId('product-not-found')).toBeInTheDocument();
  });

  it('clamps a typed quantity to the cart maximum when stock is untracked', async () => {
    // Without a cap the input accepted any number while lib/cart clamps adds to
    // MAX_QUANTITY, so the UI could read 5000 while only 999 reached the cart.
    // No stock tag -> untracked stock, which is the case that was unbounded.
    const untracked = makeListing();
    scriptedEvents = [{ ...untracked, tags: untracked.tags.filter((t) => t[0] !== 'stock') }];
    renderDetail();
    await screen.findByTestId('product-detail');
    const quantity = screen.getByLabelText(/quantity/i) as HTMLInputElement;

    fireEvent.change(quantity, { target: { value: '5000' } });
    expect(quantity.value).toBe(String(MAX_QUANTITY));
    expect(quantity).toHaveAttribute('max', String(MAX_QUANTITY));

    // Ordinary values are untouched.
    fireEvent.change(quantity, { target: { value: '3' } });
    expect(quantity.value).toBe('3');
  });

  it('shows the error state with an njump fallback when every relay fails', async () => {
    scenario = 'error';
    renderDetail();

    expect(await screen.findByTestId('product-error')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view it on njump/ })).toHaveAttribute(
      'href',
      `https://njump.me/${NADDR}`
    );
  });
});
