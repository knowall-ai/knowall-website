'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { sendContactMessage, type ContactChannel } from '@/lib/nostr-contact';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { nip07SupportsGiftWrap } from '@/lib/nip17';

// KnowAll AI's public Nostr profile, kept discoverable in the panel footer.
const NOSTR_PROFILE_URL =
  'https://njump.me/npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

interface ContactPanelOptions {
  /** Prefill the message field (e.g. a shop product enquiry). */
  message?: string;
}

interface ContactPanelContextType {
  /** Whether the contact panel is currently open. */
  isOpen: boolean;
  /** Directly control the panel open state (used by the Sheet). */
  setIsOpen: (open: boolean) => void;
  /** Open the contact panel, optionally prefilling the message field. */
  openContactPanel: (options?: ContactPanelOptions) => void;
  /** Message to prefill when the panel opens (consumed by the form). */
  prefillMessage: string | null;
}

const ContactPanelContext = createContext<ContactPanelContextType | null>(null);

export function useContactPanel(): ContactPanelContextType {
  const context = useContext(ContactPanelContext);
  if (!context) {
    throw new Error('useContactPanel must be used within a ContactPanelProvider');
  }
  return context;
}

/**
 * Mounts the contact panel once globally and exposes `useContactPanel` so any
 * trigger (header mail icon, Get In Touch Nostr button) opens the same panel.
 * Modeled on Robotechy's MessagesDrawerProvider/useMessagesDrawer pattern.
 */
export function ContactPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const openContactPanel = useCallback((options?: ContactPanelOptions) => {
    setPrefillMessage(options?.message ?? null);
    setIsOpen(true);
  }, []);

  const value = useMemo(
    () => ({ isOpen, setIsOpen, openContactPanel, prefillMessage }),
    [isOpen, openContactPanel, prefillMessage]
  );

  return (
    <ContactPanelContext.Provider value={value}>
      {children}
      <ContactPanel />
    </ContactPanelContext.Provider>
  );
}

/**
 * Exported for the resolver regression test: @hookform/resolvers must stay on a
 * release that speaks the installed Zod's error API (v5+ for Zod 4, which
 * dropped ZodError.errors), otherwise invalid input throws instead of landing
 * in formState.errors.
 */
export const contactSchema = z.object({
  // Limits mirror the server's (lib/contact.ts) so nothing passes here only
  // to be rejected by /api/contact.
  name: z
    .string()
    .min(2, 'Please enter your name')
    .max(100, 'Please keep your name under 100 characters')
    .regex(/^[^\r\n]+$/, 'Please enter your name on one line'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(200, 'Please use a shorter email address'),
  message: z
    .string()
    .min(10, 'Please tell us a bit more about how we can help')
    .max(5000, 'Please keep your message under 5,000 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

/**
 * Right-side slide-out contact panel, styled after Robotechy's messages
 * drawer. No Nostr login is needed: guests' messages are emailed to hello@
 * by /api/contact, while visitors signed in with a NIP-44-capable extension
 * DM the KnowAll AI npub (with an email copy). See docs/CONTACT.adoc.
 */
function ContactPanel() {
  const { isOpen, setIsOpen, prefillMessage } = useContactPanel();
  const { user } = useNostrAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [channel, setChannel] = useState<ContactChannel>('email');
  // Honeypot: hidden from people; bots that fill it are dropped by /api/contact.
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onChange',
  });

  // A trigger can open the panel with a prefilled message (e.g. a shop product
  // enquiry). Triggers without a prefill leave any in-progress draft alone.
  useEffect(() => {
    if (isOpen && prefillMessage) {
      setIsSubmitted(false);
      setValue('message', prefillMessage);
    }
  }, [isOpen, prefillMessage, setValue]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Reset to a fresh form the next time the panel opens.
    if (!open && isSubmitted) {
      setIsSubmitted(false);
      reset();
    }
  };

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      setChannel(
        await sendContactMessage(
          { ...data, ...(website ? { website } : {}) },
          { nostrPubkey: user?.pubkey }
        )
      );
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-gray-800 bg-gray-900 p-0 text-white sm:max-w-md"
      >
        <SheetHeader className="border-b border-gray-800 p-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Mail className="h-5 w-5 text-lime-500" aria-hidden="true" />
            Message us
          </SheetTitle>
          <SheetDescription className="text-gray-400">
            Tell us how we can help and we&apos;ll get back to you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 p-4 sm:p-6">
          {isSubmitted ? (
            <div
              role="status"
              className="rounded-lg border border-lime-600/40 bg-lime-600/10 p-8 text-center"
            >
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-lime-500" aria-hidden="true" />
              <h3 className="mb-2 text-xl font-semibold text-white">Message Sent!</h3>
              <p className="text-gray-300">
                Thank you for getting in touch.{' '}
                {channel === 'nostr'
                  ? 'Your message went to KnowAll AI as a private Nostr DM, with a copy to our inbox.'
                  : channel === 'nostr-only'
                    ? 'Your message went to KnowAll AI as a private Nostr DM.'
                    : 'It has gone to our inbox and we’ll reply by email as soon as we can.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="contact-name" className="text-gray-200">
                  Name
                </Label>
                <Input
                  id="contact-name"
                  autoComplete="name"
                  placeholder="Your name"
                  aria-invalid={!!errors.name}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500"
                  {...register('name')}
                />
                {errors.name && (
                  <p role="alert" className="text-sm text-red-400">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email" className="text-gray-200">
                  Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500"
                  {...register('email')}
                />
                {errors.email && (
                  <p role="alert" className="text-sm text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-gray-200">
                  Message
                </Label>
                <Textarea
                  id="contact-message"
                  rows={6}
                  placeholder="Tell us about your project or the challenge you'd like to solve..."
                  aria-invalid={!!errors.message}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500"
                  {...register('message')}
                />
                {errors.message && (
                  <p role="alert" className="text-sm text-red-400">
                    {errors.message.message}
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-center text-sm text-red-400">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-lime-600 font-semibold text-white hover:bg-lime-700"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
                <Send className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>

              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              <p className="flex items-center justify-center gap-2 text-sm text-gray-300">
                <Mail className="h-4 w-4 shrink-0 text-lime-500" aria-hidden="true" />
                Prefer email?{' '}
                <a
                  href="mailto:hello@knowall.ai"
                  className="font-medium text-white underline decoration-lime-500 underline-offset-4 hover:text-lime-300"
                >
                  hello@knowall.ai
                </a>
              </p>
              <p className="text-center text-xs text-gray-400">
                {user && nip07SupportsGiftWrap()
                  ? 'Signed in with Nostr: sent as a private DM to KnowAll AI, with an email copy.'
                  : 'Sent to our inbox by email.'}
              </p>
            </form>
          )}
        </div>

        <div className="border-t border-gray-800 p-4 text-center">
          <a
            href={NOSTR_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 underline-offset-4 transition-colors hover:text-lime-500 hover:underline"
          >
            View our Nostr profile on njump.me
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
