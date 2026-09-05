import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SallieAssistant from '@/components/sallie-assistant';
import { GREETINGS } from '@/lib/sallie-greetings';

const SALLIE_GREETING = GREETINGS[0].text;

/**
 * SallieAssistant tests
 *
 * Requirements: sallie-chat
 * - Sallie greets visitors on load
 * - A visitor's message is sent to /api/chat and the reply is shown
 * - Replies are spoken via /api/speak unless Sallie is muted
 * - The mic only appears where the browser supports speech recognition
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
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Reduced motion shows the greeting instantly instead of typing it out.
    mockReducedMotion(true);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    // Deterministic opener: the first greeting in the pool.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  function mockApis(reply = 'We build AI agents.') {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/chat') {
        return { ok: true, json: async () => ({ role: 'assistant', content: reply }) };
      }
      // /api/speak: voice not configured in tests
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  it('greets visitors with her avatar, name and welcome message', async () => {
    mockApis();
    render(<SallieAssistant />);
    const hero = screen.getByTestId('sallie-chat');
    expect(hero).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sallie' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Sallie, KnowAll's robot/ }).length).toBeGreaterThan(
      0
    );
    await waitFor(() => expect(screen.getByText(SALLIE_GREETING)).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('sends the visitor message to /api/chat, shows the reply and speaks it', async () => {
    mockApis();
    render(<SallieAssistant />);

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), {
      target: { value: 'What does KnowAll do?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('What does KnowAll do?')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('We build AI agents.')).toBeInTheDocument());

    const chatCall = fetchMock.mock.calls.find(([url]) => url === '/api/chat');
    expect(chatCall).toBeTruthy();
    const body = JSON.parse(chatCall![1].body);
    // The greeting she showed on screen is sent as her first turn
    expect(body.greetingId).toBe(GREETINGS[0].id);
    expect(body.messages).toEqual([
      { role: 'assistant', content: SALLIE_GREETING },
      { role: 'user', content: 'What does KnowAll do?' },
    ]);
    expect(body.conversationId).toMatch(/^[A-Z0-9]{8}$/);

    await waitFor(() => {
      const speakCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/speak');
      expect(speakCalls.map(([, init]) => JSON.parse(init.body).text)).toContain(
        'We build AI agents.'
      );
    });
  });

  it('does not speak when muted, and remembers the choice', async () => {
    window.localStorage.setItem('sallie-muted', '1');
    mockApis();
    render(<SallieAssistant />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Unmute Sallie' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is T-Minus-15?' }));
    await waitFor(() => expect(screen.getByText('We build AI agents.')).toBeInTheDocument());

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/speak')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Unmute Sallie' }));
    expect(window.localStorage.getItem('sallie-muted')).toBe('0');
    expect(screen.getByRole('button', { name: 'Mute Sallie' })).toBeInTheDocument();
  });

  it('signs off and offers email when Sallie has to stop', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/chat'
        ? {
            ok: true,
            json: async () => ({
              role: 'assistant',
              content: 'Thank you for chatting — email me at sallie@knowall.ai to continue.',
              ended: true,
            }),
          }
        : { ok: false, status: 503, json: async () => ({}) }
    );
    render(<SallieAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'What does KnowAll do?' }));

    await waitFor(() => expect(screen.getByTestId('sallie-ended')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Email Sallie to continue/ });
    expect(link.getAttribute('href')).toMatch(
      /^mailto:sallie@knowall\.ai\?subject=Continuing%20our%20chat%20\(ref%20[A-Z0-9]{8}\)$/
    );
    expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument();
  });

  it('hides the mic where speech recognition is unsupported', () => {
    mockApis();
    render(<SallieAssistant />);
    expect(screen.queryByRole('button', { name: 'Speak to Sallie' })).not.toBeInTheDocument();
  });

  it('shows a friendly error when the chat API fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<SallieAssistant />);

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/));
  });
});
