'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, MessageCircle, SendHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import SallieStage, { SallieRig, Starfield } from '@/components/sallie-stage';

export type SallieLayout = 'band' | 'porthole' | 'dock';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const SALLIE_GREETING =
  "Hi, I'm Sallie — welcome to KnowAll AI. I can tell you about our AI agents, Microsoft Copilot work, Bitcoin integration and how we deliver with T-Minus-15. What brings you here today?";

const SUGGESTIONS = [
  'What does KnowAll do?',
  'Tell me about AI agents',
  'How does Bitcoin fit in?',
  'What is T-Minus-15?',
];

// Cheap, non-cryptographic id — matches the format the API already logs.
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Reveal the greeting a few characters at a time, unless motion is reduced. */
function useTypewriter(text: string, enabled: boolean) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(text);
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [text, enabled]);
  return shown;
}

function useSallieConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId] = useState(() => generateId());

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isLoading) return;
      setError(null);
      const userMessage: Message = { id: generateId(), role: 'user', content };
      const history = [...messages, userMessage];
      setMessages(history);
      setIsLoading(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });
        if (!res.ok) throw new Error(`Chat API responded with ${res.status}`);
        const data = await res.json();
        const reply: string = data.content || "Sorry, I couldn't process that. Please try again.";
        setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: reply }]);
      } catch (err) {
        console.error('Sallie chat error', err);
        setError(
          "Sorry, I couldn't reach my knowledge base just now. Please try again in a moment."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, conversationId]
  );

  return { messages, isLoading, error, send };
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'ml-auto rounded-br-sm bg-lime-500 text-gray-950'
          : 'mr-auto rounded-bl-sm bg-gray-800/90 text-gray-100'
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap">{message.content}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ ...props }) => (
              <a
                {...props}
                className="text-lime-400 underline hover:text-lime-300"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
            p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0" />,
          }}
        >
          {message.content}
        </ReactMarkdown>
      )}
    </div>
  );
}

interface ConversationPanelProps {
  conversation: ReturnType<typeof useSallieConversation>;
  /** Show the greeting inside the message list (used where there is no speech bubble). */
  greetingInline?: boolean;
  className?: string;
  listClassName?: string;
}

/** Messages, suggestion chips and the composer. Shared by every layout. */
function ConversationPanel({
  conversation,
  greetingInline = false,
  className,
  listClassName,
}: ConversationPanelProps) {
  const { messages, isLoading, error, send } = conversation;
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading, started]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input;
    setInput('');
    void send(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const suggestions = (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => void send(s)}
          disabled={isLoading}
          className="rounded-full border border-lime-500/40 bg-lime-500/10 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:bg-lime-500/20 hover:text-lime-200 disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className={cn(
          'flex flex-col gap-3 overflow-y-auto',
          started || greetingInline ? 'min-h-0 flex-1' : '',
          listClassName
        )}
        aria-live="polite"
      >
        {greetingInline && (
          <MessageBubble
            message={{ id: 'greeting', role: 'assistant', content: SALLIE_GREETING }}
          />
        )}
        {greetingInline && !started && suggestions}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm bg-gray-800/90 px-4 py-2.5 text-sm text-gray-400">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-sallie-blink motion-reduce:animate-none"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
            Sallie is thinking
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mr-auto rounded-2xl bg-red-500/15 px-4 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {!started && !greetingInline && suggestions}

      <form onSubmit={submit} className="mt-4 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message..."
          aria-label="Message Sallie"
          rows={1}
          className="min-h-[48px] max-h-32 flex-1 resize-none border-gray-700 bg-gray-800/90 text-gray-100 placeholder:text-gray-500 focus-visible:ring-lime-500"
          disabled={isLoading}
        />
        <Button
          type="submit"
          aria-label="Send message"
          disabled={isLoading || !input.trim()}
          className="h-12 w-12 shrink-0 bg-lime-500 p-0 text-gray-950 hover:bg-lime-400"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizontal className="h-5 w-5" />
          )}
        </Button>
      </form>
    </div>
  );
}

function SpeechBubble({
  text,
  tail = 'left',
  className,
}: {
  text: string;
  tail?: 'left' | 'bottom' | 'right' | 'top';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-lime-500/30 bg-gray-900/85 px-5 py-4 text-gray-100 shadow-xl shadow-black/40 backdrop-blur-sm animate-sallie-pop motion-reduce:animate-none',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute h-4 w-4 rotate-45 border-lime-500/30 bg-gray-900/85',
          tail === 'left' && 'left-[-9px] top-7 border-b border-l',
          tail === 'right' && 'right-[-9px] top-7 border-r border-t',
          tail === 'bottom' && 'bottom-[-9px] left-1/2 -ml-2 border-b border-r',
          tail === 'top' && 'top-[-9px] left-1/2 -ml-2 border-l border-t'
        )}
      />
      <p className="text-base leading-relaxed md:text-lg">
        {text}
        <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[2px] bg-lime-400 align-middle animate-sallie-blink motion-reduce:hidden" />
      </p>
    </div>
  );
}

function BandLayout() {
  const conversation = useSallieConversation();
  const greeting = useTypewriter(SALLIE_GREETING, true);
  return (
    <section
      id="sallie-welcome"
      data-testid="sallie-chat"
      className="relative w-full overflow-hidden text-white"
    >
      <Starfield />
      <div className="container relative z-10 mx-auto grid max-w-6xl gap-8 px-4 pt-10 md:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="relative order-2 mx-auto h-[300px] w-full max-w-[420px] sm:h-[380px] lg:order-1 lg:h-full lg:min-h-[460px] lg:max-w-none">
          <SallieRig
            busy={conversation.isLoading}
            priority
            className="absolute inset-x-0 bottom-0 h-full"
          />
        </div>
        <div className="relative z-10 order-1 flex flex-col gap-6 pb-10 md:pb-14 lg:order-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
              Your AI guide
            </p>
            <h3 className="text-2xl font-bold md:text-3xl">Sallie</h3>
          </div>
          <SpeechBubble text={greeting} tail="left" />
          <ConversationPanel conversation={conversation} listClassName="max-h-[320px]" />
        </div>
      </div>
    </section>
  );
}

function PortholeLayout() {
  const conversation = useSallieConversation();
  const greeting = useTypewriter(SALLIE_GREETING, true);
  return (
    <section
      id="sallie-welcome"
      data-testid="sallie-chat"
      className="w-full bg-gray-950 px-4 py-16 text-white md:py-20"
    >
      <div className="container mx-auto flex max-w-3xl flex-col items-center gap-8">
        <SallieStage
          shape="circle"
          busy={conversation.isLoading}
          priority
          className="w-56 shrink-0 ring-4 ring-lime-500/40 shadow-[0_0_90px_rgba(157,254,10,0.18)] md:w-72"
        />
        <div className="text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
            Your AI guide
          </p>
          <h3 className="text-2xl font-bold md:text-3xl">Sallie</h3>
        </div>
        <SpeechBubble text={greeting} tail="top" className="w-full max-w-2xl" />
        <ConversationPanel
          conversation={conversation}
          className="w-full max-w-2xl"
          listClassName="max-h-[360px]"
        />
      </div>
    </section>
  );
}

function DockLayout() {
  const conversation = useSallieConversation();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const greeting = useTypewriter(SALLIE_GREETING, !open);
  const showBubble = !open && !dismissed;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3"
      data-testid="sallie-chat"
    >
      {open && (
        <div className="flex h-[min(600px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-lime-500/30 bg-gray-950/95 text-white shadow-2xl shadow-black/60 backdrop-blur-md animate-sallie-pop motion-reduce:animate-none">
          <div className="relative flex items-center gap-3 overflow-hidden px-4 py-3">
            <Starfield />
            <SallieStage
              shape="circle"
              busy={conversation.isLoading}
              className="relative z-10 w-12 shrink-0 ring-2 ring-lime-500/50"
            />
            <div className="relative z-10">
              <h3 className="font-semibold leading-tight">Sallie</h3>
              <p className="text-xs text-lime-400">KnowAll AI guide</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="relative z-10 ml-auto rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ConversationPanel
            conversation={conversation}
            greetingInline
            className="min-h-0 flex-1 px-4 pb-4 pt-3"
          />
        </div>
      )}

      {showBubble && (
        <div className="relative max-w-[300px]">
          <SpeechBubble text={greeting} tail="right" className="px-4 py-3 [&_p]:text-sm" />
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss greeting"
            className="absolute -left-2 -top-2 rounded-full bg-gray-800 p-1 text-gray-400 shadow hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat with Sallie' : 'Chat with Sallie'}
        aria-expanded={open}
        className="group relative rounded-full ring-2 ring-lime-500/60 shadow-[0_0_40px_rgba(157,254,10,0.35)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4"
      >
        <SallieStage
          shape="circle"
          busy={conversation.isLoading}
          priority
          className="w-16 md:w-20"
        />
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-lime-500 text-gray-950 shadow">
          {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}

interface SallieAssistantProps {
  layout?: SallieLayout;
}

/**
 * Sallie welcomes visitors and answers questions about KnowAll's offerings.
 * She talks only to the public `/api/chat` endpoint (same persona and
 * knowledge as before) — no internal systems are wired in.
 */
export default function SallieAssistant({ layout = 'band' }: SallieAssistantProps) {
  if (layout === 'porthole') return <PortholeLayout />;
  if (layout === 'dock') return <DockLayout />;
  return <BandLayout />;
}
