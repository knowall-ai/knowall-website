'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sendContactMessage } from '@/lib/nostr-contact';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
  message: z.string().min(10, 'Please tell us a bit more about how we can help'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await sendContactMessage(data);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div
        role="status"
        className="rounded-lg border border-lime-600/40 bg-lime-600/10 p-8 text-center"
      >
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-lime-500" aria-hidden="true" />
        <h3 className="mb-2 text-xl font-semibold text-white">Message Sent!</h3>
        <p className="text-gray-300">
          Thank you for getting in touch. We&apos;ll get back to you as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message" className="text-gray-200">
          Message
        </Label>
        <Textarea
          id="contact-message"
          rows={5}
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

      <p className="text-center text-xs text-gray-400">
        Your message is sent as an encrypted Nostr DM — no email servers involved.
      </p>
    </form>
  );
}
