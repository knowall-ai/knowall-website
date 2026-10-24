'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sendContactMessage } from '@/lib/nostr-contact';

export const PLATFORMS = ['GitHub', 'Azure DevOps', 'Both', 'Not sure'] as const;
export const SCOPES = [
  'Web apps',
  'APIs',
  'Azure / cloud',
  'AI apps & agents',
  'Source code',
] as const;

export const enquirySchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Please enter your organisation'),
  platform: z.enum(PLATFORMS, { message: 'Please choose where your code lives' }),
  scope: z.array(z.enum(SCOPES)).min(1, 'Please choose at least one area'),
  message: z.string().optional(),
});

type EnquiryData = z.infer<typeof enquirySchema>;

/** Builds the DM body so the team sees a tidy, scannable enquiry. */
export function enquiryMessage(d: EnquiryData): string {
  return [
    'Purple Team enquiry',
    '',
    `Organisation: ${d.company}`,
    `Code lives in: ${d.platform}`,
    `Wants tested: ${d.scope.join(', ')}`,
    '',
    d.message?.trim() || '(no further details)',
  ].join('\n');
}

const field =
  'border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-violet-500';

export default function EnquiryForm() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnquiryData>({ resolver: zodResolver(enquirySchema), defaultValues: { scope: [] } });

  const onSubmit = async (d: EnquiryData) => {
    setSending(true);
    setError(null);
    try {
      await sendContactMessage({ name: d.name, email: d.email, message: enquiryMessage(d) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-10 text-center"
      >
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-violet-400" aria-hidden="true" />
        <h3 className="mb-2 text-xl font-semibold text-white">Thanks — we&apos;ll be in touch</h3>
        <p className="text-gray-300">
          Poppie will set up a short call to scope your Purple Team and agree the rules of
          engagement.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
      data-testid="purple-team-form"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pt-name" className="text-gray-200">
            Name
          </Label>
          <Input
            id="pt-name"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'pt-name-error' : undefined}
            className={field}
            {...register('name')}
          />
          {errors.name && (
            <p id="pt-name-error" role="alert" className="text-sm text-red-400">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pt-email" className="text-gray-200">
            Work email
          </Label>
          <Input
            id="pt-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'pt-email-error' : undefined}
            className={field}
            {...register('email')}
          />
          {errors.email && (
            <p id="pt-email-error" role="alert" className="text-sm text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pt-company" className="text-gray-200">
          Organisation
        </Label>
        <Input
          id="pt-company"
          autoComplete="organization"
          placeholder="Company name"
          aria-invalid={!!errors.company}
          aria-describedby={errors.company ? 'pt-company-error' : undefined}
          className={field}
          {...register('company')}
        />
        {errors.company && (
          <p id="pt-company-error" role="alert" className="text-sm text-red-400">
            {errors.company.message}
          </p>
        )}
      </div>

      <fieldset
        className="space-y-2"
        aria-invalid={!!errors.platform}
        aria-describedby={errors.platform ? 'pt-platform-error' : undefined}
      >
        <legend className="text-sm font-medium text-gray-200">Where does your code live?</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p} className="cursor-pointer">
              <input type="radio" value={p} className="peer sr-only" {...register('platform')} />
              <span className="inline-block rounded-full border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm text-gray-300 transition-colors peer-checked:border-violet-400 peer-checked:bg-violet-500/20 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                {p}
              </span>
            </label>
          ))}
        </div>
        {errors.platform && (
          <p id="pt-platform-error" role="alert" className="text-sm text-red-400">
            {errors.platform.message}
          </p>
        )}
      </fieldset>

      <fieldset
        className="space-y-2"
        aria-invalid={!!errors.scope}
        aria-describedby={errors.scope ? 'pt-scope-error' : undefined}
      >
        <legend className="text-sm font-medium text-gray-200">What would you like tested?</legend>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="checkbox" value={s} className="peer sr-only" {...register('scope')} />
              <span className="inline-block rounded-full border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm text-gray-300 transition-colors peer-checked:border-violet-400 peer-checked:bg-violet-500/20 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                {s}
              </span>
            </label>
          ))}
        </div>
        {errors.scope && (
          <p id="pt-scope-error" role="alert" className="text-sm text-red-400">
            {errors.scope.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="pt-message" className="text-gray-200">
          Anything else? <span className="text-gray-500">(optional)</span>
        </Label>
        <Textarea
          id="pt-message"
          rows={4}
          placeholder="Compliance goals (ISO 27001, Cyber Essentials), a recent incident, or what's keeping you up at night…"
          className={field}
          {...register('message')}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-violet-600 font-semibold text-white hover:bg-violet-700 sm:w-auto sm:px-8"
      >
        {sending ? 'Sending…' : 'Talk to the Purple Team'}
        <Send className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
      <p className="flex items-center gap-2 text-sm text-gray-300">
        <Mail className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
        Prefer email?{' '}
        <a
          href="mailto:hello@knowall.ai?subject=Purple%20Team%20enquiry"
          className="font-medium text-white underline decoration-violet-400 underline-offset-4 hover:text-violet-200"
        >
          hello@knowall.ai
        </a>
      </p>
      <p className="text-xs text-gray-400">
        We never test anything without your written authorisation.
      </p>
    </form>
  );
}
