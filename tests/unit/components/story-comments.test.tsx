import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StoryComments from '@/components/story-comments';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import type { NostrEvent } from '@/lib/story-notes';

const USER_PUBKEY = 'a'.repeat(64);

// Swappable auth state: tests flip between signed-out and signed-in.
const mockSignEvent = vi.fn();
let mockUser: { pubkey: string; npub: string } | null = null;

vi.mock('@/components/auth/nostr-auth-provider', () => ({
  useNostrAuth: () => ({
    user: mockUser,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signEvent: mockSignEvent,
  }),
}));

const mockPublishToRelays = vi.fn();
vi.mock('@/lib/relay', () => ({
  SOCIAL_RELAYS: ['wss://relay.test'],
  publishToRelays: (...args: unknown[]) => mockPublishToRelays(...args),
}));

vi.mock('@/lib/nostr-profiles', () => ({
  fetchProfiles: vi.fn().mockResolvedValue(new Map()),
}));

function makeNote(partial: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: KNOWALL_PUBKEY,
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: 'A story post',
    ...partial,
  };
}

function makeReply(partial: Partial<NostrEvent> = {}): NostrEvent {
  return makeNote({
    id: '2'.repeat(64),
    pubkey: 'c'.repeat(64),
    content: 'A thoughtful comment',
    tags: [['e', '1'.repeat(64), '', 'root']],
    ...partial,
  });
}

describe('StoryComments composer gating', () => {
  beforeEach(() => {
    mockUser = null;
    mockSignEvent.mockReset();
    mockPublishToRelays.mockReset();
  });

  it('signed out: thread is read-only with a sign-in nudge', () => {
    render(
      <StoryComments
        note={makeNote()}
        replies={[makeReply()]}
        onPosted={vi.fn()}
        onMuted={vi.fn()}
      />
    );

    expect(screen.getByText('A thoughtful comment')).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Sign in to join the conversation…');
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign in to comment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
  });

  it('signed out: never calls the signer', () => {
    render(<StoryComments note={makeNote()} replies={[]} onPosted={vi.fn()} onMuted={vi.fn()} />);
    fireEvent.submit(screen.getByTestId('story-comment-composer'));
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockPublishToRelays).not.toHaveBeenCalled();
  });

  it('signed in: enables the composer and posts a NIP-10 reply via the signer', async () => {
    mockUser = { pubkey: USER_PUBKEY, npub: 'npub1test' };
    const signed = makeReply({ id: '3'.repeat(64), pubkey: USER_PUBKEY, content: 'Hello!' });
    mockSignEvent.mockResolvedValue(signed);
    mockPublishToRelays.mockResolvedValue(undefined);
    const onPosted = vi.fn();
    const note = makeNote();

    render(<StoryComments note={note} replies={[]} onPosted={onPosted} onMuted={vi.fn()} />);

    const textarea = screen.getByPlaceholderText('Write a comment…');
    expect(textarea).toBeEnabled();

    const submit = screen.getByRole('button', { name: 'Comment' });
    expect(submit).toBeDisabled(); // nothing typed yet

    fireEvent.change(textarea, { target: { value: 'Hello!' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(signed));

    // The signer received a kind-1 reply with the note as thread root and the
    // KnowAll account p-tagged.
    expect(mockSignEvent).toHaveBeenCalledTimes(1);
    const template = mockSignEvent.mock.calls[0][0];
    expect(template.kind).toBe(1);
    expect(template.content).toBe('Hello!');
    expect(template.tags).toContainEqual(['e', note.id, '', 'root']);
    expect(template.tags).toContainEqual(['p', KNOWALL_PUBKEY]);

    expect(mockPublishToRelays).toHaveBeenCalledWith(['wss://relay.test'], signed);
    expect((textarea as HTMLTextAreaElement).value).toBe(''); // cleared after posting
  });

  it('signed in: surfaces signer rejection without clearing the draft', async () => {
    mockUser = { pubkey: USER_PUBKEY, npub: 'npub1test' };
    mockSignEvent.mockRejectedValue(new Error('User declined to sign'));
    const onPosted = vi.fn();

    render(<StoryComments note={makeNote()} replies={[]} onPosted={onPosted} onMuted={vi.fn()} />);

    const textarea = screen.getByPlaceholderText('Write a comment…');
    fireEvent.change(textarea, { target: { value: 'Hello!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User declined to sign');
    expect(onPosted).not.toHaveBeenCalled();
    expect(mockPublishToRelays).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello!'); // draft preserved
  });

  it('clamps long comments behind a Show more toggle', () => {
    const long = 'x'.repeat(400);
    render(
      <StoryComments
        note={makeNote()}
        replies={[makeReply({ content: long })]}
        onPosted={vi.fn()}
        onMuted={vi.fn()}
      />
    );

    expect(screen.queryByText(long)).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show more' });
    fireEvent.click(toggle);
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});
