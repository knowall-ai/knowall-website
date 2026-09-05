'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  SendHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import SallieStage, { Starfield } from '@/components/sallie-stage';
import { useSallieVoice, useSpeechInput } from '@/components/sallie-voice';

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
function useTypewriter(text: string) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
  }, [text]);
  return shown;
}

function useSallieConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId] = useState(() => generateId());

  /** Send a message; resolves to Sallie's reply, or null if it failed. */
  const send = useCallback(
    async (text: string): Promise<string | null> => {
      const content = text.trim();
      if (!content || isLoading) return null;
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
        return reply;
      } catch (err) {
        console.error('Sallie chat error', err);
        setError(
          "Sorry, I couldn't reach my knowledge base just now. Please try again in a moment."
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, conversationId]
  );

  return { messages, isLoading, error, send };
}

/** Track whether an element is on screen; stays "visible" where IntersectionObserver is missing. */
function useOnScreen<T extends Element>(ref: React.RefObject<T | null>) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
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

interface Voice {
  muted: boolean;
  setMuted: (value: boolean) => void;
  speaking: boolean;
  blocked: boolean;
  micSupported: boolean;
  listening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

function VoiceToggle({ voice, className }: { voice: Voice; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => voice.setMuted(!voice.muted)}
      aria-pressed={voice.muted}
      aria-label={voice.muted ? 'Unmute Sallie' : 'Mute Sallie'}
      title={voice.muted ? 'Unmute Sallie' : 'Mute Sallie'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        voice.muted
          ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          : 'border-lime-500/50 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20',
        className
      )}
    >
      {voice.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {voice.muted ? 'Muted' : 'Voice on'}
    </button>
  );
}

interface ConversationPanelProps {
  conversation: ReturnType<typeof useSallieConversation>;
  ask: (text: string) => void;
  voice: Voice;
  input: string;
  setInput: (value: string) => void;
  /** Show the greeting inside the message list (used where there is no speech bubble). */
  greetingInline?: boolean;
  className?: string;
  listClassName?: string;
}

/** Messages, suggestion chips and the composer (with mic). Shared by hero and dock. */
function ConversationPanel({
  conversation,
  ask,
  voice,
  input,
  setInput,
  greetingInline = false,
  className,
  listClassName,
}: ConversationPanelProps) {
  const { messages, isLoading, error } = conversation;
  const endRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading, started]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input;
    setInput('');
    ask(text);
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
          onClick={() => ask(s)}
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

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        {voice.micSupported && (
          <Button
            type="button"
            variant="outline"
            aria-label={voice.listening ? 'Stop listening' : 'Speak to Sallie'}
            aria-pressed={voice.listening}
            onClick={voice.listening ? voice.stopListening : voice.startListening}
            disabled={isLoading}
            className={cn(
              'h-12 w-12 shrink-0 border-gray-700 bg-gray-800/90 p-0 text-gray-200 hover:bg-gray-700 hover:text-white',
              voice.listening &&
                'border-lime-400 bg-lime-500/20 text-lime-300 shadow-[0_0_18px_rgba(157,254,10,0.45)] animate-pulse motion-reduce:animate-none'
            )}
          >
            {voice.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={voice.listening ? 'Listening…' : 'Type your message...'}
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
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
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
  tail = 'top',
  className,
}: {
  text: string;
  tail?: 'top' | 'right';
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
          tail === 'top' && 'left-1/2 top-[-9px] -ml-2 border-l border-t',
          tail === 'right' && 'right-[-9px] top-7 border-r border-t'
        )}
      />
      <p className="text-base leading-relaxed">
        {text}
        <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[2px] bg-lime-400 align-middle animate-sallie-blink motion-reduce:hidden" />
      </p>
    </div>
  );
}

/**
 * Sallie welcomes visitors from the hero and answers questions about what
 * KnowAll does. When her hero spot scrolls out of view she docks in the
 * corner with the same conversation. She talks only to the public
 * `/api/chat` and `/api/speak` endpoints — no internal systems are wired in.
 */
export default function SallieAssistant() {
  const conversation = useSallieConversation();
  const tts = useSallieVoice();
  const [input, setInput] = useState('');
  const greeting = useTypewriter(SALLIE_GREETING);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroOnScreen = useOnScreen(heroRef);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockBubbleDismissed, setDockBubbleDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { speak, stop, unlock } = tts;

  const ask = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      stop();
      void conversation.send(text).then((reply) => {
        if (reply) void speak(reply);
      });
    },
    [conversation, speak, stop]
  );

  const speech = useSpeechInput({
    onInterim: setInput,
    onFinal: (text) => {
      setInput('');
      ask(text);
    },
  });

  const voice: Voice = {
    muted: tts.muted,
    setMuted: tts.setMuted,
    speaking: tts.speaking,
    blocked: tts.blocked,
    micSupported: speech.supported,
    listening: speech.listening,
    startListening: () => {
      stop();
      speech.startListening();
    },
    stopListening: speech.stopListening,
  };

  // Say hello once she is on screen (browsers may hold this until the first
  // interaction; `unlock` releases it).
  useEffect(() => {
    const timer = setTimeout(() => void speak(SALLIE_GREETING), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInteract = (e: PointerEvent | KeyboardEvent) => {
    if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Tab') return;
    unlock();
  };

  const docked = mounted && !heroOnScreen;
  const showDockBubble = docked && !dockOpen && !dockBubbleDismissed;

  const dock = (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 transition-all duration-300',
        docked ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      )}
      data-testid="sallie-dock"
      aria-hidden={!docked}
      onPointerDownCapture={onInteract}
      onKeyDownCapture={onInteract}
    >
      {docked && dockOpen && (
        <div className="flex h-[min(600px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-lime-500/30 bg-gray-950/95 text-white shadow-2xl shadow-black/60 backdrop-blur-md animate-sallie-pop motion-reduce:animate-none">
          <div className="relative flex items-center gap-3 overflow-hidden px-4 py-3">
            <Starfield />
            <SallieStage
              shape="circle"
              busy={conversation.isLoading}
              className="relative z-10 w-12 shrink-0"
              frameClassName="ring-2 ring-lime-500/50"
            />
            <div className="relative z-10">
              <p className="font-semibold leading-tight">Sallie</p>
              <p className="text-xs text-lime-400">KnowAll AI guide</p>
            </div>
            <VoiceToggle voice={voice} className="relative z-10 ml-auto" />
            <button
              type="button"
              onClick={() => setDockOpen(false)}
              aria-label="Close chat"
              className="relative z-10 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ConversationPanel
            conversation={conversation}
            ask={ask}
            voice={voice}
            input={input}
            setInput={setInput}
            greetingInline
            className="min-h-0 flex-1 px-4 pb-4 pt-3"
          />
        </div>
      )}

      {showDockBubble && (
        <div className="relative max-w-[300px]">
          <SpeechBubble
            text={
              conversation.messages.length ? 'Still here if you have more questions.' : greeting
            }
            tail="right"
            className="px-4 py-3 [&_p]:text-sm"
          />
          <button
            type="button"
            onClick={() => setDockBubbleDismissed(true)}
            aria-label="Dismiss greeting"
            className="absolute -left-2 -top-2 rounded-full bg-gray-800 p-1 text-gray-400 shadow hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setDockOpen((o) => !o)}
        aria-label={dockOpen ? 'Close chat with Sallie' : 'Chat with Sallie'}
        aria-expanded={dockOpen}
        tabIndex={docked ? 0 : -1}
        className="group relative rounded-full ring-2 ring-lime-500/60 shadow-[0_0_40px_rgba(157,254,10,0.35)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <SallieStage
          shape="circle"
          busy={conversation.isLoading}
          waveform
          className="w-16 md:w-20"
        />
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-lime-500 text-gray-950 shadow">
          {dockOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );

  return (
    <>
      <div
        ref={heroRef}
        data-testid="sallie-chat"
        className="flex w-full max-w-lg flex-col items-center gap-4 text-white"
        onPointerDownCapture={onInteract}
        onKeyDownCapture={onInteract}
      >
        <SallieStage
          shape="circle"
          busy={conversation.isLoading}
          priority
          waveform
          className="w-44 shrink-0 md:w-56"
          frameClassName="ring-4 ring-lime-400/60 shadow-[0_0_80px_rgba(157,254,10,0.35)]"
        />
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <h3 className="text-2xl font-bold">Sallie</h3>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
            Your AI guide
          </span>
          <VoiceToggle voice={voice} />
        </div>
        {voice.blocked && !voice.muted && (
          <p className="-mt-2 text-xs text-lime-200/80">Click or tap here to hear Sallie</p>
        )}
        <SpeechBubble text={greeting} tail="top" className="w-full" />
        <ConversationPanel
          conversation={conversation}
          ask={ask}
          voice={voice}
          input={input}
          setInput={setInput}
          className="w-full"
          listClassName="max-h-[260px]"
        />
      </div>
      {mounted && createPortal(dock, document.body)}
    </>
  );
}
