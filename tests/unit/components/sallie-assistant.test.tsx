import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SallieAssistant, { SALLIE_GREETING } from '@/components/sallie-assistant';

/**
 * SallieAssistant tests
 *
 * Requirements: sallie-chat
 * - Sallie greets visitors on load
 * - A visitor's message is sent to /api/chat and the reply is shown
 * - Sallie only talks to the public chat endpoint (no other calls)
 */

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe('SallieAssistant', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    // Reduced motion shows the greeting instantly instead of typing it out.
    mockReducedMotion(true);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['band', 'porthole', 'dock'] as const)(
    'greets visitors in the %s layout',
    async (layout) => {
      render(<SallieAssistant layout={layout} />);
      if (layout === 'dock') {
        fireEvent.click(screen.getByRole('button', { name: 'Chat with Sallie' }));
      }
      expect(screen.getByTestId('sallie-chat')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sallie', exact: true })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText(SALLIE_GREETING)).toBeInTheDocument());
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    }
  );

  it('sends the visitor message to /api/chat and shows the reply', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'assistant', content: 'We build AI agents.' }),
    });
    render(<SallieAssistant layout="band" />);

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), {
      target: { value: 'What does KnowAll do?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('What does KnowAll do?')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('We build AI agents.')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat');
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([{ role: 'user', content: 'What does KnowAll do?' }]);
    expect(body.conversationId).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('sends a suggestion chip as a message', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: 'Sure.' }) });
    render(<SallieAssistant layout="porthole" />);

    fireEvent.click(screen.getByRole('button', { name: 'What is T-Minus-15?' }));

    await waitFor(() => expect(screen.getByText('Sure.')).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('What is T-Minus-15?');
    // Chips disappear once the conversation has started
    expect(screen.queryByRole('button', { name: 'What does KnowAll do?' })).not.toBeInTheDocument();
  });

  it('shows a friendly error when the chat API fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<SallieAssistant layout="band" />);

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/));
  });
});
