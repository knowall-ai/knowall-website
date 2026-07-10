import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', false && 'bar', null, undefined, '')).toBe('foo');
  });

  it('handles conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('merges conflicting Tailwind classes, keeping the last one', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-white', 'text-gray-600')).toBe('text-gray-600');
  });

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('p-4', 'text-white')).toBe('p-4 text-white');
  });

  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });
});
