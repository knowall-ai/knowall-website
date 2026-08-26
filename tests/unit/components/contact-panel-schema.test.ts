// Guards the @hookform/resolvers <-> zod compatibility pairing. Zod 4 removed
// ZodError.errors, which @hookform/resolvers v3's zodResolver read directly, so
// bumping zod without bumping the resolver makes invalid input throw instead of
// resolving into per-field errors. Asserting on the resolver (not the rendered
// form) keeps this a fast, DOM-free check of the contract that actually broke.
import { describe, expect, it } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { contactSchema } from '@/components/contact-panel';

type ContactValues = z.infer<typeof contactSchema>;

// The resolver is typed to the *parsed* shape, but the point of the first test
// is to feed it input that fails validation — which is what react-hook-form
// does at runtime with whatever the user typed. Hence the cast.
const resolve = (values: Record<string, unknown>) =>
  // react-hook-form also passes context and options; only values matter here.
  zodResolver(contactSchema)(values as ContactValues, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });

describe('contact form resolver', () => {
  it('maps invalid input to field errors instead of throwing', async () => {
    const result = await resolve({ name: 'a', email: 'nope', message: 'short' });

    expect(result.values).toEqual({});
    expect(result.errors.name?.message).toBe('Please enter your name');
    expect(result.errors.email?.message).toBe('Please enter a valid email address');
    expect(result.errors.message?.message).toBe('Please tell us a bit more about how we can help');
  });

  it('passes valid input straight through with no errors', async () => {
    const values = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'I would like to talk about an AI discovery engagement.',
    };
    const result = await resolve(values);

    expect(result.errors).toEqual({});
    expect(result.values).toEqual(values);
  });
});
