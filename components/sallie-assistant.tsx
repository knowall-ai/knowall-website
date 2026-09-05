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
  Mail,
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
import { pickGreeting, type Greeting } from '@/lib/sallie-greetings';
import { signOffMailto } from '@/lib/sallie-signoff';
import { useSallieVoice, useSpeechInput } from '@/components/sallie-voice';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

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

function useSallieConversation(greeting: Greeting) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [conversationId] = useState(() => generateId());

  /** Send a message; resolves to Sallie's reply, or null if it failed. */
  const send = useCallback(
    async (text: string): Promise<string | null> => {
      const content = text.trim();
      if (!content || isLoading || ended) return null;
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
            // Her on-screen greeting is the first turn, so she doesn't introduce herself twice.
            greetingId: greeting.id,
            messages: [
              { role: 'assistant', content: greeting.text },
              ...history.map(({ role, content }) => ({ role, content })),
            ],
          }),
        });
        if (!res.ok) throw new Error(`Chat API responded with ${res.status}`);
        const data = await res.json();
        const reply: string = data.content || "Sorry, I couldn't process that. Please try again.";
        setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: reply }]);
        if (data.ended) setEnded(true);
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
    [messages, isLoading, conversationId, ended, greeting]
  );

  return { messages, isLoading, error, ended, conversationId, send };
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
            ul: ({ ...props }) => (
              <ul {...props} className="mb-2 list-disc space-y-1 pl-5 last:mb-0" />
            ),
            ol: ({ ...props }) => (
              <ol {...props} className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" />
            ),
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
  /** The visitor has turned their mic on (hands-free conversation). */
  micOn: boolean;
  /** The recogniser is actively capturing right now. */
  listening: boolean;
  transcribing: boolean;
  micError: string | null;
  micOnce: boolean;
  setMicOn: (on: boolean) => void;
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
        'cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
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
  /** Sallie's opening line, shown as the first bubble. */
  greeting: string;
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
  greeting,
  className,
  listClassName,
}: ConversationPanelProps) {
  const { messages, isLoading, error, ended, conversationId } = conversation;
  const endRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading, started]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    // While the recogniser is capturing it sends the transcript itself;
    // submitting here too would double-send. Typing means they'd rather type.
    if (voice.listening) {
      voice.setMicOn(false);
      return;
    }
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
          className="cursor-pointer rounded-full border border-lime-500/40 bg-lime-500/10 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:bg-lime-500/20 hover:text-lime-200 disabled:opacity-50"
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
          'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1',
          '[scrollbar-width:thin] [scrollbar-color:rgba(157,254,10,0.35)_transparent]',
          listClassName
        )}
        aria-live="polite"
      >
        <div data-testid="sallie-greeting" className="contents">
          <MessageBubble message={{ id: 'greeting', role: 'assistant', content: greeting }} />
        </div>
        {!started && suggestions}
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

      {ended ? (
        <div className="mt-3 flex flex-wrap items-center gap-3" data-testid="sallie-ended">
          <Button asChild className="bg-lime-500 text-gray-950 hover:bg-lime-400">
            <a href={signOffMailto(conversationId)}>
              <Mail className="h-4 w-4" />
              Email Sallie to continue
            </a>
          </Button>
          <span className="text-xs text-gray-400">Reference {conversationId}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex items-end gap-2">
          {voice.micSupported && (
            <Button
              type="button"
              variant="outline"
              aria-label={
                voice.micOn ? 'Turn your microphone off' : 'Turn your microphone on to talk'
              }
              title={voice.micOn ? 'Mic on — tap to turn off' : 'Tap to talk to Sallie'}
              aria-pressed={voice.micOn}
              onClick={() => voice.setMicOn(!voice.micOn)}
              disabled={voice.transcribing}
              className={cn(
                'h-12 w-12 shrink-0 border-gray-700 bg-gray-800/90 p-0 text-gray-200 hover:bg-gray-700 hover:text-white',
                voice.micOn &&
                  'border-lime-400 bg-lime-500/20 text-lime-300 shadow-[0_0_18px_rgba(157,254,10,0.45)]',
                voice.listening && 'animate-pulse motion-reduce:animate-none'
              )}
            >
              {voice.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              voice.listening
                ? 'Listening…'
                : voice.transcribing
                  ? 'Working out what you said…'
                  : voice.micOn && voice.speaking
                    ? 'Sallie is speaking…'
                    : 'Type your message...'
            }
            aria-label="Message Sallie"
            rows={1}
            className="min-h-[48px] max-h-32 flex-1 resize-none border-gray-700 bg-gray-800/90 text-gray-100 placeholder:text-gray-500 focus-visible:ring-lime-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={isLoading || voice.listening || voice.transcribing || !input.trim()}
            className="h-12 w-12 shrink-0 bg-lime-500 p-0 text-gray-950 hover:bg-lime-400"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
            )}
          </Button>
        </form>
      )}
      {ended ? null : voice.micError ? (
        <p role="status" className="mt-2 text-xs text-amber-300/90">
          {voice.micError}
        </p>
      ) : voice.micSupported && voice.micOn ? (
        <p role="status" className="mt-2 text-xs text-lime-300/90">
          Mic on — just talk, and tap the mic again to turn it off.
        </p>
      ) : voice.micSupported && !voice.micOnce ? (
        <p className="mt-2 text-xs text-gray-400">Tap the mic to talk to Sallie, or type below.</p>
      ) : null}
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
  const [opener] = useState(() => pickGreeting());
  const conversation = useSallieConversation(opener);
  const tts = useSallieVoice();
  const [input, setInput] = useState('');
  const greeting = useTypewriter(opener.text);
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

  const [micOn, setMicOnState] = useState(false);
  const [micOnce, setMicOnce] = useState(false);
  const [silentTurns, setSilentTurns] = useState(0);

  const speech = useSpeechInput({
    onInterim: setInput,
    onFinal: (text) => {
      setSilentTurns(0);
      setInput('');
      ask(text);
    },
    onSilent: () => setSilentTurns((n) => n + 1),
  });
  const { startListening, stopListening, listening, transcribing, error: micError } = speech;

  const setMicOn = useCallback(
    (on: boolean) => {
      setMicOnState(on);
      setSilentTurns(0);
      if (on) setMicOnce(true);
      else stopListening();
    },
    [stopListening]
  );

  // Hands-free: while the mic is on, listen whenever she isn't speaking or
  // thinking, and go again after each turn. She keeps talking when the mic
  // is switched on — capture simply waits until she has finished.
  useEffect(() => {
    if (conversation.ended && micOn) setMicOnState(false);
  }, [conversation.ended, micOn]);

  useEffect(() => {
    if (!micOn || listening || transcribing || conversation.isLoading || tts.speaking) return;
    const timer = setTimeout(() => startListening(), 350);
    return () => clearTimeout(timer);
  }, [micOn, listening, transcribing, conversation.isLoading, tts.speaking, startListening]);

  // Turn the mic off after a long stretch of silence so it never runs forever.
  useEffect(() => {
    if (silentTurns >= 4) setMicOnState(false);
  }, [silentTurns]);

  useEffect(() => {
    if (micError) setMicOnState(false);
  }, [micError]);

  const voice: Voice = {
    muted: tts.muted,
    setMuted: tts.setMuted,
    speaking: tts.speaking,
    blocked: tts.blocked,
    micSupported: speech.supported,
    micOn,
    listening,
    transcribing,
    micError,
    micOnce,
    setMicOn,
  };

  // Say hello once she is on screen (browsers may hold this until the first
  // interaction; `unlock` releases it).
  useEffect(() => {
    const timer = setTimeout(() => void speak(opener.text), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInteract = (e: PointerEvent | KeyboardEvent) => {
    if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Tab') return;
    unlock();
  };

  // Voice is on by default, but browsers hold audio until the page has had a
  // real interaction. The first click or keypress anywhere releases it.
  useEffect(() => {
    const release = (e: Event) => {
      if (e.type === 'keydown' && (e as unknown as { key?: string }).key === 'Tab') return;
      unlock();
    };
    document.addEventListener('pointerdown', release, { capture: true });
    document.addEventListener('keydown', release, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', release, { capture: true });
      document.removeEventListener('keydown', release, { capture: true });
    };
  }, [unlock]);

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
              className="cursor-pointer relative z-10 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
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
            greeting={opener.text}
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
            className="cursor-pointer absolute -left-2 -top-2 rounded-full bg-gray-800 p-1 text-gray-400 shadow hover:text-white"
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
        className="cursor-pointer group relative rounded-full ring-2 ring-lime-500/60 shadow-[0_0_40px_rgba(157,254,10,0.35)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 motion-reduce:transition-none motion-reduce:hover:scale-100"
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
        // While she's docked the same conversation is in the corner; keep
        // screen readers from finding two copies of the controls.
        aria-hidden={docked || undefined}
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
          <p className="-mt-2 text-xs text-lime-200/80">Click or tap anywhere to hear Sallie</p>
        )}
        <ConversationPanel
          conversation={conversation}
          ask={ask}
          voice={voice}
          input={input}
          setInput={setInput}
          greeting={greeting}
          className="w-full"
          listClassName="max-h-[min(460px,55vh)]"
        />
      </div>
      {mounted && createPortal(dock, document.body)}
    </>
  );
}
